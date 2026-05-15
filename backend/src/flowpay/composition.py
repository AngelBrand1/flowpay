from sqlalchemy.orm import Session

from flowpay.auth.adapters.credentials_repository import SQLAlchemyCredentialsRepository
from flowpay.auth.adapters.password_hasher import hash_password, verify_password
from flowpay.auth.application.auth_service import AuthService
from flowpay.auth.application.registration_service import RegistrationService
from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
from flowpay.users.application.user_service import UserService
from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService
from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository
from flowpay.ledger.application.ledger_service import LedgerService
from flowpay.transfers.adapters.repositories import (
    SQLAlchemyIdempotencyRepository,
    SQLAlchemyTransferRepository,
)
from flowpay.transfers.application.transfer_service import TransferService


def build_auth_service(db: Session) -> AuthService:
    """Build and return an AuthService instance."""
    user_repository = SQLAlchemyUserRepository(db)
    credentials_repository = SQLAlchemyCredentialsRepository(db)
    user_service = UserService(user_repository)

    return AuthService(
        credentials_repository=credentials_repository,
        user_service=user_service,
        hash_fn=hash_password,
        verify_fn=verify_password,
    )


def build_user_service(db: Session) -> UserService:
    """Build and return a UserService instance."""
    user_repository = SQLAlchemyUserRepository(db)
    return UserService(user_repository)


def build_wallet_service(db: Session) -> WalletService:
    """Build and return a WalletService instance."""
    wallet_repository = SQLAlchemyWalletRepository(db)
    return WalletService(wallet_repository)


def build_ledger_service(db: Session) -> LedgerService:
    """Build and return a LedgerService instance."""
    ledger_repository = SQLAlchemyLedgerRepository(db)
    return LedgerService(ledger_repository)


def build_transfer_service(db: Session) -> TransferService:
    return TransferService(
        transfer_repository=SQLAlchemyTransferRepository(db),
        idempotency_repository=SQLAlchemyIdempotencyRepository(db),
        user_service=build_user_service(db),
        wallet_service=build_wallet_service(db),
        ledger_service=build_ledger_service(db),
    )


def build_registration_service(db: Session) -> RegistrationService:
    return RegistrationService(
        auth_service=build_auth_service(db),
        wallet_service=build_wallet_service(db),
        ledger_service=build_ledger_service(db),
    )
