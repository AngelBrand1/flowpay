from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from flowpay.users.adapters.user_orm import User
from flowpay.users.ports.user_repository import (
    UsernameConflictError,
    UserRecord,
    UserRepository,
)


class SQLAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session):
        self.session = session

    def create(self, user_id: str, username: str) -> UserRecord:
        """Create a new user."""
        user = User(
            id=user_id,
            username=username,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(user)
        try:
            self.session.flush()
        except IntegrityError as e:
            raise UsernameConflictError(f"Username {username} already exists") from e

        return UserRecord(
            id=user.id,
            username=user.username,
            created_at=user.created_at,
        )

    def get_by_id(self, user_id: str) -> UserRecord | None:
        """Get user by ID."""
        user = self.session.query(User).filter(User.id == user_id).first()
        if user is None:
            return None
        return UserRecord(
            id=user.id,
            username=user.username,
            created_at=user.created_at,
        )

    def get_by_username(self, username: str) -> UserRecord | None:
        """Get user by username."""
        user = self.session.query(User).filter(User.username == username).first()
        if user is None:
            return None
        return UserRecord(
            id=user.id,
            username=user.username,
            created_at=user.created_at,
        )
