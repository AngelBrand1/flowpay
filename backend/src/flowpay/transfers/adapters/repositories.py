from datetime import datetime, timezone

from sqlalchemy.orm import Session

from flowpay.transfers.adapters.orm import IdempotencyKey, TransferOperation
from flowpay.transfers.ports.repositories import IdempotencyRecord, TransferRecord


class SQLAlchemyTransferRepository:
    def __init__(self, session: Session):
        self.session = session

    def insert(
        self,
        transfer_id: str,
        source_wallet_id: str,
        destination_wallet_id: str,
        amount: int,
        origin: str,
    ) -> TransferRecord:
        op = TransferOperation(
            id=transfer_id,
            source_wallet_id=source_wallet_id,
            destination_wallet_id=destination_wallet_id,
            amount=amount,
            currency="COP",
            origin=origin,
            status="completed",
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(op)
        self.session.flush()
        return TransferRecord(
            id=op.id,
            source_wallet_id=op.source_wallet_id,
            destination_wallet_id=op.destination_wallet_id,
            amount=op.amount,
            currency=op.currency,
            origin=op.origin,
            status=op.status,
            created_at=op.created_at,
        )

    def get_by_id(self, transfer_id: str) -> TransferRecord | None:
        op = self.session.query(TransferOperation).filter(TransferOperation.id == transfer_id).first()
        if op is None:
            return None
        return TransferRecord(
            id=op.id,
            source_wallet_id=op.source_wallet_id,
            destination_wallet_id=op.destination_wallet_id,
            amount=op.amount,
            currency=op.currency,
            origin=op.origin,
            status=op.status,
            created_at=op.created_at,
        )


class SQLAlchemyIdempotencyRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, user_id: str, key: str) -> IdempotencyRecord | None:
        row = (
            self.session.query(IdempotencyKey)
            .filter(IdempotencyKey.user_id == user_id, IdempotencyKey.key == key)
            .first()
        )
        if row is None:
            return None
        return IdempotencyRecord(
            id=row.id,
            user_id=row.user_id,
            key=row.key,
            request_hash=row.request_hash,
            response_status=row.response_status,
            response_body=row.response_body,
            created_at=row.created_at,
        )

    def store(
        self,
        idempotency_id: str,
        user_id: str,
        key: str,
        request_hash: str,
        response_status: int,
        response_body: dict,
    ) -> IdempotencyRecord:
        row = IdempotencyKey(
            id=idempotency_id,
            user_id=user_id,
            key=key,
            request_hash=request_hash,
            response_status=response_status,
            response_body=response_body,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(row)
        self.session.flush()
        return IdempotencyRecord(
            id=row.id,
            user_id=row.user_id,
            key=row.key,
            request_hash=row.request_hash,
            response_status=row.response_status,
            response_body=row.response_body,
            created_at=row.created_at,
        )
