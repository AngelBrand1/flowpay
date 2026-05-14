from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


class UsernameConflictError(Exception):
    """Raised when username already exists."""

    pass


@dataclass
class UserRecord:
    id: str
    username: str
    created_at: datetime


class UserRepository(Protocol):
    def create(self, user_id: str, username: str) -> UserRecord:
        """Create a new user."""
        ...

    def get_by_id(self, user_id: str) -> UserRecord | None:
        """Get user by ID."""
        ...

    def get_by_username(self, username: str) -> UserRecord | None:
        """Get user by username."""
        ...
