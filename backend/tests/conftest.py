import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL_TEST",
    "postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test",
)

os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)

from flowpay.database import Base, get_db  # noqa: E402
from flowpay.main import app  # noqa: E402

test_engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture(scope="session")
def apply_schema():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db(apply_schema):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
