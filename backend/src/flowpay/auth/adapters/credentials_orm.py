from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from flowpay.database import Base


class AuthCredentials(Base):
    __tablename__ = "auth_credentials"

    user_id: Mapped[str] = mapped_column(
        Text, ForeignKey("users.id"), primary_key=True
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __repr__(self):
        return f"<AuthCredentials(user_id={self.user_id})>"
