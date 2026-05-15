import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService
from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
from flowpay.users.application.user_service import UserService


@pytest.fixture
def user_service(db: Session) -> UserService:
    return UserService(SQLAlchemyUserRepository(db))


@pytest.fixture
def wallet_service(db: Session) -> WalletService:
    return WalletService(SQLAlchemyWalletRepository(db))


@pytest.fixture
def test_user(user_service: UserService):
    """Create a test user."""
    return user_service.create_user("testuser")


def test_create_wallet(wallet_service: WalletService, test_user):
    """Test creating a wallet."""
    wallet = wallet_service.create_wallet(test_user.id)

    assert wallet is not None
    assert wallet.user_id == test_user.id
    assert wallet.currency == "COP"
    assert wallet.id.startswith("wal_")


def test_get_wallet_by_id(wallet_service: WalletService, test_user):
    """Test retrieving wallet by ID."""
    created = wallet_service.create_wallet(test_user.id)
    retrieved = wallet_service.get_by_id(created.id)

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.user_id == test_user.id
    assert retrieved.currency == "COP"


def test_get_wallet_by_user_id(wallet_service: WalletService, test_user):
    """Test retrieving wallet by user ID."""
    created = wallet_service.create_wallet(test_user.id)
    retrieved = wallet_service.get_by_user_id(test_user.id)

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.user_id == test_user.id
    assert retrieved.currency == "COP"


def test_get_nonexistent_wallet(wallet_service: WalletService):
    """Test retrieving a nonexistent wallet returns None."""
    assert wallet_service.get_by_id("wal_nonexistent") is None
    assert wallet_service.get_by_user_id("usr_nonexistent") is None


def test_wallet_currency_is_cop(wallet_service: WalletService, test_user):
    """Test that wallet currency is always COP."""
    wallet = wallet_service.create_wallet(test_user.id)
    assert wallet.currency == "COP"


def test_wallet_created_at_is_set(wallet_service: WalletService, test_user):
    """Test that wallet created_at is set correctly."""
    wallet = wallet_service.create_wallet(test_user.id)
    assert wallet.created_at is not None
    # Should be ISO format string
    assert "T" in wallet.created_at


def test_one_wallet_per_user(wallet_service: WalletService, test_user, db: Session):
    """Test that each user can have only one wallet."""
    wallet_service.create_wallet(test_user.id)

    # Attempt to create a second wallet for the same user should raise IntegrityError
    with pytest.raises(IntegrityError):
        wallet_service.create_wallet(test_user.id)
        db.flush()
