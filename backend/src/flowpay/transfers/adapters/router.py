import hashlib
import json

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from flowpay.auth.adapters.dependencies import get_current_user_id
from flowpay.composition import build_transfer_service
from flowpay.database import get_db
from flowpay.shared.errors import FlowPayHTTPError
from flowpay.transfers.application.transfer_service import IdempotencyReplayError, TransferError

router = APIRouter()

_ERROR_STATUS = {
    "invalid_amount": 400,
    "same_wallet_transfer": 400,
    "source_wallet_not_found": 404,
    "destination_wallet_not_found": 404,
    "transfer_not_found": 404,
    "insufficient_balance": 409,
    "idempotency_key_conflict": 409,
}


class CreateTransferRequest(BaseModel):
    destination_wallet_id: str
    amount: int
    origin: str = "manual_transfer"


class TransferResponse(BaseModel):
    id: str
    source_wallet_id: str
    destination_wallet_id: str
    amount: int
    currency: str
    origin: str
    status: str
    created_at: str


class TransferEnvelope(BaseModel):
    transfer: TransferResponse


def _request_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


@router.post("/transfers", status_code=201)
def create_transfer(
    body: CreateTransferRequest,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if idempotency_key is None:
        raise FlowPayHTTPError(
            code="invalid_request",
            message="Idempotency-Key header is required",
            status_code=400,
        )

    request_hash = _request_hash(body.model_dump())

    service = build_transfer_service(db)
    try:
        summary = service.create_transfer(
            user_id=current_user_id,
            destination_wallet_id=body.destination_wallet_id,
            amount=body.amount,
            origin=body.origin,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
    except IdempotencyReplayError as e:
        return JSONResponse(status_code=e.response_status, content=e.response_body)
    except TransferError as e:
        status_code = _ERROR_STATUS.get(e.code, 400)
        raise FlowPayHTTPError(code=e.code, message=e.message, status_code=status_code)

    return TransferEnvelope(
        transfer=TransferResponse(
            id=summary.id,
            source_wallet_id=summary.source_wallet_id,
            destination_wallet_id=summary.destination_wallet_id,
            amount=summary.amount,
            currency=summary.currency,
            origin=summary.origin,
            status=summary.status,
            created_at=summary.created_at,
        )
    )


@router.get("/transfers/{transfer_id}", response_model=TransferEnvelope)
def get_transfer(
    transfer_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    service = build_transfer_service(db)
    try:
        summary = service.get_transfer(transfer_id=transfer_id, user_id=current_user_id)
    except TransferError as e:
        status_code = _ERROR_STATUS.get(e.code, 400)
        raise FlowPayHTTPError(code=e.code, message=e.message, status_code=status_code)

    return TransferEnvelope(
        transfer=TransferResponse(
            id=summary.id,
            source_wallet_id=summary.source_wallet_id,
            destination_wallet_id=summary.destination_wallet_id,
            amount=summary.amount,
            currency=summary.currency,
            origin=summary.origin,
            status=summary.status,
            created_at=summary.created_at,
        )
    )
