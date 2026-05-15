from unittest.mock import MagicMock

import pytest

from flowpay.auth.application.registration_service import (
    RegisteredWalletSummary,
    RegistrationService,
    RegistrationSummary,
)
from flowpay.ledger.application.ledger_service import WELCOME_BONUS_AMOUNT, WalletBalance
from flowpay.users.application.user_service import UsernameAlreadyExistsError, UserSummary
from flowpay.wallets.application.wallet_service import WalletSummary


@pytest.fixture
def auth_service():
    return MagicMock()


@pytest.fixture
def wallet_service():
    return MagicMock()


@pytest.fixture
def ledger_service():
    return MagicMock()


@pytest.fixture
def registration_service(auth_service, wallet_service, ledger_service):
    return RegistrationService(
        auth_service=auth_service,
        wallet_service=wallet_service,
        ledger_service=ledger_service,
    )


def test_register_creates_user_wallet_bonus_and_returns_derived_balance(
    registration_service, auth_service, wallet_service, ledger_service
):
    auth_service.register.return_value = UserSummary(id="usr_abc", username="alice")
    wallet_service.create_wallet.return_value = WalletSummary(
        id="wal_xyz", user_id="usr_abc", currency="COP", created_at="2026-01-01T00:00:00"
    )
    ledger_service.get_wallet_balance.return_value = WalletBalance(
        wallet_id="wal_xyz", balance=WELCOME_BONUS_AMOUNT, currency="COP"
    )

    result = registration_service.register("alice", "password123")

    auth_service.register.assert_called_once_with("alice", "password123")
    wallet_service.create_wallet.assert_called_once_with("usr_abc")
    ledger_service.record_welcome_bonus.assert_called_once_with("wal_xyz")
    ledger_service.get_wallet_balance.assert_called_once_with("wal_xyz")

    assert isinstance(result, RegistrationSummary)
    assert result.user_id == "usr_abc"
    assert result.username == "alice"
    assert isinstance(result.wallet, RegisteredWalletSummary)
    assert result.wallet.id == "wal_xyz"
    assert result.wallet.currency == "COP"
    assert result.wallet.balance == WELCOME_BONUS_AMOUNT


def test_register_stops_when_username_already_exists(
    registration_service, auth_service, wallet_service, ledger_service
):
    auth_service.register.side_effect = UsernameAlreadyExistsError()

    with pytest.raises(UsernameAlreadyExistsError):
        registration_service.register("alice", "password123")

    wallet_service.create_wallet.assert_not_called()
    ledger_service.record_welcome_bonus.assert_not_called()
    ledger_service.get_wallet_balance.assert_not_called()
