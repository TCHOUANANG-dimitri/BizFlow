import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import CurrentUser, get_current_user, require_owner
from app.db.session import get_session
from app.models.catalog import Product
from app.schemas.product import ProductCreate, ProductOut, ProductOutRestricted, ProductUpdate
from app.services.product_service import create_product, get_product, list_products, update_product

router = APIRouter(prefix="/products", tags=["products"])


def _shape(product: Product, current_user: CurrentUser) -> ProductOut | ProductOutRestricted:
    if current_user.can_view_purchase_prices:
        return ProductOut.model_validate(product, from_attributes=True)
    return ProductOutRestricted.model_validate(product, from_attributes=True)


@router.post("", response_model=ProductOut)
def create(
    request: ProductCreate,
    current_user: CurrentUser = Depends(require_owner),
    session: Session = Depends(get_session),
):
    product = create_product(session, current_user.business_id, current_user.id, request)
    return ProductOut.model_validate(product, from_attributes=True)


@router.get("", response_model=list[ProductOut] | list[ProductOutRestricted])
def list_all(
    include_inactive: bool = False,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    products = list_products(session, current_user.business_id, include_inactive)
    return [_shape(p, current_user) for p in products]


@router.get("/{product_id}", response_model=ProductOut | ProductOutRestricted)
def get_one(
    product_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    product = get_product(session, current_user.business_id, product_id)
    return _shape(product, current_user)


@router.patch("/{product_id}", response_model=ProductOut)
def update(
    product_id: uuid.UUID,
    request: ProductUpdate,
    current_user: CurrentUser = Depends(require_owner),
    session: Session = Depends(get_session),
):
    product = update_product(session, current_user.business_id, current_user.id, product_id, request)
    return ProductOut.model_validate(product, from_attributes=True)
