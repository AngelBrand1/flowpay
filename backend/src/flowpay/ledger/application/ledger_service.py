from dataclasses import dataclass

from flowpay.shared.ids import generate_id
from flowpay.ledger.ports.ledger_repository import (
    LedgerRepository,
    TransactionRecord,
)

WELCOME_BONUS_AMOUNT = 50_000


@dataclass
class TransactionSummary:
    id: str
    wallet_id: str
    type: str
    amount: int
    currency: str
    source: str
    operation_id: str | None
    counterparty_wallet_id: str | None
    counterparty_username: str | None
    created_at: str  # ISO format


@dataclass
class WalletBalance:
    wallet_id: str
    balance: int  # amount in COP
    currency: str


class LedgerService:
    def __init__(self, repository: LedgerRepository):
        self.repository = repository

    def record_welcome_bonus(self, wallet_id: str) -> TransactionSummary:
        """Record the one-time wallet welcome bonus."""
        transaction_id = generate_id("txn_")
        record = self.repository.create_entry(
            transaction_id=transaction_id,
            wallet_id=wallet_id,
            type="credit",
            amount=WELCOME_BONUS_AMOUNT,
            source="welcome_bonus",
            operation_id=None,
            counterparty_wallet_id=None,
        )
        return TransactionSummary(
            id=record.id,
            wallet_id=record.wallet_id,
            type=record.type,
            amount=record.amount,
            currency=record.currency,
            source=record.source,
            operation_id=record.operation_id,
            counterparty_wallet_id=record.counterparty_wallet_id,
            counterparty_username=None,
            created_at=record.created_at.isoformat(),
        )

    def record_transfer_entries(
        self,
        operation_id: str,
        source_wallet_id: str,
        destination_wallet_id: str,
        amount: int,
        source: str,
    ) -> tuple[TransactionSummary, TransactionSummary]:
        """Record the debit and credit for an already-approved transfer.

        The transfers module owns validation, idempotency, wallet locking, and
        TransferOperation creation. This method only persists the two ledger
        entries inside the caller's database transaction.
        """
        debit = self.repository.create_entry(
            transaction_id=generate_id("txn_"),
            wallet_id=source_wallet_id,
            type="debit",
            amount=amount,
            source=source,
            operation_id=operation_id,
            counterparty_wallet_id=destination_wallet_id,
        )
        credit = self.repository.create_entry(
            transaction_id=generate_id("txn_"),
            wallet_id=destination_wallet_id,
            type="credit",
            amount=amount,
            source=source,
            operation_id=operation_id,
            counterparty_wallet_id=source_wallet_id,
        )
        return (
            self._to_summary(debit),
            self._to_summary(credit),
        )

    def get_wallet_balance(self, wallet_id: str) -> WalletBalance:
        """Get the calculated balance for a wallet."""
        balance = self.repository.calculate_balance(wallet_id)
        return WalletBalance(
            wallet_id=wallet_id,
            balance=balance,
            currency="COP",
        )

    def get_wallet_history(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0,
        transaction_type: str | None = None,
    ) -> list[TransactionSummary]:
        """Get transaction history for a wallet, optionally filtered by type."""
        records = self.repository.get_by_wallet_id(
            wallet_id, limit, offset, transaction_type=transaction_type
        )
        return [
            TransactionSummary(
                id=record.id,
                wallet_id=record.wallet_id,
                type=record.type,
                amount=record.amount,
                currency=record.currency,
                source=record.source,
                operation_id=record.operation_id,
                counterparty_wallet_id=record.counterparty_wallet_id,
                counterparty_username=record.counterparty_username,
                created_at=record.created_at.isoformat(),
            )
            for record in records
        ]

    def _to_summary(self, record: TransactionRecord) -> TransactionSummary:
        return TransactionSummary(
            id=record.id,
            wallet_id=record.wallet_id,
            type=record.type,
            amount=record.amount,
            currency=record.currency,
            source=record.source,
            operation_id=record.operation_id,
            counterparty_wallet_id=record.counterparty_wallet_id,
            counterparty_username=None,
            created_at=record.created_at.isoformat(),
        )
