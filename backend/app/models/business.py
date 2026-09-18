import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Business(SQLModel, table=True):
    """A tenant: one physical small business owned by one account."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    business_code: str = Field(unique=True, index=True)
    """Short human-friendly code employees use to log in (e.g. "KRH4X2"), not the internal UUID."""
    sector: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
