from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import CurrentUser, require_owner
from app.db.session import get_session
from app.schemas.auth import CreateEmployeeRequest, LoginRequest, RegisterBusinessRequest, TokenResponse, UserOut
from app.services.auth_service import create_employee, list_users, login, register_business

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register-business", response_model=TokenResponse)
def register(request: RegisterBusinessRequest, session: Session = Depends(get_session)):
    return register_business(session, request)


@router.post("/login", response_model=TokenResponse)
def login_route(request: LoginRequest, session: Session = Depends(get_session)):
    return login(session, request)


@router.post("/employees", response_model=UserOut)
def create_employee_route(
    request: CreateEmployeeRequest,
    current_user: CurrentUser = Depends(require_owner),
    session: Session = Depends(get_session),
):
    return create_employee(session, current_user.business_id, current_user.id, request)


@router.get("/employees", response_model=list[UserOut])
def list_employees_route(
    current_user: CurrentUser = Depends(require_owner),
    session: Session = Depends(get_session),
):
    return list_users(session, current_user.business_id)
