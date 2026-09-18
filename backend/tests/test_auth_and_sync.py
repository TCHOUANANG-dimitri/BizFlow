import uuid

from sqlmodel import Session

from app.db.session import engine
from app.models.catalog import Product


def _register_business(client, pin="1234"):
    r = client.post(
        "/auth/register-business",
        json={"business_name": "Cyber Test", "owner_full_name": "Patron A", "pin": pin},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_login_rejects_wrong_pin(client):
    business = _register_business(client)
    r = client.post("/auth/login", json={"business_code": business["business_code"], "pin": "0000"})
    assert r.status_code == 401


def test_sync_requires_authentication(client):
    r = client.post("/sync/push", json={"sales": []})
    assert r.status_code in (401, 403)

    r = client.get("/sync/pull")
    assert r.status_code in (401, 403)


def test_owner_creates_employee_and_employee_can_login(client):
    business = _register_business(client)
    r = client.post(
        "/auth/employees",
        json={"full_name": "Employe B", "pin": "5678"},
        headers=_auth_header(business["access_token"]),
    )
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "employee"

    r = client.post("/auth/login", json={"business_code": business["business_code"], "pin": "5678"})
    assert r.status_code == 200
    assert r.json()["role"] == "employee"


def test_employee_cannot_create_employees(client):
    business = _register_business(client)
    client.post(
        "/auth/employees",
        json={"full_name": "Employe B", "pin": "5678"},
        headers=_auth_header(business["access_token"]),
    )
    employee_login = client.post(
        "/auth/login", json={"business_code": business["business_code"], "pin": "5678"}
    ).json()

    r = client.post(
        "/auth/employees",
        json={"full_name": "Employe C", "pin": "9999"},
        headers=_auth_header(employee_login["access_token"]),
    )
    assert r.status_code == 403


def test_sale_derives_stock_and_money_movements_and_is_idempotent(client):
    business = _register_business(client)
    employee = client.post(
        "/auth/employees",
        json={"full_name": "Employe B", "pin": "5678"},
        headers=_auth_header(business["access_token"]),
    ).json()
    employee_login = client.post(
        "/auth/login", json={"business_code": business["business_code"], "pin": "5678"}
    ).json()

    with Session(engine) as session:
        product = Product(
            business_id=uuid.UUID(business["business_id"]),
            name="Jus",
            quantity=10,
            selling_price=500,
            purchase_price=300,
        )
        session.add(product)
        session.commit()
        session.refresh(product)
        product_id = str(product.id)

    sale_payload = {
        "sales": [
            {
                "client_uuid": str(uuid.uuid4()),
                "product_id": product_id,
                "quantity": 2,
                "unit_price": 500,
                "payment_method": "cash",
            }
        ]
    }

    r1 = client.post("/sync/push", json=sale_payload, headers=_auth_header(employee_login["access_token"]))
    assert r1.status_code == 200
    assert r1.json()["sales"][0]["status"] == "accepted"

    # Replaying the exact same client_uuid must never double-apply the sale.
    r2 = client.post("/sync/push", json=sale_payload, headers=_auth_header(employee_login["access_token"]))
    assert r2.json()["sales"][0]["status"] == "duplicate"

    pulled = client.get("/sync/pull", headers=_auth_header(business["access_token"])).json()
    assert len(pulled["sales"]) == 1
    assert pulled["sales"][0]["user_id"] == employee["id"]
    assert len(pulled["money_movements"]) == 1
    assert pulled["money_movements"][0]["amount"] == 1000
    assert len(pulled["stock_movements"]) == 1
    assert pulled["stock_movements"][0]["quantity_delta"] == -2

    with Session(engine) as session:
        refreshed = session.get(Product, uuid.UUID(product_id))
        assert refreshed.quantity == 8
