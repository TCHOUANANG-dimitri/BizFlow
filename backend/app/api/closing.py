from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_session
from app.schemas.closing import ExpectedCashOut
from app.services.closing_service import compute_expected_cash_breakdown

router = APIRouter(prefix="/closing", tags=["closing"])


@router.get("/expected-cash", response_model=ExpectedCashOut)
def expected_cash(
    closing_date: date,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return compute_expected_cash_breakdown(session, current_user.business_id, closing_date)
