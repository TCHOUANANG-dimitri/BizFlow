from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import CurrentUser, require_dashboard_access
from app.db.session import get_session
from app.schemas.dashboard import DashboardOut
from app.services.dashboard_service import build_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/daily", response_model=DashboardOut)
def daily(
    day: date,
    current_user: CurrentUser = Depends(require_dashboard_access),
    session: Session = Depends(get_session),
):
    return build_dashboard(session, current_user.business_id, day)
