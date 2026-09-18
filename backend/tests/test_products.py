def _register_business(client, pin="1234"):
    r = client.post(
        "/auth/register-business",
        json={"business_name": "Cyber Test", "owner_full_name": "Patron A", "pin": pin},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_employee(client, business, pin="5678", can_view_purchase_prices=False):
    client.post(
        "/auth/employees",
        json={"full_name": "Employe B", "pin": pin, "can_view_purchase_prices": can_view_purchase_prices},
        headers=_auth_header(business["access_token"]),
    )
    return client.post(
        "/auth/login", json={"business_code": business["business_code"], "pin": pin}
    ).json()


def test_owner_can_create_and_list_products_with_purchase_price(client):
    business = _register_business(client)
    r = client.post(
        "/products",
        json={"name": "Jus", "quantity": 10, "purchase_price": 300, "selling_price": 500, "minimum_stock": 2},
        headers=_auth_header(business["access_token"]),
    )
    assert r.status_code == 200, r.text
    assert r.json()["purchase_price"] == 300

    r = client.get("/products", headers=_auth_header(business["access_token"]))
    assert r.status_code == 200
    assert r.json()[0]["purchase_price"] == 300


def test_employee_without_permission_does_not_see_purchase_price(client):
    business = _register_business(client)
    client.post(
        "/products",
        json={"name": "Jus", "quantity": 10, "purchase_price": 300, "selling_price": 500},
        headers=_auth_header(business["access_token"]),
    )
    employee = _create_employee(client, business, can_view_purchase_prices=False)

    r = client.get("/products", headers=_auth_header(employee["access_token"]))
    assert r.status_code == 200
    assert "purchase_price" not in r.json()[0]
    assert r.json()[0]["selling_price"] == 500


def test_employee_cannot_create_product(client):
    business = _register_business(client)
    employee = _create_employee(client, business)
    r = client.post(
        "/products",
        json={"name": "Jus", "quantity": 10, "purchase_price": 300, "selling_price": 500},
        headers=_auth_header(employee["access_token"]),
    )
    assert r.status_code == 403


def test_owner_can_update_product(client):
    business = _register_business(client)
    product = client.post(
        "/products",
        json={"name": "Jus", "quantity": 10, "purchase_price": 300, "selling_price": 500},
        headers=_auth_header(business["access_token"]),
    ).json()

    r = client.patch(
        f"/products/{product['id']}",
        json={"selling_price": 600},
        headers=_auth_header(business["access_token"]),
    )
    assert r.status_code == 200
    assert r.json()["selling_price"] == 600
    assert r.json()["purchase_price"] == 300
