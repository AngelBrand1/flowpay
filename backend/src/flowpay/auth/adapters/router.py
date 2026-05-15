from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from flowpay.auth.adapters.dependencies import get_current_user_id
from flowpay.auth.application.auth_service import InvalidCredentialsError
from flowpay.composition import build_auth_service, build_registration_service
from flowpay.database import get_db
from flowpay.shared.errors import FlowPayHTTPError
from flowpay.users.application.user_service import UsernameAlreadyExistsError

router = APIRouter()


class UserResponse(BaseModel):
    id: str
    username: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class WalletRegistrationResponse(BaseModel):
    id: str
    currency: str
    balance: int


class RegisterResponse(BaseModel):
    user: UserResponse
    wallet: WalletRegistrationResponse


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserResponse


class MeResponse(BaseModel):
    user: UserResponse


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    registration_service = build_registration_service(db)
    try:
        summary = registration_service.register(request.username, request.password)
    except UsernameAlreadyExistsError:
        raise FlowPayHTTPError(
            code="username_already_exists",
            message="Username is already taken",
            status_code=409,
        )
    return RegisterResponse(
        user=UserResponse(id=summary.user_id, username=summary.username),
        wallet=WalletRegistrationResponse(
            id=summary.wallet.id,
            currency=summary.wallet.currency,
            balance=summary.wallet.balance,
        ),
    )


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Log in a user."""
    from flowpay.auth.adapters.jwt_handler import create_access_token
    from flowpay.config import settings

    auth_service = build_auth_service(db)
    try:
        user_summary = auth_service.login(request.username, request.password)
    except InvalidCredentialsError:
        raise FlowPayHTTPError(
            code="invalid_credentials",
            message="Invalid username or password",
            status_code=401,
        )

    access_token = create_access_token(user_summary.id, settings.auth_secret_key)
    return LoginResponse(
        access_token=access_token,
        user=UserResponse(id=user_summary.id, username=user_summary.username),
    )


@router.get("/me", response_model=MeResponse)
def get_me(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> MeResponse:
    """Get current authenticated user."""
    auth_service = build_auth_service(db)
    user_summary = auth_service.get_by_id(current_user_id)
    if user_summary is None:
        raise FlowPayHTTPError(
            code="user_not_found",
            message="User not found",
            status_code=404,
        )
    return MeResponse(
        user=UserResponse(id=user_summary.id, username=user_summary.username)
    )
