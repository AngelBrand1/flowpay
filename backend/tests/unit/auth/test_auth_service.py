from datetime import datetime, timezone

import pytest

from flowpay.auth.application.auth_service import AuthService, InvalidCredentialsError
from flowpay.auth.ports.credentials_repository import CredentialsRepository
from flowpay.users.application.user_service import (
    UsernameAlreadyExistsError,
    UserService,
    UserSummary,
)
from flowpay.users.ports.user_repository import UserRecord, UserRepository


class MockUserRepository(UserRepository):
    def __init__(self):
        self.users = {}
        self.counter = 0

    def create(self, user_id: str, username: str) -> UserRecord:
        if username in [u.username for u in self.users.values()]:
            from flowpay.users.ports.user_repository import UsernameConflictError
            raise UsernameConflictError()
        record = UserRecord(
            id=user_id,
            username=username,
            created_at=datetime.now(timezone.utc),
        )
        self.users[user_id] = record
        return record

    def get_by_id(self, user_id: str) -> UserRecord | None:
        return self.users.get(user_id)

    def get_by_username(self, username: str) -> UserRecord | None:
        for record in self.users.values():
            if record.username == username:
                return record
        return None


class MockCredentialsRepository(CredentialsRepository):
    def __init__(self):
        self.credentials = {}

    def create(self, user_id: str, password_hash: str) -> None:
        self.credentials[user_id] = password_hash

    def get_password_hash(self, user_id: str) -> str | None:
        return self.credentials.get(user_id)


@pytest.fixture
def user_repository():
    return MockUserRepository()


@pytest.fixture
def credentials_repository():
    return MockCredentialsRepository()


@pytest.fixture
def user_service(user_repository):
    return UserService(user_repository)


@pytest.fixture
def auth_service(credentials_repository, user_service):
    def hash_fn(password: str) -> str:
        return f"hashed_{password}"

    def verify_fn(password: str, password_hash: str) -> bool:
        return password_hash == f"hashed_{password}"

    return AuthService(
        credentials_repository=credentials_repository,
        user_service=user_service,
        hash_fn=hash_fn,
        verify_fn=verify_fn,
    )


def test_register_creates_user_and_stores_password_hash(auth_service, credentials_repository):
    """Test that register creates a user and stores the password hash."""
    user_summary = auth_service.register("alice", "password123")

    assert user_summary.username == "alice"
    assert user_summary.id.startswith("usr_")

    stored_hash = credentials_repository.get_password_hash(user_summary.id)
    assert stored_hash == "hashed_password123"


def test_register_duplicate_username_raises_error(auth_service):
    """Test that registering with a duplicate username raises an error."""
    auth_service.register("alice", "password1")

    with pytest.raises(UsernameAlreadyExistsError):
        auth_service.register("alice", "password2")


def test_login_succeeds_with_correct_password(auth_service):
    """Test that login succeeds with the correct password."""
    auth_service.register("alice", "password123")

    user_summary = auth_service.login("alice", "password123")
    assert user_summary.username == "alice"


def test_login_rejects_wrong_password(auth_service):
    """Test that login rejects the wrong password."""
    auth_service.register("alice", "password123")

    with pytest.raises(InvalidCredentialsError):
        auth_service.login("alice", "wrongpassword")


def test_login_rejects_unknown_user(auth_service):
    """Test that login rejects an unknown user."""
    with pytest.raises(InvalidCredentialsError):
        auth_service.login("nonexistent", "password123")


def test_service_returns_user_summary(auth_service):
    """Test that the service returns UserSummary, not repository records."""
    user_summary = auth_service.register("alice", "password123")
    assert isinstance(user_summary, UserSummary)
    assert hasattr(user_summary, "id")
    assert hasattr(user_summary, "username")
