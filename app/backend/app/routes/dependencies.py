"""FastAPI dependencies shared by the routes: services bound to the authenticated user.

Each provider wires one request: authenticated user (from the verified token) + the
request's session/unit of work -> service. Routes never receive a ``user_id`` from the client.
"""

from datetime import datetime

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.errors import ValidationError
from app.core.security import get_current_user
from app.core.unit_of_work import UnitOfWork, get_unit_of_work
from app.db.models.user import UserORM
from app.services.category_service import CategoryService
from app.services.dashboard_service import DashboardService
from app.services.extract_service import ExtractService
from app.services.goal_service import GoalService
from app.services.limits_service import LimitsService
from app.services.pluggy_sync_service import PluggySyncService
from app.services.recurring_account_service import RecurringAccountService
from app.services.settings_service import SettingsService
from app.services.shopping_service import ShoppingService
from app.services.transaction_service import TransactionService

BR_DATE_FORMAT = "%d/%m/%Y"


def parse_date(date_str: str, field_name: str) -> datetime:
    """Parses a DD/MM/YYYY query parameter, raising ValidationError (400) when malformed."""
    try:
        return datetime.strptime(date_str, BR_DATE_FORMAT)
    except ValueError as exc:
        raise ValidationError(f"Formato inválido para {field_name}. Use DD/MM/YYYY.") from exc


async def get_transaction_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> TransactionService:
    """Transactions service whose writes are committed once by the unit of work."""
    return TransactionService(uow, current_user)


async def get_transaction_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> TransactionService:
    """Transactions service for read-only routes: no unit of work, nothing to commit.

    Only call the service's read methods (get, list_*, check_duplicates) through it.
    """
    return TransactionService(UnitOfWork(session), current_user)


async def get_dashboard_service(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> DashboardService:
    """Dashboard/overview service (read-only: no unit of work, nothing to commit)."""
    return DashboardService(session, current_user)


async def get_category_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> CategoryService:
    """Categories service whose writes are committed once by the unit of work."""
    return CategoryService(uow, current_user)


async def get_category_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> CategoryService:
    """Categories service for read-only routes (only call ``list``/``get`` through it)."""
    return CategoryService(UnitOfWork(session), current_user)


async def get_limits_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> LimitsService:
    """Limits service whose writes (bulk update) are committed once by the unit of work."""
    return LimitsService(uow, current_user)


async def get_limits_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> LimitsService:
    """Limits service for read-only routes (list_all, with_spending, category_risk)."""
    return LimitsService(UnitOfWork(session), current_user)


async def get_goal_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> GoalService:
    """Goals service whose writes are committed once by the unit of work."""
    return GoalService(uow, current_user)


async def get_goal_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> GoalService:
    """Goals service for read-only routes (list_goals, progress)."""
    return GoalService(UnitOfWork(session), current_user)


async def get_shopping_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> ShoppingService:
    """Shopping-list service whose writes are committed once by the unit of work."""
    return ShoppingService(uow, current_user)


async def get_shopping_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> ShoppingService:
    """Shopping-list service for the read-only listing."""
    return ShoppingService(UnitOfWork(session), current_user)


async def get_settings_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> SettingsService:
    """Settings (profile + banks) service whose writes are committed once by the unit of work."""
    return SettingsService(uow, current_user)


async def get_settings_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> SettingsService:
    """Settings service for read-only routes (profile, list_banks)."""
    return SettingsService(UnitOfWork(session), current_user)


async def get_recurring_account_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> RecurringAccountService:
    """Recurring-accounts service whose writes are committed once by the unit of work."""
    return RecurringAccountService(uow, current_user)


async def get_recurring_account_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> RecurringAccountService:
    """Recurring-accounts service for read-only routes (list_accounts, get)."""
    return RecurringAccountService(UnitOfWork(session), current_user)


async def get_extract_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> ExtractService:
    """Extract service whose batch import is committed once by the unit of work."""
    return ExtractService(uow, current_user)


async def get_extract_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> ExtractService:
    """Extract service for the upload/parse route (touches no data: nothing to commit)."""
    return ExtractService(UnitOfWork(session), current_user)


async def get_pluggy_service(
    uow: UnitOfWork = Depends(get_unit_of_work, scope="function"),
    current_user: UserORM = Depends(get_current_user),
) -> PluggySyncService:
    """Pluggy service whose imports are committed once by the unit of work."""
    return PluggySyncService(uow, current_user)


async def get_pluggy_reader(
    session: AsyncSession = Depends(get_session),
    current_user: UserORM = Depends(get_current_user),
) -> PluggySyncService:
    """Pluggy service for routes that write nothing (list_accounts, validate_key)."""
    return PluggySyncService(UnitOfWork(session), current_user)
