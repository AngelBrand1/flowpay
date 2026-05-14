from flowpay.auth.adapters.password_hasher import hash_password, verify_password


def test_hash_is_not_plain_text():
    """Test that hash is not the plain text password."""
    password = "mypassword123"
    hashed = hash_password(password)

    assert hashed != password
    assert len(hashed) > 0


def test_correct_password_verifies():
    """Test that the correct password verifies successfully."""
    password = "mypassword123"
    hashed = hash_password(password)

    assert verify_password(password, hashed)


def test_wrong_password_fails():
    """Test that the wrong password fails verification."""
    password = "mypassword123"
    wrong_password = "wrongpassword"
    hashed = hash_password(password)

    assert not verify_password(wrong_password, hashed)
