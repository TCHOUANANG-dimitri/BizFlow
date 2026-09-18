import uuid
from datetime import datetime

from sqlmodel import Session, select
from sqlalchemy import and_, or_

from app.models.catalog import Product
from app.models.events import (
    AuditLog,
    DailyClosing,
    MoneyMovement,
    MoneyMovementType,
    Sale,
    StockMovement,
    StockMovementType,
)
from app.services.closing_service import compute_expected_cash
from app.schemas.sync import (
    DailyClosingIn,
    MoneyMovementIn,
    PullResponse,
    PushRequest,
    PushResponse,
    PushResult,
    SaleIn,
    StockMovementIn,
)

PULL_PAGE_SIZE = 500


def _record_sale(session: Session, business_id: uuid.UUID, user_id: uuid.UUID, item: SaleIn) -> PushResult:
    existing = session.exec(select(Sale).where(Sale.client_uuid == item.client_uuid)).first()
    if existing:
        return PushResult(client_uuid=item.client_uuid, status="duplicate")

    with session.begin_nested():
        total_amount = item.quantity * item.unit_price
        sale = Sale(
            client_uuid=item.client_uuid,
            business_id=business_id,
            user_id=user_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_amount=total_amount,
            payment_method=item.payment_method,
        )
        session.add(sale)
        session.flush()

        product = session.get(Product, item.product_id)
        if product is not None:
            # Deliberately never blocked by insufficient stock — see SYNC_DESIGN.md #6.
            product.quantity -= item.quantity
            session.add(product)

        session.add(
            StockMovement(
                client_uuid=uuid.uuid4(),
                business_id=business_id,
                user_id=user_id,
                product_id=item.product_id,
                type=StockMovementType.sale,
                quantity_delta=-item.quantity,
                sale_id=sale.id,
            )
        )
        session.add(
            MoneyMovement(
                client_uuid=uuid.uuid4(),
                business_id=business_id,
                user_id=user_id,
                type=MoneyMovementType.sale,
                amount=total_amount,
                sale_id=sale.id,
            )
        )
        session.add(
            AuditLog(
                business_id=business_id,
                user_id=user_id,
                action="sale.created",
                entity_type="sale",
                entity_id=sale.id,
            )
        )

    return PushResult(client_uuid=item.client_uuid, status="accepted")


def _record_money_movement(
    session: Session, business_id: uuid.UUID, user_id: uuid.UUID, item: MoneyMovementIn
) -> PushResult:
    existing = session.exec(
        select(MoneyMovement).where(MoneyMovement.client_uuid == item.client_uuid)
    ).first()
    if existing:
        return PushResult(client_uuid=item.client_uuid, status="duplicate")

    with session.begin_nested():
        movement = MoneyMovement(
            client_uuid=item.client_uuid,
            business_id=business_id,
            user_id=user_id,
            type=MoneyMovementType(item.type.value),
            amount=item.amount,
            reason=item.reason,
        )
        session.add(movement)
        session.flush()
        session.add(
            AuditLog(
                business_id=business_id,
                user_id=user_id,
                action="money_movement.created",
                entity_type="money_movement",
                entity_id=movement.id,
            )
        )

    return PushResult(client_uuid=item.client_uuid, status="accepted")


def _record_stock_movement(
    session: Session, business_id: uuid.UUID, user_id: uuid.UUID, item: StockMovementIn
) -> PushResult:
    existing = session.exec(
        select(StockMovement).where(StockMovement.client_uuid == item.client_uuid)
    ).first()
    if existing:
        return PushResult(client_uuid=item.client_uuid, status="duplicate")

    with session.begin_nested():
        movement = StockMovement(
            client_uuid=item.client_uuid,
            business_id=business_id,
            user_id=user_id,
            product_id=item.product_id,
            type=StockMovementType(item.type.value),
            quantity_delta=item.quantity_delta,
            reason=item.reason,
        )
        session.add(movement)
        session.flush()

        product = session.get(Product, item.product_id)
        if product is not None:
            product.quantity += item.quantity_delta
            session.add(product)

        session.add(
            AuditLog(
                business_id=business_id,
                user_id=user_id,
                action="stock_movement.created",
                entity_type="stock_movement",
                entity_id=movement.id,
            )
        )

    return PushResult(client_uuid=item.client_uuid, status="accepted")


def _record_daily_closing(
    session: Session, business_id: uuid.UUID, user_id: uuid.UUID, item: DailyClosingIn
) -> PushResult:
    existing = session.exec(
        select(DailyClosing).where(DailyClosing.client_uuid == item.client_uuid)
    ).first()
    if existing:
        return PushResult(client_uuid=item.client_uuid, status="duplicate")

    with session.begin_nested():
        expected_cash = compute_expected_cash(session, business_id, item.closing_date)
        closing = DailyClosing(
            client_uuid=item.client_uuid,
            business_id=business_id,
            user_id=user_id,
            closing_date=item.closing_date,
            expected_cash=expected_cash,
            actual_cash=item.actual_cash,
            difference=item.actual_cash - expected_cash,
            note=item.note,
        )
        session.add(closing)
        session.flush()
        session.add(
            AuditLog(
                business_id=business_id,
                user_id=user_id,
                action="daily_closing.created",
                entity_type="daily_closing",
                entity_id=closing.id,
            )
        )

    return PushResult(client_uuid=item.client_uuid, status="accepted")


def push_batch(session: Session, business_id: uuid.UUID, user_id: uuid.UUID, request: PushRequest) -> PushResponse:
    response = PushResponse()

    for item in request.sales:
        try:
            response.sales.append(_record_sale(session, business_id, user_id, item))
        except Exception as exc:  # noqa: BLE001 — one bad item must not sink the whole batch
            response.sales.append(
                PushResult(client_uuid=item.client_uuid, status="rejected", detail=str(exc))
            )

    for item in request.money_movements:
        try:
            response.money_movements.append(_record_money_movement(session, business_id, user_id, item))
        except Exception as exc:  # noqa: BLE001
            response.money_movements.append(
                PushResult(client_uuid=item.client_uuid, status="rejected", detail=str(exc))
            )

    for item in request.stock_movements:
        try:
            response.stock_movements.append(_record_stock_movement(session, business_id, user_id, item))
        except Exception as exc:  # noqa: BLE001
            response.stock_movements.append(
                PushResult(client_uuid=item.client_uuid, status="rejected", detail=str(exc))
            )

    for item in request.daily_closings:
        try:
            response.daily_closings.append(_record_daily_closing(session, business_id, user_id, item))
        except Exception as exc:  # noqa: BLE001
            response.daily_closings.append(
                PushResult(client_uuid=item.client_uuid, status="rejected", detail=str(exc))
            )

    session.commit()
    return response


def encode_cursor(dt: datetime, id_: uuid.UUID) -> str:
    return f"{dt.isoformat()}|{id_}"


def decode_cursor(raw: str | None) -> tuple[datetime, uuid.UUID] | None:
    if not raw:
        return None
    dt_str, id_str = raw.rsplit("|", 1)
    return datetime.fromisoformat(dt_str), uuid.UUID(id_str)


def _cursor_filter(model, since: tuple[datetime, uuid.UUID] | None):
    if since is None:
        return True
    since_dt, since_id = since
    return or_(
        model.created_at > since_dt,
        and_(model.created_at == since_dt, model.id > since_id),
    )


def _paginate(session: Session, model, business_id: uuid.UUID, since_raw: str | None):
    since = decode_cursor(since_raw)
    rows = session.exec(
        select(model)
        .where(model.business_id == business_id)
        .where(_cursor_filter(model, since))
        .order_by(model.created_at, model.id)
        .limit(PULL_PAGE_SIZE)
    ).all()
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if rows else since_raw
    return rows, next_cursor


def pull_batch(
    session: Session,
    business_id: uuid.UUID,
    since_sales: str | None,
    since_money_movements: str | None,
    since_stock_movements: str | None,
    since_daily_closings: str | None,
) -> PullResponse:
    sales, cursor_sales = _paginate(session, Sale, business_id, since_sales)
    money_movements, cursor_money = _paginate(session, MoneyMovement, business_id, since_money_movements)
    stock_movements, cursor_stock = _paginate(session, StockMovement, business_id, since_stock_movements)
    daily_closings, cursor_closings = _paginate(session, DailyClosing, business_id, since_daily_closings)

    return PullResponse(
        sales=[s.model_dump(mode="json") for s in sales],
        money_movements=[m.model_dump(mode="json") for m in money_movements],
        stock_movements=[m.model_dump(mode="json") for m in stock_movements],
        daily_closings=[c.model_dump(mode="json") for c in daily_closings],
        cursors={
            "sales": cursor_sales,
            "money_movements": cursor_money,
            "stock_movements": cursor_stock,
            "daily_closings": cursor_closings,
        },
    )
