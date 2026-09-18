import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Product(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    business_id: uuid.UUID = Field(foreign_key="business.id", index=True)
    name: str
    quantity: int = 0
    purchase_price: int = 0
    """FCFA, integer (no decimal currency subunit in this market)."""
    selling_price: int = 0
    minimum_stock: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
