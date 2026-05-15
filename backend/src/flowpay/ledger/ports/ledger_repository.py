from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class TransactionRecord:
    id: str
    wallet_id: str
    type: str  # 'credit' or 'debit'
    amount: int  # positive integer COP
    currency: str  # always 'COP'
    source: str  # 'welcome_bonus', 'manual_transfer', 'nfc_transfer', 'topup'
    operation_id: str | None
    counterparty_wallet_id: str | None
    created_at: datetime


@dataclass
class TransactionWithCounterparty:
    """Transaction with resolved counterparty username for history display."""
    id: str
    wallet_id: str
    type: str
    amount: int
    currency: str
    source: str
    operation_id: str | None
    counterparty_wallet_id: str | None
    counterparty_username: str | None  # populated by repository join
    created_at: datetime


class LedgerRepository(Protocol):
    def create_entry(
        self,
        transaction_id: str,
        wallet_id: str,
        type: str,
        amount: int,
        source: str,
        operation_id: str | None = None,
        counterparty_wallet_id: str | None = None,
    ) -> TransactionRecord:
        """Persist an approved ledger entry.

        This low-level write method is for ledger application use cases only.
        HTTP adapters and other modules must not call repositories directly.
        """
        ...

    def get_by_wallet_id(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0,
        transaction_type: str | None = None,
    ) -> list[TransactionWithCounterparty]:
        """Get transactions for a wallet, ordered newest-first, optionally filtered by type."""
        ...

    def calculate_balance(self, wallet_id: str) -> int:
        """Calculate wallet balance from transactions."""
        ...
