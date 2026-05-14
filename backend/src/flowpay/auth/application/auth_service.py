from typing import Callable

from flowpay.auth.ports.credentials_repository import CredentialsRepository
from flowpay.users.application.user_service import (
    UsernameAlreadyExistsError,
    UserService,
    UserSummary,
)


class InvalidCredentialsError(Exception):
    """Raised when credentials are invalid."""

    pass


class AuthService:
    def __init__(
        self,
        credentials_repository: CredentialsRepository,
        user_service: UserService,
        hash_fn: Callable[[str], str],
        verify_fn: Callable[[str, str], bool],
    ):
        self.credentials_repository = credentials_repository
        self.user_service = user_service
        self.hash_fn = hash_fn
        self.verify_fn = verify_fn

    def register(self, username: str, password: str) -> UserSummary:
        """Register a new user."""
        # Create user first
        try:
            user_summary = self.user_service.create_user(username)
        except UsernameAlreadyExistsError:
            raise

        # Hash password and store credentials
        password_hash = self.hash_fn(password)
        self.credentials_repository.create(user_summary.id, password_hash)

        return user_summary

    def login(self, username: str, password: str) -> UserSummary:
        """Authenticate a user."""
        # Get user by username
        user_summary = self.user_service.get_by_username(username)
        if user_summary is None:
            raise InvalidCredentialsError("Invalid username or password")

        # Get and verify password hash
        password_hash = self.credentials_repository.get_password_hash(user_summary.id)
        if password_hash is None:
            raise InvalidCredentialsError("Invalid username or password")

        if not self.verify_fn(password, password_hash):
            raise InvalidCredentialsError("Invalid username or password")

        return user_summary

    def get_by_id(self, user_id: str) -> UserSummary | None:
        """Get user by ID."""
        return self.user_service.get_by_id(user_id)
