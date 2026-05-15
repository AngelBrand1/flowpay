from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from flowpay.database import Base


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    wallet_id: Mapped[str] = mapped_column(Text, ForeignKey("wallets.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'credit' or 'debit'
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)  # always 'COP'
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # transfers owns transfer_operations; FK added when that table exists
    operation_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    counterparty_wallet_id: Mapped[str | None] = mapped_column(Text, ForeignKey("wallets.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_ledger_transactions_amount_positive"),
        CheckConstraint("currency = 'COP'", name="ck_ledger_transactions_currency_cop"),
        CheckConstraint("type IN ('credit', 'debit')", name="ck_ledger_transactions_type"),
        CheckConstraint(
            "source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer', 'topup')",
            name="ck_ledger_transactions_source",
        ),
        CheckConstraint(
            "(type = 'credit' AND source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer', 'topup')) "
            "OR (type = 'debit' AND source IN ('manual_transfer', 'nfc_transfer'))",
            name="ck_ledger_transactions_type_source",
        ),
        CheckConstraint(
            "(source IN ('welcome_bonus', 'topup') AND operation_id IS NULL) "
            "OR (source IN ('manual_transfer', 'nfc_transfer') AND operation_id IS NOT NULL)",
            name="ck_ledger_transactions_operation_reference",
        ),
        Index("ix_ledger_transactions_wallet_created", "wallet_id", "created_at"),
        Index("ix_ledger_transactions_operation_id", "operation_id"),
        Index(
            "uq_ledger_transactions_welcome_bonus_wallet",
            "wallet_id",
            unique=True,
            postgresql_where=text("source = 'welcome_bonus'"),
        ),
    )

    def __repr__(self):
        return f"<LedgerTransaction(id={self.id}, wallet_id={self.wallet_id}, type={self.type}, amount={self.amount})>"
