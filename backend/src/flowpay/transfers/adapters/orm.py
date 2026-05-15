from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from flowpay.database import Base


class TransferOperation(Base):
    __tablename__ = "transfer_operations"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    source_wallet_id: Mapped[str] = mapped_column(Text, ForeignKey("wallets.id"), nullable=False)
    destination_wallet_id: Mapped[str] = mapped_column(Text, ForeignKey("wallets.id"), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    origin: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transfer_operations_amount_positive"),
        CheckConstraint("currency = 'COP'", name="ck_transfer_operations_currency_cop"),
        CheckConstraint(
            "origin IN ('manual_transfer', 'nfc_transfer')",
            name="ck_transfer_operations_origin",
        ),
        CheckConstraint(
            "status IN ('completed', 'failed')",
            name="ck_transfer_operations_status",
        ),
        CheckConstraint(
            "source_wallet_id <> destination_wallet_id",
            name="ck_transfer_operations_wallets_differ",
        ),
        Index("ix_transfer_operations_source_wallet", "source_wallet_id"),
        Index("ix_transfer_operations_destination_wallet", "destination_wallet_id"),
        Index("ix_transfer_operations_created_at", "created_at"),
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id"), nullable=False)
    key: Mapped[str] = mapped_column(Text, nullable=False)
    request_hash: Mapped[str] = mapped_column(Text, nullable=False)
    response_status: Mapped[int] = mapped_column(nullable=False)
    response_body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("uq_idempotency_keys_user_key", "user_id", "key", unique=True),
    )
