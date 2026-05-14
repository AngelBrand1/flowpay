from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

TOKEN_ALGORITHM = "HS256"
TOKEN_EXPIRY_SECONDS = 3600


def create_access_token(user_id: str, secret_key: str) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=TOKEN_EXPIRY_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, secret_key, algorithm=TOKEN_ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> str:
    """Decode a JWT access token and return the user ID (sub)."""
    try:
        payload = jwt.decode(token, secret_key, algorithms=[TOKEN_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise JWTError("Missing sub claim")
        return user_id
    except JWTError:
        raise
