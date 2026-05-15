from dataclasses import dataclass

from flowpay.shared.ids import generate_id
from flowpay.wallets.ports.wallet_repository import WalletRepository


@dataclass
class WalletSummary:
    id: str
    user_id: str
    currency: str
    created_at: str


class WalletService:
    def __init__(self, repository: WalletRepository):
        self.repository = repository

    def create_wallet(self, user_id: str) -> WalletSummary:
        """Create a new wallet for a user."""
        wallet_id = generate_id("wal_")
        record = self.repository.create(wallet_id, user_id, "COP")
        return WalletSummary(
            id=record.id,
            user_id=record.user_id,
            currency=record.currency,
            created_at=record.created_at.isoformat(),
        )

    def get_by_id(self, wallet_id: str) -> WalletSummary | None:
        """Get wallet by ID."""
        record = self.repository.get_by_id(wallet_id)
        if record is None:
            return None
        return WalletSummary(
            id=record.id,
            user_id=record.user_id,
            currency=record.currency,
            created_at=record.created_at.isoformat(),
        )

    def get_by_user_id(self, user_id: str) -> WalletSummary | None:
        """Get wallet by user ID."""
        record = self.repository.get_by_user_id(user_id)
        if record is None:
            return None
        return WalletSummary(
            id=record.id,
            user_id=record.user_id,
            currency=record.currency,
            created_at=record.created_at.isoformat(),
        )
