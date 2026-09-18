import random
import string
import uuid

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.security import create_access_token, hash_pin, verify_pin
from app.models.business import Business
from app.models.events import AuditLog
from app.models.user import User, UserRole
from app.schemas.auth import CreateEmployeeRequest, LoginRequest, RegisterBusinessRequest, TokenResponse

CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_business_code(session: Session) -> str:
    for _ in range(10):
        code = "".join(random.choices(CODE_ALPHABET, k=6))
        exists = session.exec(select(Business).where(Business.business_code == code)).first()
        if not exists:
            return code
    raise RuntimeError("Could not generate a unique business code, try again")


def _token_for(user: User, business: Business) -> TokenResponse:
    access_token = create_access_token(user.id, business.id, user.role.value)
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        business_id=business.id,
        business_code=business.business_code,
        role=user.role,
        full_name=user.full_name,
        can_view_purchase_prices=user.can_view_purchase_prices,
        can_view_owner_dashboard=user.can_view_owner_dashboard,
    )


def register_business(session: Session, request: RegisterBusinessRequest) -> TokenResponse:
    business = Business(
        name=request.business_name,
        sector=request.sector,
        business_code=_generate_business_code(session),
    )
    session.add(business)
    session.flush()

    owner = User(
        business_id=business.id,
        full_name=request.owner_full_name,
        phone=request.owner_phone,
        pin_hash=hash_pin(request.pin),
        role=UserRole.owner,
        can_view_purchase_prices=True,
        can_view_owner_dashboard=True,
    )
    session.add(owner)
    session.flush()

    session.add(
        AuditLog(
            business_id=business.id,
            user_id=owner.id,
            action="business.registered",
            entity_type="business",
            entity_id=business.id,
        )
    )
    session.commit()
    session.refresh(owner)
    session.refresh(business)
    return _token_for(owner, business)


def login(session: Session, request: LoginRequest) -> TokenResponse:
    business = session.exec(
        select(Business).where(Business.business_code == request.business_code.upper())
    ).first()
    if business is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Code entreprise ou PIN incorrect")

    candidates = session.exec(
        select(User).where(User.business_id == business.id, User.is_active == True)  # noqa: E712
    ).all()
    for user in candidates:
        if verify_pin(request.pin, user.pin_hash):
            return _token_for(user, business)

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Code entreprise ou PIN incorrect")


def create_employee(session: Session, business_id: uuid.UUID, owner_id: uuid.UUID, request: CreateEmployeeRequest) -> User:
    employee = User(
        business_id=business_id,
        full_name=request.full_name,
        phone=request.phone,
        pin_hash=hash_pin(request.pin),
        role=UserRole.employee,
        can_view_purchase_prices=request.can_view_purchase_prices,
        can_view_owner_dashboard=request.can_view_owner_dashboard,
    )
    session.add(employee)
    session.flush()
    session.add(
        AuditLog(
            business_id=business_id,
            user_id=owner_id,
            action="employee.created",
            entity_type="user",
            entity_id=employee.id,
        )
    )
    session.commit()
    session.refresh(employee)
    return employee


def list_users(session: Session, business_id: uuid.UUID) -> list[User]:
    """Tous les comptes actifs d'une entreprise, triés par nom — jamais le PIN."""
    return session.exec(
        select(User)
        .where(User.business_id == business_id, User.is_active == True)  # noqa: E712
        .order_by(User.full_name)
    ).all()
