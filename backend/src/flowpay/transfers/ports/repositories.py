from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class TransferRecord:
    id: str
    source_wallet_id: str
    destination_wallet_id: str
    amount: int
    currency: str
    origin: str
    status: str
    created_at: datetime


@dataclass
class IdempotencyRecord:
    id: str
    user_id: str
    key: str
    request_hash: str
    response_status: int
    response_body: dict
    created_at: datetime


class TransferRepository(Protocol):
    def insert(
        self,
        transfer_id: str,
        source_wallet_id: str,
        destination_wallet_id: str,
        amount: int,
        origin: str,
    ) -> TransferRecord:
        ...

    def get_by_id(self, transfer_id: str) -> TransferRecord | None:
        ...


class IdempotencyRepository(Protocol):
    def get(self, user_id: str, key: str) -> IdempotencyRecord | None:
        ...

    def store(
        self,
        idempotency_id: str,
        user_id: str,
        key: str,
        request_hash: str,
        response_status: int,
        response_body: dict,
    ) -> IdempotencyRecord:
        ...
