from fastapi import Depends
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from jose import JWTError

from flowpay.auth.adapters.jwt_handler import decode_access_token
from flowpay.config import settings
from flowpay.shared.errors import FlowPayHTTPError

security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    """Get the current user ID from the authorization header."""
    if credentials is None:
        raise FlowPayHTTPError(
            code="unauthenticated",
            message="Missing or invalid token",
            status_code=401,
        )

    try:
        user_id = decode_access_token(credentials.credentials, settings.auth_secret_key)
        return user_id
    except JWTError:
        raise FlowPayHTTPError(
            code="unauthenticated",
            message="Invalid or expired token",
            status_code=401,
        )
