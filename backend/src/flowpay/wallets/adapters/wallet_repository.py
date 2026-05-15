from datetime import datetime, timezone

from sqlalchemy.orm import Session

from flowpay.wallets.adapters.wallet_orm import Wallet
from flowpay.wallets.ports.wallet_repository import WalletRecord, WalletRepository


class SQLAlchemyWalletRepository(WalletRepository):
    def __init__(self, session: Session):
        self.session = session

    def create(self, wallet_id: str, user_id: str, currency: str) -> WalletRecord:
        """Create a new wallet."""
        wallet = Wallet(
            id=wallet_id,
            user_id=user_id,
            currency=currency,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(wallet)
        self.session.flush()

        return WalletRecord(
            id=wallet.id,
            user_id=wallet.user_id,
            currency=wallet.currency,
            created_at=wallet.created_at,
        )

    def get_by_id(self, wallet_id: str) -> WalletRecord | None:
        """Get wallet by ID."""
        wallet = self.session.query(Wallet).filter(Wallet.id == wallet_id).first()
        if wallet is None:
            return None
        return WalletRecord(
            id=wallet.id,
            user_id=wallet.user_id,
            currency=wallet.currency,
            created_at=wallet.created_at,
        )

    def get_by_user_id(self, user_id: str) -> WalletRecord | None:
        """Get wallet by user ID."""
        wallet = self.session.query(Wallet).filter(Wallet.user_id == user_id).first()
        if wallet is None:
            return None
        return WalletRecord(
            id=wallet.id,
            user_id=wallet.user_id,
            currency=wallet.currency,
            created_at=wallet.created_at,
        )

    def lock_by_user_id(self, user_id: str) -> WalletRecord | None:
        """Acquire SELECT ... FOR UPDATE on the user's wallet row."""
        wallet = (
            self.session.query(Wallet)
            .filter(Wallet.user_id == user_id)
            .with_for_update()
            .first()
        )
        if wallet is None:
            return None
        return WalletRecord(
            id=wallet.id,
            user_id=wallet.user_id,
            currency=wallet.currency,
            created_at=wallet.created_at,
        )
