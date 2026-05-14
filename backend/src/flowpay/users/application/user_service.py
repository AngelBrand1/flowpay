from dataclasses import dataclass

from flowpay.shared.ids import generate_id
from flowpay.users.ports.user_repository import (
    UsernameConflictError,
    UserRepository,
)


class UsernameAlreadyExistsError(Exception):
    """Raised when username is already taken."""

    pass


@dataclass
class UserSummary:
    id: str
    username: str


class UserService:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def create_user(self, username: str) -> UserSummary:
        """Create a new user."""
        user_id = generate_id("usr_")
        try:
            record = self.repository.create(user_id, username)
        except UsernameConflictError as e:
            raise UsernameAlreadyExistsError(f"Username {username} already exists") from e
        return UserSummary(id=record.id, username=record.username)

    def get_by_id(self, user_id: str) -> UserSummary | None:
        """Get user by ID."""
        record = self.repository.get_by_id(user_id)
        if record is None:
            return None
        return UserSummary(id=record.id, username=record.username)

    def get_by_username(self, username: str) -> UserSummary | None:
        """Get user by username."""
        record = self.repository.get_by_username(username)
        if record is None:
            return None
        return UserSummary(id=record.id, username=record.username)
