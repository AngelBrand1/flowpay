import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository
from flowpay.ledger.application.ledger_service import LedgerService
from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
from flowpay.users.application.user_service import UserService
from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService


@pytest.fixture
def user_service(db: Session) -> UserService:
    return UserService(SQLAlchemyUserRepository(db))


@pytest.fixture
def wallet_service(db: Session) -> WalletService:
    return WalletService(SQLAlchemyWalletRepository(db))


@pytest.fixture
def ledger_service(db: Session) -> LedgerService:
    return LedgerService(SQLAlchemyLedgerRepository(db))


@pytest.fixture
def test_user(user_service: UserService):
    return user_service.create_user("testuser")


@pytest.fixture
def test_wallet(wallet_service: WalletService, test_user):
    return wallet_service.create_wallet(test_user.id)


def test_record_welcome_bonus_with_valid_data(ledger_service: LedgerService, test_wallet):
    txn = ledger_service.record_welcome_bonus(test_wallet.id)

    assert txn.id.startswith("txn_")
    assert txn.wallet_id == test_wallet.id
    assert txn.type == "credit"
    assert txn.amount == 50_000
    assert txn.currency == "COP"
    assert txn.source == "welcome_bonus"
    assert txn.operation_id is None
    assert txn.counterparty_wallet_id is None


def test_calculate_balance_single_credit(ledger_service: LedgerService, test_wallet):
    ledger_service.record_welcome_bonus(test_wallet.id)

    balance = ledger_service.get_wallet_balance(test_wallet.id)

    assert balance.balance == 50_000
    assert balance.currency == "COP"
    assert balance.wallet_id == test_wallet.id


def test_calculate_balance_credit_and_debit(
    ledger_service: LedgerService,
    wallet_service: WalletService,
    user_service: UserService,
    test_wallet,
):
    other_user = user_service.create_user("other")
    other_wallet = wallet_service.create_wallet(other_user.id)

    ledger_service.record_welcome_bonus(test_wallet.id)
    ledger_service.record_transfer_entries(
        operation_id="op_001",
        source_wallet_id=test_wallet.id,
        destination_wallet_id=other_wallet.id,
        amount=5_000,
        source="manual_transfer",
    )

    balance = ledger_service.get_wallet_balance(test_wallet.id)
    assert balance.balance == 45_000


def test_calculate_balance_zero_for_empty_wallet(ledger_service: LedgerService, test_wallet):
    balance = ledger_service.get_wallet_balance(test_wallet.id)
    assert balance.balance == 0


def test_get_wallet_history_ordered_newest_first(
    ledger_service: LedgerService,
    wallet_service: WalletService,
    user_service: UserService,
    test_wallet,
):
    other_user = user_service.create_user("other")
    other_wallet = wallet_service.create_wallet(other_user.id)

    ledger_service.record_welcome_bonus(test_wallet.id)
    ledger_service.record_transfer_entries(
        operation_id="op_001",
        source_wallet_id=test_wallet.id,
        destination_wallet_id=other_wallet.id,
        amount=1_000,
        source="manual_transfer",
    )
    ledger_service.record_transfer_entries(
        operation_id="op_002",
        source_wallet_id=test_wallet.id,
        destination_wallet_id=other_wallet.id,
        amount=2_000,
        source="manual_transfer",
    )

    history = ledger_service.get_wallet_history(test_wallet.id)

    assert len(history) == 3
    for i in range(len(history) - 1):
        assert history[i].created_at >= history[i + 1].created_at


def test_get_wallet_history_with_limit_and_cursor(
    ledger_service: LedgerService,
    wallet_service: WalletService,
    user_service: UserService,
    test_wallet,
):
    other_user = user_service.create_user("other")
    other_wallet = wallet_service.create_wallet(other_user.id)

    for i in range(15):
        ledger_service.record_transfer_entries(
            operation_id=f"op_{i:03d}",
            source_wallet_id=other_wallet.id,
            destination_wallet_id=test_wallet.id,
            amount=1_000,
            source="manual_transfer",
        )

    page1 = ledger_service.get_wallet_history(test_wallet.id, limit=10, offset=0)
    page2 = ledger_service.get_wallet_history(test_wallet.id, limit=10, offset=10)

    assert len(page1) == 10
    assert len(page2) == 5
    page1_ids = {t.id for t in page1}
    page2_ids = {t.id for t in page2}
    assert page1_ids.isdisjoint(page2_ids)


def test_transaction_with_counterparty_resolves_username(
    ledger_service: LedgerService,
    wallet_service: WalletService,
    user_service: UserService,
    test_wallet,
):
    alice = user_service.create_user("alice")
    alice_wallet = wallet_service.create_wallet(alice.id)

    ledger_service.record_transfer_entries(
        operation_id="op_001",
        source_wallet_id=alice_wallet.id,
        destination_wallet_id=test_wallet.id,
        amount=10_000,
        source="manual_transfer",
    )

    history = ledger_service.get_wallet_history(test_wallet.id)

    assert len(history) == 1
    txn = history[0]
    assert txn.counterparty_wallet_id == alice_wallet.id
    assert txn.counterparty_username == "alice"


def test_amount_must_be_positive(ledger_service: LedgerService, test_wallet, db: Session):
    repo = SQLAlchemyLedgerRepository(db)
    with pytest.raises(IntegrityError):
        repo.create_entry(
            transaction_id="txn_neg",
            wallet_id=test_wallet.id,
            type="credit",
            amount=-100,
            source="welcome_bonus",
            operation_id=None,
        )
        db.flush()


def test_welcome_bonus_can_only_be_recorded_once_per_wallet(
    ledger_service: LedgerService, test_wallet, db: Session
):
    ledger_service.record_welcome_bonus(test_wallet.id)

    with pytest.raises(IntegrityError):
        ledger_service.record_welcome_bonus(test_wallet.id)
        db.flush()


def test_transfer_source_requires_operation_id(ledger_service: LedgerService, test_wallet, db: Session):
    from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository

    repo = SQLAlchemyLedgerRepository(db)
    with pytest.raises(IntegrityError):
        repo.create_entry(
            transaction_id="txn_bad",
            wallet_id=test_wallet.id,
            type="credit",
            amount=1_000,
            source="manual_transfer",
            operation_id=None,
        )
        db.flush()


def test_debit_cannot_use_welcome_bonus_source(ledger_service: LedgerService, test_wallet, db: Session):
    from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository

    repo = SQLAlchemyLedgerRepository(db)
    with pytest.raises(IntegrityError):
        repo.create_entry(
            transaction_id="txn_bad",
            wallet_id=test_wallet.id,
            type="debit",
            amount=1_000,
            source="welcome_bonus",
        )
        db.flush()


def test_record_topup_credits_wallet(ledger_service: LedgerService, test_wallet):
    txn = ledger_service.record_topup(test_wallet.id, 100_000)

    assert txn.id.startswith("txn_")
    assert txn.wallet_id == test_wallet.id
    assert txn.type == "credit"
    assert txn.amount == 100_000
    assert txn.currency == "COP"
    assert txn.source == "topup"
    assert txn.operation_id is None
    assert txn.counterparty_wallet_id is None


def test_record_topup_can_be_called_multiple_times(ledger_service: LedgerService, test_wallet):
    ledger_service.record_topup(test_wallet.id, 50_000)
    ledger_service.record_topup(test_wallet.id, 50_000)

    balance = ledger_service.get_wallet_balance(test_wallet.id)
    assert balance.balance == 100_000


def test_record_topup_rejects_zero_amount(ledger_service: LedgerService, test_wallet):
    with pytest.raises(ValueError):
        ledger_service.record_topup(test_wallet.id, 0)


def test_record_topup_rejects_amount_above_max(ledger_service: LedgerService, test_wallet):
    with pytest.raises(ValueError):
        ledger_service.record_topup(test_wallet.id, 1_000_001)
