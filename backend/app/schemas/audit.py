import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    """Une ligne du journal : qui a fait quoi, quand — et sur quel objet."""

    id: uuid.UUID
    created_at: datetime
    action: str
    entity_type: str
    entity_id: uuid.UUID
    details: str | None = None
    user_id: uuid.UUID
    user_full_name: str
    label: str | None = None
    """Libellé lisible de l'entité touchée (produit, employé, mouvement…), projeté en lecture."""