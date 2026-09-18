import uuid
from datetime import date, datetime

from pydantic import BaseModel


class StockAlertOut(BaseModel):
    product_id: uuid.UUID
    name: str
    quantity: int
    minimum_stock: int


class TopProductOut(BaseModel):
    product_id: uuid.UUID
    name: str
    quantity_sold: int
    revenue: int


class EmployeeActivityOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    sales_count: int
    sales_total: int


class LatestClosingOut(BaseModel):
    actual_cash: int
    expected_cash: int
    difference: int
    note: str | None
    created_at: datetime


class DashboardOut(BaseModel):
    day: date
    sales_total: int
    expense_total: int
    income_total: int
    withdrawal_total: int
    expected_cash: int
    latest_closing: LatestClosingOut | None
    stock_alerts: list[StockAlertOut]
    top_products: list[TopProductOut]
    employee_activity: list[EmployeeActivityOut]
