import uuid

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.catalog import Product
from app.models.events import AuditLog
from app.schemas.product import ProductCreate, ProductUpdate


def create_product(session: Session, business_id: uuid.UUID, owner_id: uuid.UUID, request: ProductCreate) -> Product:
    product = Product(business_id=business_id, **request.model_dump())
    session.add(product)
    session.flush()
    session.add(
        AuditLog(
            business_id=business_id,
            user_id=owner_id,
            action="product.created",
            entity_type="product",
            entity_id=product.id,
        )
    )
    session.commit()
    session.refresh(product)
    return product


def list_products(session: Session, business_id: uuid.UUID, include_inactive: bool = False) -> list[Product]:
    query = select(Product).where(Product.business_id == business_id)
    if not include_inactive:
        query = query.where(Product.is_active == True)  # noqa: E712
    return session.exec(query.order_by(Product.name)).all()


def get_product(session: Session, business_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    product = session.get(Product, product_id)
    if product is None or product.business_id != business_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit introuvable")
    return product


def update_product(
    session: Session, business_id: uuid.UUID, owner_id: uuid.UUID, product_id: uuid.UUID, request: ProductUpdate
) -> Product:
    product = get_product(session, business_id, product_id)
    changes = request.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(product, field, value)
    session.add(product)
    session.flush()
    if changes:
        session.add(
            AuditLog(
                business_id=business_id,
                user_id=owner_id,
                action="product.updated",
                entity_type="product",
                entity_id=product.id,
                details=", ".join(changes.keys()),
            )
        )
    session.commit()
    session.refresh(product)
    return product
