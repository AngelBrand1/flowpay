from sqlalchemy.orm import Session

from flowpay.auth.adapters.credentials_repository import SQLAlchemyCredentialsRepository
from flowpay.auth.adapters.password_hasher import hash_password, verify_password
from flowpay.auth.application.auth_service import AuthService
from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
from flowpay.users.application.user_service import UserService


def build_auth_service(db: Session) -> AuthService:
    """Build and return an AuthService instance."""
    user_repository = SQLAlchemyUserRepository(db)
    credentials_repository = SQLAlchemyCredentialsRepository(db)
    user_service = UserService(user_repository)

    return AuthService(
        credentials_repository=credentials_repository,
        user_service=user_service,
        hash_fn=hash_password,
        verify_fn=verify_password,
    )
