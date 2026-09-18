from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import CurrentUser, require_owner
from app.db.session import get_session
from app.schemas.audit import AuditLogOut
from app.services.audit_service import list_audit_log

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit(
    limit: int = Query(100, ge=1, le=500),
    action: str | None = None,
    current_user: CurrentUser = Depends(require_owner),
    session: Session = Depends(get_session),
):
    """Journal d'audit (MVP #6). Réservé au propriétaire — tout est tracé, rien n'est édité."""
    return list_audit_log(session, current_user.business_id, limit, action)