import os

os.environ["DATABASE_URL"] = "sqlite:///./test_korah.db"

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

import app.models  # noqa: F401 — registers all tables on the shared metadata
from app.db.session import engine
from app.main import app as fastapi_app


@pytest.fixture(scope="session", autouse=True)
def _tables():
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)
    try:
        os.remove("test_korah.db")
    except OSError:
        pass


@pytest.fixture()
def client():
    return TestClient(fastapi_app)
