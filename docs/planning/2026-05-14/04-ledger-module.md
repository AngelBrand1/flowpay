# FlowPay Backend - Ledger Module

## Overview

Implement the `ledger` backend module as the **owner of wallet transaction records and the read-layer for balances/history**. The ledger records append-only transactions (debits and credits) and derives wallet balances from transaction history. This module provides the financial foundation for balance queries and transaction history without implementing transfer orchestration or idempotency (those belong to the `transfers` module).

**Key scope boundary:** Ledger is a **read-heavy, append-only transaction ledger** with controlled write methods. It does NOT handle transfer orchestration, idempotency keys, or concurrent locking. Transfer writes must still be initiated by the `transfers` application use case; ledger only persists the approved debit/credit entries inside the caller's database transaction.

---

## Files Analyzed

### Core Domain & Architecture Files (Already Read)
1. `/Users/angelbrand/Workspace/Personal/flowpay/docs/specs/01-domain-rules.md` (194 lines)
   - Purpose: Domain business rules for transactions, balance, transfers
   - Key rules: Transaction amounts are positive; balance = sum(credit) - sum(debit); transactions are immutable
   
2. `/Users/angelbrand/Workspace/Personal/flowpay/docs/specs/03-domain-model.md` (216 lines)
   - Purpose: Conceptual entities and relationships
   - Key entities: Transaction (id, wallet_id, type, amount, source, operation_id, counterparty_wallet_id, created_at)
   - Rules: Amounts always positive; balance derived; transactions not modified

3. `/Users/angelbrand/Workspace/Personal/flowpay/docs/specs/04-api-contract.md` (421 lines)
   - Purpose: HTTP endpoint contracts
   - Key endpoints for ledger: `GET /wallet` (balance), `GET /wallet/transactions` (history with pagination)
   
4. `/Users/angelbrand/Workspace/Personal/flowpay/docs/specs/05-persistence-model.md` (268 lines)
   - Purpose: PostgreSQL schema and constraints
   - Key tables: `ledger_transactions` (id, wallet_id, type, amount, currency, source, operation_id, counterparty_wallet_id, created_at)
   - Indexes: `wallet_id, created_at desc`; unique partial on `welcome_bonus` per wallet
   - Balance query SQL provided (lines 238-243)

5. `/Users/angelbrand/Workspace/Personal/flowpay/docs/adr/0004-money-and-ledger-model.md` (194 lines)
   - Purpose: Ledger architecture decision
   - Key: Append-only model, derived balance, immutable transactions
   
6. `/Users/angelbrand/Workspace/Personal/flowpay/backend/src/flowpay/shared/errors.py` (9 lines)
   - Purpose: HTTP error base class
   - `FlowPayHTTPError(code, message, status_code=400)`

7. `/Users/angelbrand/Workspace/Personal/flowpay/backend/src/flowpay/auth/application/auth_service.py` (64 lines)
   - Purpose: Authentication service pattern (dependency injection, exceptions)
   - Pattern: `__init__` receives repositories, service logic in methods, raises domain exceptions

8. `/Users/angelbrand/Workspace/Personal/flowpay/backend/src/flowpay/auth/adapters/router.py` (108 lines)
   - Purpose: HTTP router pattern
   - Pattern: Pydantic models, build_*_service(), catch domain exceptions, raise FlowPayHTTPError

9. `/Users/angelbrand/Workspace/Personal/flowpay/backend/src/flowpay/composition.py` (25 lines)
   - Purpose: Service composition root
   - Pattern: `build_*_service(db: Session) -> Service`

10. `/Users/angelbrand/Workspace/Personal/flowpay/backend/src/flowpay/main.py` (32 lines)
    - Purpose: FastAPI app setup
    - Pattern: Include routers with prefix and tags

11. `/Users/angelbrand/Workspace/Personal/flowpay/backend/tests/conftest.py` (57 lines)
    - Purpose: Test fixtures
    - Fixtures: `apply_schema` (session-level), `db` (function-level with rollback), `client` (with dependency override)

12. `/Users/angelbrand/Workspace/Personal/flowpay/backend/tests/integration/auth/test_register.py` (79 lines)
    - Purpose: Integration test pattern
    - Pattern: Use `client` fixture, assert HTTP status/response, query DB to verify persistence

---

## Current State Analysis

### Existing Modules (Relevant Patterns)
```
backend/src/flowpay/
  users/
    application/
      user_service.py (48 lines)
        - UserSummary dataclass (id, username)
        - UserService.__init__(repository), create_user(), get_by_id(), get_by_username()
    ports/
      user_repository.py (31 lines)
        - UserRecord dataclass (id, username, created_at)
        - UserRepository protocol with create(), get_by_id(), get_by_username()
    adapters/
      user_orm.py (18 lines)
        - User SQLAlchemy model (id, username, created_at)
      user_repository.py (58 lines)
        - SQLAlchemyUserRepository implementation with flush() after insert
        
  auth/
    application/
      auth_service.py (64 lines)
        - AuthService.__init__(credentials_repo, user_service, hash_fn, verify_fn)
        - Methods: register(), login(), get_by_id()
    adapters/
      router.py (108 lines)
        - RegisterRequest/Response, LoginRequest/Response, MeResponse models
        - Endpoints: POST /auth/register, POST /auth/login, GET /auth/me
        - Pattern: build_auth_service(db), catch exceptions, raise FlowPayHTTPError
        
  wallets/
    application/
      wallet_service.py (50 lines)
        - WalletSummary dataclass (id, user_id, currency, created_at as ISO string)
        - WalletService methods: create_wallet(user_id), get_by_id(), get_by_user_id()
    ports/
      wallet_repository.py (26 lines)
        - WalletRecord dataclass (id, user_id, currency, created_at)
        - WalletRepository protocol
    adapters/
      wallet_orm.py (19 lines)
        - Wallet model (id, user_id, currency, created_at)
      wallet_repository.py (52 lines)
        - SQLAlchemyWalletRepository implementation
```

### Database Schema (Current)
```
users (id PK, username UNIQUE, created_at)
auth_credentials (user_id PK FK→users, password_hash, created_at, updated_at)
wallets (id PK, user_id UNIQUE FK→users, currency, created_at)
```

### Architecture Rules (From ADR 0001)
- Modules are separate with clear import boundaries
- Application code independent from FastAPI/SQLAlchemy
- Cross-module wiring in `composition.py`
- Repositories use `flush()` but not `commit()/rollback()`
- Database session is unit of work (commit after request)

---

## Dependency Analysis

```mermaid
graph TB
    Client["HTTP Client"]
    Main["main.py<br/>FastAPI App"]
    Router["ledger/adapters/router.py<br/>HTTP Endpoints"]
    Composition["composition.py<br/>build_ledger_service"]
    LedgerService["ledger/application/<br/>ledger_service.py<br/>LedgerService"]
    LedgerRepo["ledger/adapters/<br/>ledger_repository.py<br/>SQLAlchemy Impl"]
    LedgerPort["ledger/ports/<br/>ledger_repository.py<br/>Protocol + Records"]
    LedgerORM["ledger/adapters/<br/>ledger_orm.py<br/>LedgerTransaction Model"]
    WalletORM["wallets/adapters/<br/>wallet_orm.py<br/>Wallet Model"]
    DB["PostgreSQL<br/>ledger_transactions"]
    Session["sqlalchemy.orm.Session"]
    
    Client -->|HTTP POST/GET| Main
    Main -->|Router| Router
    Router -->|build_ledger_service| Composition
    Composition -->|LedgerService + Repository| LedgerService
    LedgerService -->|implements| LedgerPort
    LedgerService -->|calls| LedgerRepo
    LedgerRepo -->|uses| LedgerORM
    LedgerRepo -->|queries| DB
    LedgerRepo -->|joins| WalletORM
    Router -->|gets Session| Session
    Session -->|binds to| DB
    
    style LedgerService fill:#4a90e2
    style Router fill:#7ed321
    style DB fill:#f5a623
```

**Module Dependencies:**
- `ledger.application` imports: `ledger.ports` only
- `ledger.adapters` imports: `ledger.application`, `ledger.ports`, `wallets.adapters` (ORM only, for read-side join)
- `router` imports: `ledger.application`, `composition`, `shared.errors`, FastAPI
- `composition` imports: `ledger.adapters`, returns `LedgerService`

**No circular dependencies.** Ledger does NOT import auth or transfers modules.

---

## Proposed Changes

### Files to Create (9 new files)

#### 1. `backend/src/flowpay/ledger/__init__.py`
Empty module marker file.

#### 2. `backend/src/flowpay/ledger/ports/ledger_repository.py`
**Purpose:** Protocol and record types for transaction persistence (adapter-neutral).
**Estimated lines:** ~55 lines

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class TransactionRecord:
    id: str
    wallet_id: str
    type: str  # 'credit' or 'debit'
    amount: int  # positive integer COP
    currency: str  # always 'COP'
    source: str  # 'welcome_bonus', 'manual_transfer', 'nfc_transfer'
    operation_id: str | None
    counterparty_wallet_id: str | None
    created_at: datetime


@dataclass
class TransactionWithCounterparty:
    """Transaction with resolved counterparty username for history display."""
    id: str
    wallet_id: str
    type: str
    amount: int
    currency: str
    source: str
    operation_id: str | None
    counterparty_wallet_id: str | None
    counterparty_username: str | None  # populated by repository join
    created_at: datetime


class LedgerRepository(Protocol):
    def create_entry(
        self,
        transaction_id: str,
        wallet_id: str,
        type: str,
        amount: int,
        source: str,
        operation_id: str | None = None,
        counterparty_wallet_id: str | None = None,
    ) -> TransactionRecord:
        """Persist an approved ledger entry.

        This low-level write method is for ledger application use cases only.
        HTTP adapters and other modules must not call repositories directly.
        """
        ...

    def get_by_wallet_id(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TransactionWithCounterparty]:
        """Get transactions for a wallet, ordered newest-first."""
        ...

    def calculate_balance(self, wallet_id: str) -> int:
        """Calculate wallet balance from transactions."""
        ...
```

#### 3. `backend/src/flowpay/ledger/ports/__init__.py`
Empty module marker.

#### 4. `backend/src/flowpay/ledger/application/ledger_service.py`
**Purpose:** Application service for controlled ledger writes and balance/history queries.
**Estimated lines:** ~115 lines

```python
from dataclasses import dataclass
from datetime import datetime

from flowpay.shared.ids import generate_id
from flowpay.ledger.ports.ledger_repository import (
    LedgerRepository,
    TransactionRecord,
    TransactionWithCounterparty,
)


@dataclass
class TransactionSummary:
    id: str
    wallet_id: str
    type: str
    amount: int
    currency: str
    source: str
    operation_id: str | None
    counterparty_wallet_id: str | None
    counterparty_username: str | None
    created_at: str  # ISO format


@dataclass
class WalletBalance:
    wallet_id: str
    balance: int  # amount in COP
    currency: str


class LedgerService:
    def __init__(self, repository: LedgerRepository):
        self.repository = repository

    def record_welcome_bonus(
        self,
        wallet_id: str,
        amount: int,
    ) -> TransactionSummary:
        """Record the one-time wallet welcome bonus."""
        transaction_id = generate_id("txn_")
        record = self.repository.create_entry(
            transaction_id=transaction_id,
            wallet_id=wallet_id,
            type="credit",
            amount=amount,
            source="welcome_bonus",
            operation_id=None,
            counterparty_wallet_id=None,
        )
        return TransactionSummary(
            id=record.id,
            wallet_id=record.wallet_id,
            type=record.type,
            amount=record.amount,
            currency=record.currency,
            source=record.source,
            operation_id=record.operation_id,
            counterparty_wallet_id=record.counterparty_wallet_id,
            counterparty_username=None,
            created_at=record.created_at.isoformat(),
        )

    def record_transfer_entries(
        self,
        operation_id: str,
        source_wallet_id: str,
        destination_wallet_id: str,
        amount: int,
        source: str,
    ) -> tuple[TransactionSummary, TransactionSummary]:
        """Record the debit and credit for an already-approved transfer.

        The transfers module owns validation, idempotency, wallet locking, and
        TransferOperation creation. This method only persists the two ledger
        entries inside the caller's database transaction.
        """
        debit = self.repository.create_entry(
            transaction_id=generate_id("txn_"),
            wallet_id=source_wallet_id,
            type="debit",
            amount=amount,
            source=source,
            operation_id=operation_id,
            counterparty_wallet_id=destination_wallet_id,
        )
        credit = self.repository.create_entry(
            transaction_id=generate_id("txn_"),
            wallet_id=destination_wallet_id,
            type="credit",
            amount=amount,
            source=source,
            operation_id=operation_id,
            counterparty_wallet_id=source_wallet_id,
        )
        return (
            self._to_summary(debit),
            self._to_summary(credit),
        )

    def get_wallet_balance(self, wallet_id: str) -> WalletBalance:
        """Get the calculated balance for a wallet."""
        balance = self.repository.calculate_balance(wallet_id)
        return WalletBalance(
            wallet_id=wallet_id,
            balance=balance,
            currency="COP",
        )

    def get_wallet_history(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TransactionSummary]:
        """Get transaction history for a wallet."""
        records = self.repository.get_by_wallet_id(wallet_id, limit, offset)
        return [
            TransactionSummary(
                id=record.id,
                wallet_id=record.wallet_id,
                type=record.type,
                amount=record.amount,
                currency=record.currency,
                source=record.source,
                operation_id=record.operation_id,
                counterparty_wallet_id=record.counterparty_wallet_id,
                counterparty_username=record.counterparty_username,
                created_at=record.created_at.isoformat(),
            )
            for record in records
        ]

    def _to_summary(self, record: TransactionRecord) -> TransactionSummary:
        return TransactionSummary(
            id=record.id,
            wallet_id=record.wallet_id,
            type=record.type,
            amount=record.amount,
            currency=record.currency,
            source=record.source,
            operation_id=record.operation_id,
            counterparty_wallet_id=record.counterparty_wallet_id,
            counterparty_username=None,
            created_at=record.created_at.isoformat(),
        )
```

#### 5. `backend/src/flowpay/ledger/application/__init__.py`
Empty module marker.

#### 6. `backend/src/flowpay/ledger/adapters/ledger_orm.py`
**Purpose:** SQLAlchemy ORM model for ledger_transactions table.
**Estimated lines:** ~55 lines

```python
from datetime import datetime

from sqlalchemy import DateTime, String, Text, BigInteger, CheckConstraint, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from flowpay.database import Base


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    wallet_id: Mapped[str] = mapped_column(Text, ForeignKey("wallets.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'credit' or 'debit'
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)  # always 'COP'
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # `transfers` owns transfer_operations. The FK is added when that table exists.
    operation_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    counterparty_wallet_id: Mapped[str | None] = mapped_column(Text, ForeignKey("wallets.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_ledger_transactions_amount_positive"),
        CheckConstraint("currency = 'COP'", name="ck_ledger_transactions_currency_cop"),
        CheckConstraint("type IN ('credit', 'debit')", name="ck_ledger_transactions_type"),
        CheckConstraint(
            "source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer')",
            name="ck_ledger_transactions_source",
        ),
        CheckConstraint(
            "(type = 'credit' AND source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer')) "
            "OR (type = 'debit' AND source IN ('manual_transfer', 'nfc_transfer'))",
            name="ck_ledger_transactions_type_source",
        ),
        CheckConstraint(
            "(source = 'welcome_bonus' AND operation_id IS NULL) "
            "OR (source IN ('manual_transfer', 'nfc_transfer') AND operation_id IS NOT NULL)",
            name="ck_ledger_transactions_operation_reference",
        ),
        Index("ix_ledger_transactions_wallet_created", "wallet_id", "created_at"),
        Index("ix_ledger_transactions_operation_id", "operation_id"),
        Index(
            "uq_ledger_transactions_welcome_bonus_wallet",
            "wallet_id",
            unique=True,
            postgresql_where=text("source = 'welcome_bonus'"),
        ),
    )

    def __repr__(self):
        return f"<LedgerTransaction(id={self.id}, wallet_id={self.wallet_id}, type={self.type}, amount={self.amount})>"
```

#### 7. `backend/src/flowpay/ledger/adapters/ledger_repository.py`
**Purpose:** SQLAlchemy implementation of ledger persistence.
**Estimated lines:** ~105 lines

```python
from datetime import datetime, timezone

from sqlalchemy import func, case, desc
from sqlalchemy.orm import Session, aliased

from flowpay.ledger.ports.ledger_repository import (
    LedgerRepository,
    TransactionRecord,
    TransactionWithCounterparty,
)
from flowpay.ledger.adapters.ledger_orm import LedgerTransaction
from flowpay.users.adapters.user_orm import User
from flowpay.wallets.adapters.wallet_orm import Wallet


class SQLAlchemyLedgerRepository(LedgerRepository):
    def __init__(self, session: Session):
        self.session = session

    def create_entry(
        self,
        transaction_id: str,
        wallet_id: str,
        type: str,
        amount: int,
        source: str,
        operation_id: str | None = None,
        counterparty_wallet_id: str | None = None,
    ) -> TransactionRecord:
        """Persist an approved ledger entry."""
        transaction = LedgerTransaction(
            id=transaction_id,
            wallet_id=wallet_id,
            type=type,
            amount=amount,
            currency="COP",
            source=source,
            operation_id=operation_id,
            counterparty_wallet_id=counterparty_wallet_id,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(transaction)
        self.session.flush()

        return TransactionRecord(
            id=transaction.id,
            wallet_id=transaction.wallet_id,
            type=transaction.type,
            amount=transaction.amount,
            currency=transaction.currency,
            source=transaction.source,
            operation_id=transaction.operation_id,
            counterparty_wallet_id=transaction.counterparty_wallet_id,
            created_at=transaction.created_at,
        )

    def get_by_wallet_id(
        self,
        wallet_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TransactionWithCounterparty]:
        """Get transactions for a wallet with counterparty username, ordered newest-first."""
        CounterpartyWallet = aliased(Wallet)
        rows = (
            self.session.query(LedgerTransaction, User.username)
            .outerjoin(
                CounterpartyWallet,
                LedgerTransaction.counterparty_wallet_id == CounterpartyWallet.id,
            )
            .outerjoin(User, CounterpartyWallet.user_id == User.id)
            .filter(LedgerTransaction.wallet_id == wallet_id)
            .order_by(desc(LedgerTransaction.created_at), desc(LedgerTransaction.id))
            .limit(limit)
            .offset(offset)
            .all()
        )

        return [
            TransactionWithCounterparty(
                id=txn.id,
                wallet_id=txn.wallet_id,
                type=txn.type,
                amount=txn.amount,
                currency=txn.currency,
                source=txn.source,
                operation_id=txn.operation_id,
                counterparty_wallet_id=txn.counterparty_wallet_id,
                counterparty_username=counterparty_username,
                created_at=txn.created_at,
            )
            for txn, counterparty_username in rows
        ]

    def calculate_balance(self, wallet_id: str) -> int:
        """Calculate balance from transactions: sum(credit) - sum(debit)."""
        result = self.session.query(
            func.coalesce(
                func.sum(
                    case(
                        (LedgerTransaction.type == "credit", LedgerTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            ) - func.coalesce(
                func.sum(
                    case(
                        (LedgerTransaction.type == "debit", LedgerTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            )
        ).filter(
            LedgerTransaction.wallet_id == wallet_id
        ).scalar()

        return result or 0
```

#### 8. `backend/src/flowpay/ledger/adapters/__init__.py`
Empty module marker.

#### 9. `backend/src/flowpay/ledger/adapters/router.py`
**Purpose:** HTTP router for wallet endpoints (GET /wallet, GET /wallet/transactions).
**Estimated lines:** ~100 lines

```python
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


@router.get("/wallet", response_model=WalletEnvelope)
def get_wallet(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> WalletEnvelope:
    """Get the authenticated user's wallet with balance."""
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


@router.get("/wallet/transactions", response_model=WalletHistoryResponse)
def get_wallet_transactions(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
) -> WalletHistoryResponse:
    """Get the authenticated user's transaction history."""
    wallet_service = build_wallet_service(db)
    ledger_service = build_ledger_service(db)

    wallet_summary = wallet_service.get_by_user_id(current_user_id)
    if wallet_summary is None:
        raise FlowPayHTTPError(
            code="wallet_not_found",
            message="Wallet not found",
            status_code=404,
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
```

---

### Files to Modify

#### 1. File: `backend/src/flowpay/composition.py`

**Current State (Lines 1-25):**
```python
from sqlalchemy.orm import Session

from flowpay.auth.adapters.credentials_repository import SQLAlchemyCredentialsRepository
from flowpay.auth.adapters.password_hasher import hash_password, verify_password
from flowpay.auth.application.auth_service import AuthService
from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
from flowpay.users.application.user_service import UserService
from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService


def build_auth_service(db: Session) -> AuthService:
    """Build and return an AuthService instance."""
    user_repository = SQLAlchemyUserRepository(db)
    credentials_repository = SQLAlchemyCredentialsRepository(db)
    user_service = UserService(user_repository)

    return AuthService(
        credentials_repository=credentials_repository,
        user_service=user_service,
        hash_fn=hash_password,
        verify_fn=verify_password,
    )


def build_wallet_service(db: Session) -> WalletService:
    """Build and return a WalletService instance."""
    wallet_repository = SQLAlchemyWalletRepository(db)
    return WalletService(wallet_repository)
```

**Proposed Change (Lines 1-36):**
```python
from sqlalchemy.orm import Session

from flowpay.auth.adapters.credentials_repository import SQLAlchemyCredentialsRepository
from flowpay.auth.adapters.password_hasher import hash_password, verify_password
from flowpay.auth.application.auth_service import AuthService
from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
from flowpay.users.application.user_service import UserService
from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService
from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository
from flowpay.ledger.application.ledger_service import LedgerService


def build_auth_service(db: Session) -> AuthService:
    """Build and return an AuthService instance."""
    user_repository = SQLAlchemyUserRepository(db)
    credentials_repository = SQLAlchemyCredentialsRepository(db)
    user_service = UserService(user_repository)

    return AuthService(
        credentials_repository=credentials_repository,
        user_service=user_service,
        hash_fn=hash_password,
        verify_fn=verify_password,
    )


def build_wallet_service(db: Session) -> WalletService:
    """Build and return a WalletService instance."""
    wallet_repository = SQLAlchemyWalletRepository(db)
    return WalletService(wallet_repository)


def build_ledger_service(db: Session) -> LedgerService:
    """Build and return a LedgerService instance."""
    ledger_repository = SQLAlchemyLedgerRepository(db)
    return LedgerService(ledger_repository)
```

**Changes:**
- Lines added: ~10 (imports + function)

**Rationale:**
- Adds ledger service to composition root
- Follows same pattern as wallet_service

**Side Effects:**
- None (pure addition)

---

#### 2. File: `backend/src/flowpay/main.py`

**Current State (Lines 1-32):**
```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from flowpay.auth.adapters.router import router as auth_router
from flowpay.shared.errors import FlowPayHTTPError

app = FastAPI(title="FlowPay API", version="0.1.0")

app.include_router(auth_router, prefix="/auth", tags=["auth"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.exception_handler(FlowPayHTTPError)
async def handle_flowpay_error(_: Request, exc: FlowPayHTTPError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, __: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "invalid_request", "message": "Validation failed"}},
    )
```

**Proposed Change (Lines 1-35):**
```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from flowpay.auth.adapters.router import router as auth_router
from flowpay.ledger.adapters.router import router as ledger_router
from flowpay.shared.errors import FlowPayHTTPError

app = FastAPI(title="FlowPay API", version="0.1.0")

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(ledger_router, tags=["wallet"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.exception_handler(FlowPayHTTPError)
async def handle_flowpay_error(_: Request, exc: FlowPayHTTPError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, __: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "invalid_request", "message": "Validation failed"}},
    )
```

**Changes:**
- Lines added: 1 (import)
- Lines modified: 1 (include_router)

**Rationale:**
- Registers ledger router without prefix (endpoints are /wallet, /wallet/transactions)
- Ledger endpoints are tagged under "wallet"

**Side Effects:**
- New endpoints become available at application root

---

#### 3. File: `backend/tests/conftest.py`

**Current State (Lines 15-18):**
```python
import flowpay.auth.adapters.credentials_orm  # noqa: E402, F401
import flowpay.users.adapters.user_orm  # noqa: E402, F401
import flowpay.wallets.adapters.wallet_orm  # noqa: E402, F401
from flowpay.database import Base, get_db  # noqa: E402
```

**Proposed Change (Lines 15-19):**
```python
import flowpay.auth.adapters.credentials_orm  # noqa: E402, F401
import flowpay.users.adapters.user_orm  # noqa: E402, F401
import flowpay.wallets.adapters.wallet_orm  # noqa: E402, F401
import flowpay.ledger.adapters.ledger_orm  # noqa: E402, F401
from flowpay.database import Base, get_db  # noqa: E402
```

**Changes:**
- Lines added: 1 (ledger_orm import)

**Rationale:**
- Ensures ledger ORM is imported before test schema creation so metadata is registered

**Side Effects:**
- None (metadata discovery for schema creation)

---

#### 4. File: `backend/migrations/env.py`

**Current State (Lines 7-10):**
```python
from flowpay.database import Base
import flowpay.users.adapters.user_orm  # noqa: F401
import flowpay.auth.adapters.credentials_orm  # noqa: F401
import flowpay.wallets.adapters.wallet_orm  # noqa: F401
```

**Proposed Change (Lines 7-11):**
```python
from flowpay.database import Base
import flowpay.users.adapters.user_orm  # noqa: F401
import flowpay.auth.adapters.credentials_orm  # noqa: F401
import flowpay.wallets.adapters.wallet_orm  # noqa: F401
import flowpay.ledger.adapters.ledger_orm  # noqa: F401
```

**Changes:**
- Lines added: 1 (ledger_orm import)

**Rationale:**
- Ensures Alembic autogenerate discovers ledger_transactions table

**Side Effects:**
- None (metadata discovery for migrations)

---

### Files NOT to Create
- No new migration files yet (will be auto-generated)
- No temporary validation scripts
- No additional documentation beyond planning
- No `transfer_operations` table in this phase; that table belongs to the `transfers` module. The `ledger_transactions.operation_id` foreign key is deferred until the transfers migration exists.

---

## Implementation Steps

### Step 1: Create Ledger Module Structure
Create all ledger module directories and files:

```bash
mkdir -p backend/src/flowpay/ledger/{application,ports,adapters}
touch backend/src/flowpay/ledger/__init__.py
touch backend/src/flowpay/ledger/application/__init__.py
touch backend/src/flowpay/ledger/ports/__init__.py
touch backend/src/flowpay/ledger/adapters/__init__.py
```

**Verification:**
```bash
ls -la backend/src/flowpay/ledger/
```

---

### Step 2: Create Port Definitions
Create `backend/src/flowpay/ledger/ports/ledger_repository.py` with TransactionRecord, TransactionWithCounterparty, and LedgerRepository protocol.

**Verification:**
```bash
python -c "from flowpay.ledger.ports.ledger_repository import LedgerRepository, TransactionRecord; print('✓ Imports work')"
```

---

### Step 3: Create Application Service
Create `backend/src/flowpay/ledger/application/ledger_service.py` with LedgerService and TransactionSummary/WalletBalance dataclasses.

**Verification:**
```bash
python -c "from flowpay.ledger.application.ledger_service import LedgerService, TransactionSummary; print('✓ Imports work')"
```

---

### Step 4: Create ORM Models
Create `backend/src/flowpay/ledger/adapters/ledger_orm.py` with LedgerTransaction SQLAlchemy model.

**Verification:**
```bash
python -c "from flowpay.ledger.adapters.ledger_orm import LedgerTransaction; print(f'✓ ORM model: {LedgerTransaction.__tablename__}')"
```

---

### Step 5: Create Repository Adapter
Create `backend/src/flowpay/ledger/adapters/ledger_repository.py` with SQLAlchemyLedgerRepository implementation.

**Verification:**
```bash
python -c "from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository; print('✓ Repository implementation')"
```

---

### Step 6: Update Composition Root
Modify `backend/src/flowpay/composition.py` to add `build_ledger_service()` function.

**Verification:**
```bash
python -c "from flowpay.composition import build_ledger_service; print('✓ Composition builder')"
```

---

### Step 7: Create HTTP Router
Create `backend/src/flowpay/ledger/adapters/router.py` with GET /wallet and GET /wallet/transactions endpoints.

**Verification:**
```bash
python -c "from flowpay.ledger.adapters.router import router; print(f'✓ Router with {len(router.routes)} routes')"
```

---

### Step 8: Update Main App
Modify `backend/src/flowpay/main.py` to include ledger router.

**Verification:**
```bash
python -c "from flowpay.main import app; wallets_routes = [r.path for r in app.routes if 'wallet' in r.path]; print(f'✓ Wallet routes: {wallets_routes}')"
```

---

### Step 9: Update Test Configuration
Modify `backend/tests/conftest.py` to import ledger ORM for metadata discovery.

**Verification:**
```bash
python -c "import flowpay.ledger.adapters.ledger_orm; from flowpay.database import Base; print(f'✓ ORM registered with {len(Base.metadata.tables)} tables')"
```

---

### Step 10: Update Migration Configuration
Modify `backend/migrations/env.py` to import ledger ORM for Alembic metadata discovery.

**Verification:**
```bash
cd backend && DATABASE_URL="postgresql+psycopg://localhost/test" AUTH_SECRET_KEY=dev python -m alembic current
```

---

### Step 11: Generate Database Migration
Auto-generate Alembic migration for ledger_transactions table:

```bash
cd backend && \
  DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  AUTH_SECRET_KEY=dev \
  uv run alembic revision --autogenerate -m "create ledger_transactions table"
```

**Verification:**
```bash
ls -1 backend/migrations/versions/ | grep ledger
```

---

### Step 12: Apply Migration
```bash
cd backend && \
  DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  AUTH_SECRET_KEY=dev \
  uv run alembic upgrade head
```

**Verification:**
```bash
cd backend && \
  DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  AUTH_SECRET_KEY=dev \
  psql -c "SELECT tablename FROM pg_tables WHERE tablename = 'ledger_transactions';"
```

---

### Step 13: Create Integration Tests
Create `backend/tests/integration/ledger/` directory and test files with tests for balance calculation, transaction history, and invariants.

```bash
mkdir -p backend/tests/integration/ledger
touch backend/tests/integration/ledger/__init__.py
```

---

### Step 14: Run Tests
```bash
cd backend && \
  AUTH_SECRET_KEY=dev \
  DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/integration/ledger/ tests/architecture/test_backend_boundaries.py -v
```

---

### Step 15: Verify Endpoints
```bash
cd backend && \
  AUTH_SECRET_KEY=dev \
  DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run python -c "from flowpay.main import app; from fastapi.testclient import TestClient; client = TestClient(app); print([r.path for r in app.routes if 'wallet' in r.path])"
```

---

## Scope Boundaries

### What WILL be implemented:
- **Ledger persistence:** `ledger_transactions` table with append-only transactions
- **Balance calculation:** Derived from sum(credit) - sum(debit)
- **Transaction history:** Ordered newest-first with counterparty username join
- **HTTP endpoints:** `GET /wallet` (balance), `GET /wallet/transactions` (history with limit/cursor)
- **Architecture compliance:** Hexagonal structure, ports/adapters, no circular dependencies
- **Tests:** Integration tests for balance calc, history retrieval, invariants
- **Migration:** Auto-generated Alembic migration

### What will NOT be implemented:
- **Welcome bonus creation:** belongs to auth/register integration (future phase)
- **Transfer orchestration:** belongs to transfers module (future phase)
- **Idempotency:** only needed for transfers, not for read-only ledger
- **Concurrent locking:** (`SELECT FOR UPDATE`) only needed for transfer writes
- **Integration with auth/register:** wallet + welcome bonus will be integrated in phase 3
- **Transfer creation:** belongs to transfers module
- **`transfer_operations` table:** belongs to the transfers module; ledger stores `operation_id` as a stable text reference until that migration can add the FK

### Assumptions:
- PostgreSQL is running and accessible (from `conftest.py` DATABASE_URL)
- Wallets table already exists (from wallets module implementation)
- Users table already exists (from users module implementation)
- Migration tool (Alembic) is set up (from existing migrations directory)
- Session is the unit of work with commit after request (from database.py)

---

## Testing Strategy

### Integration Tests
**File:** `backend/tests/integration/ledger/test_ledger_service.py` (~170 lines)

1. **test_record_welcome_bonus_with_valid_data**
   - Records a welcome bonus through `LedgerService.record_welcome_bonus`
   - Verifies it persists with correct values

2. **test_calculate_balance_single_credit**
   - Creates 1 credit transaction (amount=50000)
   - Calls `get_wallet_balance(wallet_id)`
   - Asserts balance == 50000

3. **test_calculate_balance_credit_and_debit**
   - Creates credit (50000) and debit (5000)
   - Asserts balance == 45000

4. **test_calculate_balance_zero_for_empty_wallet**
   - Calls `get_wallet_balance()` for wallet with no transactions
   - Asserts balance == 0

5. **test_get_wallet_history_ordered_newest_first**
   - Creates 3 transactions with different timestamps
   - Retrieves history
   - Asserts ordered by created_at DESC

6. **test_get_wallet_history_with_limit_and_cursor**
   - Creates 100 transactions
   - Retrieves first page with limit=10, then second page with returned cursor
   - Asserts returns 10 items and does not repeat first-page transactions

7. **test_transaction_with_counterparty_resolves_username**
   - Creates transaction with counterparty_wallet_id pointing to alice
   - Retrieves history
   - Asserts counterparty_username == "alice"

8. **test_amount_must_be_positive**
   - Attempts to create transaction with amount=-100
   - Expects database constraint error

9. **test_welcome_bonus_can_only_be_recorded_once_per_wallet**
   - Attempts to record two welcome bonus entries for one wallet
   - Expects unique partial index violation

10. **test_transfer_source_requires_operation_id**
   - Attempts to create manual/nfc transfer ledger entry without operation_id
   - Expects database constraint error

11. **test_debit_cannot_use_welcome_bonus_source**
   - Attempts to create debit with source='welcome_bonus'
   - Expects database constraint error

### HTTP Endpoint Tests
**File:** `backend/tests/integration/ledger/test_ledger_endpoints.py` (~110 lines)

1. **test_get_wallet_returns_200_with_balance**
   - Registers user, creates wallet, records credit transaction
   - Calls `GET /wallet` with JWT
   - Asserts status 200, response includes balance

2. **test_get_wallet_requires_authentication**
   - Calls `GET /wallet` without token
   - Asserts status 401

3. **test_get_wallet_transactions_returns_history**
   - Creates wallet with 5 transactions
   - Calls `GET /wallet/transactions?limit=10`
   - Asserts status 200, returns all 5 transactions

4. **test_get_wallet_transactions_respects_limit**
   - Creates wallet with 100 transactions
   - Calls `GET /wallet/transactions?limit=10`
   - Asserts returns exactly 10

5. **test_get_wallet_transactions_accepts_cursor**
   - Creates wallet with more than one page of transactions
   - Calls second page using `next_cursor`
   - Asserts the second response does not repeat the first page

6. **test_get_wallet_transactions_rejects_invalid_cursor**
   - Calls `GET /wallet/transactions?cursor=invalid`
   - Asserts status 400 with `invalid_cursor`

7. **test_get_wallet_not_found_returns_404**
   - Deletes wallet from DB
   - Calls `GET /wallet`
   - Asserts status 404

---

## Rollback Plan

If issues arise:

1. **Revert code changes:**
   ```bash
   git revert --no-edit <commit-hash>
   ```

2. **Revert database migration:**
   ```bash
   cd backend && \
     DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
     AUTH_SECRET_KEY=dev \
     uv run alembic downgrade -1
   ```

3. **Verify rollback:**
   ```bash
   psql postgresql://flowpay:flowpay@localhost:5432/flowpay -c \
     "SELECT tablename FROM pg_tables WHERE tablename = 'ledger_transactions';"
   ```

---

## Success Criteria

- [ ] **All files created** (9 new files in ledger module)
- [ ] **All files modified** (4 files: composition.py, main.py, conftest.py, env.py)
- [ ] **Migration generated** - Run `alembic revision --autogenerate` and verify migration file
- [ ] **Migration applied** - Run `alembic upgrade head` without errors
- [ ] **Tables created** - Verify `ledger_transactions` exists in PostgreSQL
- [ ] **Architecture tests pass** - No imports of FastAPI/SQLAlchemy in ledger.application
- [ ] **Integration tests pass** - All 11 ledger service tests pass
- [ ] **HTTP tests pass** - All 7 endpoint tests pass
- [ ] **Manual test successful** - Can create transaction and retrieve balance via API
- [ ] **No regressions** - All existing tests (auth, users, wallets) still pass (48+ tests)

---

## TL;DR

**Total files to modify:** 4
- `backend/src/flowpay/composition.py` (~10 lines added)
- `backend/src/flowpay/main.py` (~2 lines added/modified)
- `backend/tests/conftest.py` (~1 line added)
- `backend/migrations/env.py` (~1 line added)

**Total files to create:** 10
- 9 ledger module files (ports, application, adapters)
- 1 auto-generated migration file
- Integration test files (will create separately)

**Total estimated lines:**
- ~500 lines added (production code)
- ~250 lines added (tests)
- ~14 lines added (configuration updates)
- **Total: ~764 lines**

**Key deliverables:**
1. ✅ Ledger persistence module (append-only transaction storage)
2. ✅ Balance calculation service (derived from transactions)
3. ✅ HTTP endpoints for wallet queries (GET /wallet, GET /wallet/transactions)
4. ✅ Counterparty username resolution (read-side join in adapter)
5. ✅ PostgreSQL migration (auto-generated)
6. ✅ Integration tests (18 tests covering invariants, history, endpoints)
7. ✅ Architecture compliance (hexagonal, no framework leakage)

**What will NOT be included:**
- ❌ Welcome bonus creation (belongs to auth integration)
- ❌ Transfer logic (belongs to transfers module)
- ❌ Idempotency handling (only for transfers)
- ❌ Concurrent locking (only for transfers)
- ❌ Keyset cursor pagination (initial cursor uses an opaque offset string)
- ❌ Integration with /auth/register (phase 3)

---

## Team TL;DR

**What we're building:** A transaction ledger that records all wallet activity (deposits, transfers) and automatically calculates wallet balances. Users can check their current balance and view their complete transaction history.

**Why it matters:** This is the financial foundation of FlowPay. Every peso that moves gets recorded here, and all balances are derived from these immutable records. This prevents money loss bugs and gives users a complete audit trail.

**Timeline impact:** Standalone module, 3-4 hours focused work. Sets up foundation for welcome bonus integration (auth refactor) and transfer implementation. No blocking dependencies.
