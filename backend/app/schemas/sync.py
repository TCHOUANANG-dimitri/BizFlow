import uuid
from datetime import date
from enum import Enum

from pydantic import BaseModel


class ManualMoneyMovementType(str, Enum):
    """Excludes "sale": that type is only ever derived server-side from a Sale event."""

    income = "income"
    expense = "expense"
    withdrawal = "withdrawal"


class ManualStockMovementType(str, Enum):
    """Excludes "sale": that type is only ever derived server-side from a Sale event."""

    restock = "restock"
    adjustment = "adjustment"


class SaleIn(BaseModel):
    client_uuid: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: int
    payment_method: str


class MoneyMovementIn(BaseModel):
    client_uuid: uuid.UUID
    type: ManualMoneyMovementType
    amount: int
    reason: str | None = None


class StockMovementIn(BaseModel):
    client_uuid: uuid.UUID
    product_id: uuid.UUID
    type: ManualStockMovementType
    quantity_delta: int
    reason: str | None = None


class DailyClosingIn(BaseModel):
    """No `expected_cash` here on purpose: it is computed server-side from recorded money
    movements, never trusted from the client — see documentation/SYNC_DESIGN.md."""

    client_uuid: uuid.UUID
    closing_date: date
    actual_cash: int
    note: str | None = None


class PushRequest(BaseModel):
    sales: list[SaleIn] = []
    money_movements: list[MoneyMovementIn] = []
    stock_movements: list[StockMovementIn] = []
    daily_closings: list[DailyClosingIn] = []


class PushResult(BaseModel):
    client_uuid: uuid.UUID
    status: str
    """"accepted" | "duplicate" | "rejected" """
    detail: str | None = None


class PushResponse(BaseModel):
    sales: list[PushResult] = []
    money_movements: list[PushResult] = []
    stock_movements: list[PushResult] = []
    daily_closings: list[PushResult] = []


class PullResponse(BaseModel):
    sales: list[dict]
    money_movements: list[dict]
    stock_movements: list[dict]
    daily_closings: list[dict]
    cursors: dict[str, str | None]
    """Opaque strings, one per entity key. Echo back verbatim as the next `since_*` param."""
