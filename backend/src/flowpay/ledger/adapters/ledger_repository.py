from datetime import datetime, timezone

from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session, aliased

from flowpay.ledger.adapters.ledger_orm import LedgerTransaction
from flowpay.ledger.ports.ledger_repository import (
    LedgerRepository,
    TransactionRecord,
    TransactionWithCounterparty,
)
from flowpay.users.adapters.user_orm import User
from flowpay.wallets.adapters.wallet_orm import Wallet


class SQLAlchemyLedgerRepository(LedgerRepository):
    def __init__(self, session: Session):
        self.session = session

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
        transaction = LedgerTransaction(
            id=transaction_id,
            wallet_id=wallet_id,
            type=type,
            amount=amount,
            currency="COP",
            source=source,
            operation_id=operation_id,
            counterparty_wallet_id=counterparty_wallet_id,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(transaction)
        self.session.flush()

        return TransactionRecord(
            id=transaction.id,
            wallet_id=transaction.wallet_id,
            type=transaction.type,
            amount=transaction.amount,
            currency=transaction.currency,
            source=transaction.source,
            operation_id=transaction.operation_id,
            counterparty_wallet_id=transaction.counterparty_wallet_id,
            created_at=transaction.created_at,
        )

    def get_by_wallet_id(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0,
        transaction_type: str | None = None,
    ) -> list[TransactionWithCounterparty]:
        CounterpartyWallet = aliased(Wallet)
        query = (
            self.session.query(LedgerTransaction, User.username)
            .outerjoin(
                CounterpartyWallet,
                LedgerTransaction.counterparty_wallet_id == CounterpartyWallet.id,
            )
            .outerjoin(User, CounterpartyWallet.user_id == User.id)
            .filter(LedgerTransaction.wallet_id == wallet_id)
        )
        if transaction_type is not None:
            query = query.filter(LedgerTransaction.type == transaction_type)

        rows = (
            query
            .order_by(desc(LedgerTransaction.created_at), desc(LedgerTransaction.id))
            .limit(limit)
            .offset(offset)
            .all()
        )

        return [
            TransactionWithCounterparty(
                id=txn.id,
                wallet_id=txn.wallet_id,
                type=txn.type,
                amount=txn.amount,
                currency=txn.currency,
                source=txn.source,
                operation_id=txn.operation_id,
                counterparty_wallet_id=txn.counterparty_wallet_id,
                counterparty_username=counterparty_username,
                created_at=txn.created_at,
            )
            for txn, counterparty_username in rows
        ]

    def calculate_balance(self, wallet_id: str) -> int:
        result = self.session.query(
            func.coalesce(
                func.sum(
                    case(
                        (LedgerTransaction.type == "credit", LedgerTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            ) - func.coalesce(
                func.sum(
                    case(
                        (LedgerTransaction.type == "debit", LedgerTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            )
        ).filter(
            LedgerTransaction.wallet_id == wallet_id
        ).scalar()

        return result or 0
