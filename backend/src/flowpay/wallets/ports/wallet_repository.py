from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class WalletRecord:
    id: str
    user_id: str
    currency: str
    created_at: datetime


class WalletRepository(Protocol):
    def create(self, wallet_id: str, user_id: str, currency: str) -> WalletRecord:
        """Create a new wallet."""
        ...

    def get_by_id(self, wallet_id: str) -> WalletRecord | None:
        """Get wallet by ID."""
        ...

    def get_by_user_id(self, user_id: str) -> WalletRecord | None:
        """Get wallet by user ID."""
        ...

    def lock_by_user_id(self, user_id: str) -> WalletRecord | None:
        """Acquire SELECT ... FOR UPDATE on the user's wallet row."""
        ...
