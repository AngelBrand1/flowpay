from datetime import datetime, timedelta, timezone

import pytest
from jose import JWTError

from flowpay.auth.adapters.jwt_handler import create_access_token, decode_access_token


def test_valid_token_round_trips_user_id():
    """Test that a valid token round-trips the user ID."""
    user_id = "usr_test123"
    secret_key = "test-secret-key"

    token = create_access_token(user_id, secret_key)
    decoded_user_id = decode_access_token(token, secret_key)

    assert decoded_user_id == user_id


def test_expired_token_raises():
    """Test that an expired token raises an error."""
    from jose import jwt

    from flowpay.auth.adapters.jwt_handler import TOKEN_ALGORITHM

    user_id = "usr_test123"
    secret_key = "test-secret-key"

    # Create a token with exp in the past
    now = datetime.now(timezone.utc)
    expired_time = int((now - timedelta(seconds=1)).timestamp())
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": expired_time,
    }
    expired_token = jwt.encode(payload, secret_key, algorithm=TOKEN_ALGORITHM)

    with pytest.raises(JWTError):
        decode_access_token(expired_token, secret_key)


def test_malformed_token_raises():
    """Test that a malformed token raises an error."""
    secret_key = "test-secret-key"

    with pytest.raises(JWTError):
        decode_access_token("not.a.valid.token", secret_key)


def test_tampered_token_raises():
    """Test that a tampered token raises an error."""
    user_id = "usr_test123"
    secret_key = "test-secret-key"
    wrong_secret = "wrong-secret-key"

    token = create_access_token(user_id, secret_key)

    # Try to decode with the wrong secret key
    with pytest.raises(JWTError):
        decode_access_token(token, wrong_secret)


def test_decoded_token_comes_from_sub():
    """Test that the decoded user ID comes from the 'sub' claim."""
    user_id = "usr_test123"
    secret_key = "test-secret-key"

    token = create_access_token(user_id, secret_key)
    decoded_user_id = decode_access_token(token, secret_key)

    assert decoded_user_id == user_id
