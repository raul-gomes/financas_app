"""LimitsService: bulk update item isolation (savepoints), risk projection, user scoping."""

from datetime import datetime

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError

from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.category import CategoriaRepository
from app.schemas.limits import CategoriaLimiteUpdate, LimitsUpdatePayload
from app.services.limits_service import GENERIC_ITEM_ERROR, LimitsService

LEAK_MARKER = "leak-marker-internal-detail"
NOW = datetime(2026, 3, 15, 12, 0, 0)


def _category(name: str, limit: float = 100.0, subs: tuple[str, ...] = (), **extra):
    return CategoriaLimiteUpdate(
        category_name=name,
        entity_type="individual",
        limit=limit,
        subcategories=[{"subcategory_name": sub} for sub in subs],
        **extra,
    )


async def _names(session) -> list[str]:
    rows = await session.execute(select(CategoryORM.name).order_by(CategoryORM.name))
    return list(rows.scalars())


async def _service(make_uow, user_id: int = 1):
    uow, user = await make_uow(user_id)
    # pysqlite opens a transaction lazily and would commit a released outermost SAVEPOINT;
    # a first write makes the unit of work's rollback behave as on PostgreSQL.
    await uow.session.execute(update(UserORM).where(UserORM.id == user_id).values(name="U"))
    return LimitsService(uow, user), uow


@pytest.mark.asyncio
async def test_bulk_creates_categories_and_subcategories_without_committing(
    async_session, make_uow
):
    service, uow = await _service(make_uow)

    response = await service.bulk_update(
        LimitsUpdatePayload(new=[_category("Food", 300, subs=("Lunch", "  ", "Dinner"))])
    )

    assert response.success is True
    assert (response.created_categories, response.created_subcategories) == (1, 2)
    await uow.rollback()
    assert await _names(async_session) == []


@pytest.mark.asyncio
async def test_a_failing_item_is_reported_and_the_others_still_commit(
    async_session, make_uow, monkeypatch
):
    original_create = CategoriaRepository.create

    async def create_or_fail(self, user_id, obj_in, **kwargs):
        if obj_in.category_name == "Broken":
            raise SQLAlchemyError(LEAK_MARKER)
        return await original_create(self, user_id, obj_in, **kwargs)

    monkeypatch.setattr(CategoriaRepository, "create", create_or_fail)
    service, uow = await _service(make_uow)

    response = await service.bulk_update(
        LimitsUpdatePayload(new=[_category("Good"), _category("Broken"), _category("Also good")])
    )
    await uow.commit()

    assert response.success is False
    assert response.created_categories == 2
    assert response.errors == [f"Erro ao criar categoria 'Broken': {GENERIC_ITEM_ERROR}"]
    assert LEAK_MARKER not in str(response.model_dump())
    assert await _names(async_session) == ["Also good", "Good"]


@pytest.mark.asyncio
async def test_a_failed_item_rolls_back_its_own_partial_work(async_session, make_uow, monkeypatch):
    """Category created, then its subcategory fails: neither stays and the counters agree."""
    from app.db.repositories.subcategory import SubcategoriaRepository

    async def failing_sub_create(self, *args, **kwargs):
        raise SQLAlchemyError(LEAK_MARKER)

    monkeypatch.setattr(SubcategoriaRepository, "create", failing_sub_create)
    service, uow = await _service(make_uow)

    response = await service.bulk_update(
        LimitsUpdatePayload(new=[_category("Half", subs=("Sub",)), _category("Whole")])
    )
    await uow.commit()

    assert response.created_categories == 1
    assert response.created_subcategories == 0
    assert await _names(async_session) == ["Whole"]


@pytest.mark.asyncio
async def test_duplicate_name_and_unknown_id_are_item_errors(async_session, make_uow):
    service, uow = await _service(make_uow)
    await service.bulk_update(LimitsUpdatePayload(new=[_category("Food")]))

    response = await service.bulk_update(
        LimitsUpdatePayload(
            new=[_category("Food")],
            modified=[_category("Ghost", id=9999), _category("No id")],
        )
    )

    assert response.success is False
    assert response.errors == [
        "Erro ao criar categoria 'Food': Categoria 'Food' com tipo 'individual' já existe",
        "Erro ao atualizar categoria ID 9999: Categoria ID 9999 não encontrada",
        "Erro ao atualizar categoria ID None: ID da categoria é obrigatório para atualização",
    ]
    await uow.commit()
    assert await _names(async_session) == ["Food"]


@pytest.mark.asyncio
async def test_bulk_modify_and_delete_only_touch_the_users_own_categories(async_session, make_uow):
    owner, owner_uow = await _service(make_uow, 1)
    await owner.bulk_update(LimitsUpdatePayload(new=[_category("Mine", subs=("Sub",))]))
    await owner_uow.commit()
    mine = (await owner.list_all())[0]
    intruder, intruder_uow = await _service(make_uow, 2)

    response = await intruder.bulk_update(
        LimitsUpdatePayload(deleted=[mine["id"]], modified=[_category("Hijacked", id=mine["id"])])
    )
    await intruder_uow.commit()

    assert response.deleted_categories == 0
    assert response.updated_categories == 0
    assert await _names(async_session) == ["Mine"]
    assert await intruder.list_all() == []


@pytest.mark.asyncio
async def test_bulk_update_modifies_and_deletes_the_users_categories(async_session, make_uow):
    service, uow = await _service(make_uow)
    await service.bulk_update(
        LimitsUpdatePayload(new=[_category("Old", subs=("Keep",)), _category("Gone")])
    )
    existing = {item["category_name"]: item for item in await service.list_all()}
    keep_sub = existing["Old"]["subcategories"][0]["id"]

    response = await service.bulk_update(
        LimitsUpdatePayload(
            deleted=[existing["Gone"]["id"]],
            modified=[
                CategoriaLimiteUpdate(
                    id=existing["Old"]["id"],
                    category_name="Renamed",
                    entity_type="individual",
                    limit=500,
                    subcategories=[
                        {"id": keep_sub, "subcategory_name": "Kept"},
                        {"subcategory_name": "Fresh"},
                    ],
                )
            ],
        )
    )
    await uow.commit()

    assert response.success is True
    assert (response.deleted_categories, response.updated_categories) == (1, 1)
    assert (response.updated_subcategories, response.created_subcategories) == (1, 1)
    assert await _names(async_session) == ["Renamed"]
    subs = (
        await async_session.execute(select(SubcategoryORM.name).order_by(SubcategoryORM.name))
    ).scalars()
    assert list(subs) == ["Fresh", "Kept"]


async def _seed_spending(session, user_id: int, limit: float, spent: float):
    category = CategoryORM(name="Food", entity_type="individual", limit=limit, user_id=user_id)
    category.subcategories = [SubcategoryORM(name="Lunch")]
    session.add(category)
    await session.flush()
    session.add(
        TransactionORM(
            amount=spent,
            description="x",
            transaction_date=NOW,
            type="expense",
            entity_type="individual",
            payment_method="pix",
            category_id=category.id,
            subcategory_id=category.subcategories[0].id,
            user_id=user_id,
        )
    )
    await session.commit()
    return category.id


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("amount", "projected", "severity", "hits", "over"),
    [
        (0, 50.0, None, [], False),
        (30, 80.0, "warning", [80], False),
        (40, 90.0, "critical", [80, 90], False),
        (60, 110.0, "destructive", [80, 90, 100], True),
        (None, 50.0, None, [], False),
    ],
)
async def test_category_risk_projects_the_typed_amount(
    async_session, make_uow, amount, projected, severity, hits, over
):
    service, _ = await _service(make_uow)
    category_id = await _seed_spending(async_session, 1, limit=100.0, spent=50.0)

    risk = await service.category_risk(category_id, amount, now=NOW)

    assert risk.projected_percent_used == projected
    assert risk.severity == severity
    assert risk.thresholds_hit == hits
    assert risk.is_over_limit is over
    assert risk.percent_used == 50.0


@pytest.mark.asyncio
async def test_category_risk_of_another_users_category_is_neutral(async_session, make_uow):
    category_id = await _seed_spending(async_session, 1, limit=100.0, spent=500.0)
    intruder, _ = await _service(make_uow, 2)

    risk = await intruder.category_risk(category_id, 10, now=NOW)

    assert (risk.category_name, risk.limit, risk.spent, risk.is_over_limit) == (
        "Categoria",
        0.0,
        0.0,
        False,
    )


@pytest.mark.asyncio
async def test_with_spending_is_scoped_to_the_user(async_session, make_uow):
    await _seed_spending(async_session, 1, limit=100.0, spent=25.0)
    mine, _ = await _service(make_uow, 1)
    other, _ = await _service(make_uow, 2)

    mine_data = await mine.with_spending(2026, 3, None)
    other_data = await other.with_spending(2026, 3, None)

    assert mine_data["total_spent"] == 25.0
    assert other_data["categories"] == []
    assert (
        await async_session.execute(select(func.count()).select_from(CategoryORM))
    ).scalar_one() == 1
