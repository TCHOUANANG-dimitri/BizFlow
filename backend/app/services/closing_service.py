import uuid
from datetime import date

from sqlmodel import Session, select
from sqlalchemy import func

from app.models.events import MoneyMovement, MoneyMovementType


def compute_expected_cash_breakdown(session: Session, business_id: uuid.UUID, closing_date: date) -> dict:
    """Sum of every money movement recorded *that calendar day* — sales, manual income,
    expenses, withdrawals. Per SYNC_DESIGN.md, this is deliberately per-day, not a running
    balance carried over from previous days: each day is reconciled independently.
    """
    rows = session.exec(
        select(MoneyMovement.type, func.coalesce(func.sum(MoneyMovement.amount), 0))
        .where(MoneyMovement.business_id == business_id)
        .where(func.date(MoneyMovement.created_at) == closing_date)
        .group_by(MoneyMovement.type)
    ).all()

    totals = {t: 0 for t in MoneyMovementType}
    for movement_type, total in rows:
        totals[MoneyMovementType(movement_type)] = int(total)

    expected_cash = sum(totals.values())
    return {
        "closing_date": closing_date,
        "expected_cash": expected_cash,
        "sales_total": totals[MoneyMovementType.sale],
        "income_total": totals[MoneyMovementType.income],
        "expense_total": totals[MoneyMovementType.expense],
        "withdrawal_total": totals[MoneyMovementType.withdrawal],
    }


def compute_expected_cash(session: Session, business_id: uuid.UUID, closing_date: date) -> int:
    return compute_expected_cash_breakdown(session, business_id, closing_date)["expected_cash"]
