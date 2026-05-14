from typing import Protocol


class CredentialsRepository(Protocol):
    def create(self, user_id: str, password_hash: str) -> None:
        """Create credentials for a user."""
        ...

    def get_password_hash(self, user_id: str) -> str | None:
        """Get password hash for a user."""
        ...
