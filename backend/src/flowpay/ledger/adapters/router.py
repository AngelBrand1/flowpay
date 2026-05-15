from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from flowpay.auth.adapters.dependencies import get_current_user_id
from flowpay.composition import build_ledger_service, build_wallet_service
from flowpay.database import get_db
from flowpay.shared.errors import FlowPayHTTPError

router = APIRouter()


class WalletResponse(BaseModel):
    id: str
    currency: str
    balance: int


class TransactionResponse(BaseModel):
    id: str
    type: str
    amount: int
    currency: str
    source: str
    operation_id: str | None
    counterparty: dict | None  # {"wallet_id": "wal_123", "username": "bob"} or null
    created_at: str


class WalletHistoryResponse(BaseModel):
    transactions: list[TransactionResponse]
    next_cursor: str | None


class WalletEnvelope(BaseModel):
    wallet: WalletResponse


class TopUpRequest(BaseModel):
    amount: int


class TopUpResponse(BaseModel):
    transaction: TransactionResponse


@router.get("/wallet", response_model=WalletEnvelope)
def get_wallet(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> WalletEnvelope:
    wallet_service = build_wallet_service(db)
    ledger_service = build_ledger_service(db)

    wallet_summary = wallet_service.get_by_user_id(current_user_id)
    if wallet_summary is None:
        raise FlowPayHTTPError(
            code="wallet_not_found",
            message="Wallet not found",
            status_code=404,
        )

    balance = ledger_service.get_wallet_balance(wallet_summary.id)

    return WalletEnvelope(
        wallet=WalletResponse(
            id=wallet_summary.id,
            currency=wallet_summary.currency,
            balance=balance.balance,
        )
    )


@router.post("/wallet/topup", response_model=TopUpResponse, status_code=201)
def topup_wallet(
    body: TopUpRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> TopUpResponse:
    wallet_service = build_wallet_service(db)
    ledger_service = build_ledger_service(db)

    wallet_summary = wallet_service.get_by_user_id(current_user_id)
    if wallet_summary is None:
        raise FlowPayHTTPError(
            code="wallet_not_found",
            message="Wallet not found",
            status_code=404,
        )

    try:
        txn = ledger_service.record_topup(wallet_summary.id, body.amount)
    except ValueError as exc:
        raise FlowPayHTTPError(code="invalid_amount", message=str(exc), status_code=400)

    return TopUpResponse(
        transaction=TransactionResponse(
            id=txn.id,
            type=txn.type,
            amount=txn.amount,
            currency=txn.currency,
            source=txn.source,
            operation_id=txn.operation_id,
            counterparty=None,
            created_at=txn.created_at,
        )
    )


@router.get("/wallet/transactions", response_model=WalletHistoryResponse)
def get_wallet_transactions(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    type: str | None = Query(None),
) -> WalletHistoryResponse:
    wallet_service = build_wallet_service(db)
    ledger_service = build_ledger_service(db)

    wallet_summary = wallet_service.get_by_user_id(current_user_id)
    if wallet_summary is None:
        raise FlowPayHTTPError(
            code="wallet_not_found",
            message="Wallet not found",
            status_code=404,
        )

    if type is not None and type not in ("credit", "debit"):
        raise FlowPayHTTPError(
            code="invalid_type",
            message="Type must be 'credit' or 'debit'",
            status_code=400,
        )

    offset = 0
    if cursor is not None:
        try:
            offset = int(cursor)
        except ValueError:
            raise FlowPayHTTPError(
                code="invalid_cursor",
                message="Invalid pagination cursor",
                status_code=400,
            )
        if offset < 0:
            raise FlowPayHTTPError(
                code="invalid_cursor",
                message="Invalid pagination cursor",
                status_code=400,
            )

    transactions = ledger_service.get_wallet_history(
        wallet_summary.id,
        limit=limit,
        offset=offset,
        transaction_type=type,
    )

    transaction_responses = []
    for txn in transactions:
        counterparty = None
        if txn.counterparty_wallet_id and txn.counterparty_username:
            counterparty = {
                "wallet_id": txn.counterparty_wallet_id,
                "username": txn.counterparty_username,
            }

        transaction_responses.append(
            TransactionResponse(
                id=txn.id,
                type=txn.type,
                amount=txn.amount,
                currency=txn.currency,
                source=txn.source,
                operation_id=txn.operation_id,
                counterparty=counterparty,
                created_at=txn.created_at,
            )
        )

    return WalletHistoryResponse(
        transactions=transaction_responses,
        next_cursor=str(offset + len(transactions)) if len(transactions) == limit else None,
    )
