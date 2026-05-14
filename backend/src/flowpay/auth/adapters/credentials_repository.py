from datetime import datetime, timezone

from sqlalchemy.orm import Session

from flowpay.auth.adapters.credentials_orm import AuthCredentials
from flowpay.auth.ports.credentials_repository import CredentialsRepository


class SQLAlchemyCredentialsRepository(CredentialsRepository):
    def __init__(self, session: Session):
        self.session = session

    def create(self, user_id: str, password_hash: str) -> None:
        """Create credentials for a user."""
        now = datetime.now(timezone.utc)
        credentials = AuthCredentials(
            user_id=user_id,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
        )
        self.session.add(credentials)
        self.session.flush()

    def get_password_hash(self, user_id: str) -> str | None:
        """Get password hash for a user."""
        credentials = (
            self.session.query(AuthCredentials)
            .filter(AuthCredentials.user_id == user_id)
            .first()
        )
        if credentials is None:
            return None
        return credentials.password_hash
