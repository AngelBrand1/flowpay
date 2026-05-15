import dataclasses
from dataclasses import dataclass

from flowpay.shared.ids import generate_id
from flowpay.transfers.ports.repositories import IdempotencyRepository, TransferRepository


@dataclass
class TransferError(Exception):
    code: str
    message: str


@dataclass
class IdempotencyReplayError(Exception):
    response_status: int
    response_body: dict


@dataclass
class TransferSummary:
    id: str
    source_wallet_id: str
    destination_wallet_id: str
    amount: int
    currency: str
    origin: str
    status: str
    created_at: str


class TransferService:
    def __init__(
        self,
        transfer_repository: TransferRepository,
        idempotency_repository: IdempotencyRepository,
        wallet_service,
        ledger_service,
    ):
        self.transfer_repository = transfer_repository
        self.idempotency_repository = idempotency_repository
        self.wallet_service = wallet_service
        self.ledger_service = ledger_service

    def create_transfer(
        self,
        user_id: str,
        destination_wallet_id: str,
        amount: int,
        origin: str,
        idempotency_key: str,
        request_hash: str,
    ) -> TransferSummary:
        if amount <= 0:
            raise TransferError(code="invalid_amount", message="Transfer amount must be positive")

        # Lock source wallet first — must happen before any balance reads
        source_wallet = self.wallet_service.lock_by_user_id(user_id)
        if source_wallet is None:
            raise TransferError(code="source_wallet_not_found", message="Source wallet not found")

        if source_wallet.id == destination_wallet_id:
            raise TransferError(
                code="same_wallet_transfer",
                message="Source and destination wallets must differ",
            )

        destination_wallet = self.wallet_service.get_by_id(destination_wallet_id)
        if destination_wallet is None:
            raise TransferError(
                code="destination_wallet_not_found",
                message="Destination wallet not found",
            )

        # Check idempotency after acquiring the lock
        existing = self.idempotency_repository.get(user_id, idempotency_key)
        if existing is not None:
            if existing.request_hash != request_hash:
                raise TransferError(
                    code="idempotency_key_conflict",
                    message="Idempotency key already used with a different request",
                )
            raise IdempotencyReplayError(
                response_status=existing.response_status,
                response_body=existing.response_body,
            )

        balance = self.ledger_service.get_wallet_balance(source_wallet.id)
        if balance.balance < amount:
            raise TransferError(code="insufficient_balance", message="Insufficient balance")

        operation_id = generate_id("txop_")
        transfer = self.transfer_repository.insert(
            transfer_id=operation_id,
            source_wallet_id=source_wallet.id,
            destination_wallet_id=destination_wallet_id,
            amount=amount,
            origin=origin,
        )

        self.ledger_service.record_transfer_entries(
            operation_id=operation_id,
            source_wallet_id=source_wallet.id,
            destination_wallet_id=destination_wallet_id,
            amount=amount,
            source=origin,
        )

        summary = TransferSummary(
            id=transfer.id,
            source_wallet_id=transfer.source_wallet_id,
            destination_wallet_id=transfer.destination_wallet_id,
            amount=transfer.amount,
            currency=transfer.currency,
            origin=transfer.origin,
            status=transfer.status,
            created_at=transfer.created_at.isoformat(),
        )

        self.idempotency_repository.store(
            idempotency_id=generate_id("idmp_"),
            user_id=user_id,
            key=idempotency_key,
            request_hash=request_hash,
            response_status=201,
            response_body=dataclasses.asdict(summary),
        )

        return summary

    def get_transfer(self, transfer_id: str, user_id: str) -> TransferSummary:
        transfer = self.transfer_repository.get_by_id(transfer_id)
        if transfer is None:
            raise TransferError(code="transfer_not_found", message="Transfer not found")

        # Only source or destination participants may access the transfer
        source_wallet = self.wallet_service.get_by_user_id(user_id)
        if source_wallet is None:
            raise TransferError(code="transfer_not_found", message="Transfer not found")

        if source_wallet.id not in (transfer.source_wallet_id, transfer.destination_wallet_id):
            raise TransferError(code="transfer_not_found", message="Transfer not found")

        return TransferSummary(
            id=transfer.id,
            source_wallet_id=transfer.source_wallet_id,
            destination_wallet_id=transfer.destination_wallet_id,
            amount=transfer.amount,
            currency=transfer.currency,
            origin=transfer.origin,
            status=transfer.status,
            created_at=transfer.created_at.isoformat(),
        )
