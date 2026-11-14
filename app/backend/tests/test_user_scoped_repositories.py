"""Data of user B must never leak to user A through export and dashboard queries."""

from sqlalchemy import event

from app.db.repositories.export import ExportRepository

PERIOD = {"start_date": "01/01/2000", "end_date": "31/12/2026"}
SECRET_DESCRIPTION = "OnlyUserOne-Secret"


async def _create_transaction(clients_ctrl, user_id: int, description: str, tx_type: str) -> int:
    """Create a transaction as the given user and return its id."""
    clients_ctrl.switch(user_id)
    resp = await clients_ctrl.post(
        "/transacoes/",
        json={
            "amount": 77.0,
            "description": description,
            "transaction_date": "2026-01-15T10:00:00",
            "type": tx_type,
            "entity_type": "individual",
            "payment_method": "pix",
            "category_name": f"Cat{user_id}{tx_type}",
            "subcategory_name": f"Sub{user_id}{tx_type}",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_export_csv_does_not_include_other_users_rows(clients_ctrl):
    await _create_transaction(clients_ctrl, 1, SECRET_DESCRIPTION, "expense")
    await _create_transaction(clients_ctrl, 2, "UserTwoRow", "expense")

    resp = await clients_ctrl.get("/export/csv", params=PERIOD)

    assert resp.status_code == 200
    assert "UserTwoRow" in resp.text
    assert SECRET_DESCRIPTION not in resp.text


async def test_export_ofx_does_not_include_other_users_rows(clients_ctrl):
    await _create_transaction(clients_ctrl, 1, SECRET_DESCRIPTION, "expense")
    clients_ctrl.switch(2)

    resp = await clients_ctrl.get("/export/ofx", params=PERIOD)

    assert resp.status_code == 200
    assert SECRET_DESCRIPTION not in resp.text


async def test_export_repository_returns_only_the_users_rows(clients_ctrl, async_session):
    await _create_transaction(clients_ctrl, 1, "RowOfOne", "expense")
    await _create_transaction(clients_ctrl, 2, "RowOfTwo", "expense")

    rows = await ExportRepository(async_session).get_transactions_for_export(
        PERIOD["start_date"], PERIOD["end_date"], user_id=2
    )

    assert [r.description for r in rows] == ["RowOfTwo"]
    assert {r.user_id for r in rows} == {2}


async def test_dashboard_statement_ignores_other_users(clients_ctrl):
    await _create_transaction(clients_ctrl, 1, SECRET_DESCRIPTION, "income")
    clients_ctrl.switch(2)

    resp = await clients_ctrl.get("/dashboard/statement", params=PERIOD)

    assert resp.status_code == 200
    assert SECRET_DESCRIPTION not in resp.text


async def test_dashboard_income_by_category_ignores_other_users(clients_ctrl):
    await _create_transaction(clients_ctrl, 1, "IncomeOfOne", "income")
    clients_ctrl.switch(2)

    resp = await clients_ctrl.get("/dashboard/income-by-category", params=PERIOD)

    assert resp.status_code == 200
    assert "Sub1income" not in resp.text
    assert "Cat1income" not in resp.text


async def test_export_repository_filters_by_user_in_sql(async_session):
    """The user filter must be part of the SQL, not applied in memory after loading."""
    statements: list[str] = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    sync_engine = async_session.bind.sync_engine
    event.listen(sync_engine, "before_cursor_execute", _capture)
    try:
        await ExportRepository(async_session).get_transactions_for_export(
            PERIOD["start_date"], PERIOD["end_date"], user_id=1
        )
    finally:
        event.remove(sync_engine, "before_cursor_execute", _capture)

    main_query = next(s for s in statements if "FROM transacoes" in s)
    assert "transacoes.user_id" in main_query.split("WHERE", 1)[1]
