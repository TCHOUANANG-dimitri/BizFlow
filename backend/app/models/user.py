import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    owner = "owner"
    employee = "employee"


class User(SQLModel, table=True):
    """Owner or employee. Scoped to a single business for the MVP."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    business_id: uuid.UUID = Field(foreign_key="business.id", index=True)
    full_name: str
    phone: str | None = None
    pin_hash: str
    """Short PIN, not a password: employees need to authenticate fast on a shared device."""
    role: UserRole = UserRole.employee
    can_view_purchase_prices: bool = False
    can_view_owner_dashboard: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
