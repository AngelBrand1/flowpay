# FlowPay Backend — Initial Setup

## Overview

Scaffold the minimal viable backend to start implementing modules with TDD. Only what is needed now: hexagonal structure, core dependencies, Docker Compose, basic configuration, SQLAlchemy engine, Alembic, `generate_id`, and a test harness. Auth dependencies (JWT, bcrypt) and any module-specific config are added when the module is implemented.

---

## Files Analyzed

| File | Relevance |
|---------|-----------|
| `docs/specs/01-domain-rules.md` | Financial invariants, required modules |
| `docs/specs/02-use-cases.md` | 6 use cases that guide module structure |
| `docs/specs/03-domain-model.md` | Entities: User, Wallet, Transaction, TransferOperation |
| `docs/specs/04-api-contract.md` | Endpoints, error shape, idempotency |
| `docs/specs/05-persistence-model.md` | 6 tables, module ownership, transfer write transaction |
| `docs/specs/06-testing-strategy.md` | Test pyramid, what requires real PostgreSQL |
| `docs/adr/0001-backend-architecture.md` | Modular monolith, hexagonal per module, 6 modules |
| `docs/adr/0003-stack-selection.md` | FastAPI, SQLAlchemy 2.x sync, psycopg v3, Alembic, JWT HS256 |

---

## Current State

```
flowpay/
├── docs/          ← complete specs + ADRs
└── README.md      ← no application code
```

No code files exist. The project is still in the definition phase.

---

## Target Structure

```
flowpay/
├── backend/
│   ├── src/
│   │   └── flowpay/
│   │       ├── __init__.py
│   │       ├── main.py              ← FastAPI app + health check
│   │       ├── config.py            ← pydantic-settings
│   │       ├── database.py          ← engine, session, get_db
│   │       ├── shared/
│   │       │   ├── __init__.py
│   │       │   └── ids.py           ← generate_id(prefix)
│   │       ├── auth/
│   │       │   ├── __init__.py
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   ├── ports/
│   │       │   └── adapters/
│   │       ├── users/               ← same pattern
│   │       ├── wallets/
│   │       ├── ledger/
│   │       ├── transfers/
│   │       └── nfc/
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py              ← fixtures + SQLAlchemy 2.x rollback pattern
│   │   ├── unit/
│   │   │   └── __init__.py
│   │   └── integration/
│   │       └── __init__.py
│   ├── migrations/
│   │   ├── env.py                   ← Alembic env with Base.metadata
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── alembic.ini
│   ├── pyproject.toml               ← uv, deps, pytest config
│   └── .env.example                 ← only for the Python app
├── mobile/
│   └── .gitkeep
└── docker-compose.yml               ← hardcoded creds, no root .env.example
```

---

## Dependency Diagram

```mermaid
graph TD
    tests --> main
    tests --> database
    main --> config
    database --> config
    shared --> nothing["(no internal deps)"]
    auth_adapters --> database
    auth_adapters --> shared
    users_adapters --> database
    users_adapters --> shared
    wallets_adapters --> database
    wallets_adapters --> shared
    ledger_adapters --> database
    ledger_adapters --> shared
    transfers_adapters --> database
    transfers_adapters --> shared
    migrations_env --> database
    migrations_env --> auth_adapters
    migrations_env --> users_adapters
    migrations_env --> wallets_adapters
    migrations_env --> ledger_adapters
    migrations_env --> transfers_adapters
```

---

## Files to Create

### `docker-compose.yml` (root)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: flowpay
      POSTGRES_USER: flowpay
      POSTGRES_PASSWORD: flowpay
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  db_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: flowpay_test
      POSTGRES_USER: flowpay
      POSTGRES_PASSWORD: flowpay
    ports:
      - "5433:5432"

volumes:
  postgres_data:
```

Two services: `db` for development (port 5432) and `db_test` for integration tests (port 5433). Completely isolated data.

---

### `backend/.env.example`

```env
DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay
DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test
```

Only database URLs for now. `postgresql+psycopg://` is the correct dialect for psycopg v3 (ADR 0003). Docker Compose has hardcoded credentials — this file is only for the Python app.

Variables added with their module:
- `auth` adds: `AUTH_SECRET_KEY` (ADR 0005 specifies this exact name)
- Do not use `JWT_SECRET` — the ADR says `AUTH_SECRET_KEY`

---

### `backend/pyproject.toml`

```toml
[project]
name = "flowpay-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy>=2.0.0",
    "psycopg[binary]>=3.2.0",
    "alembic>=1.14.0",
    "pydantic-settings>=2.6.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "httpx>=0.27.0",
    "ruff>=0.8.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/flowpay"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]

[tool.ruff]
src = ["src"]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I"]
```

`dependency-groups` is the correct way to declare dev deps in `uv`. `httpx` is needed for FastAPI’s `TestClient`.

Deps added with their module:
- `python-jose[cryptography]` + `passlib[bcrypt]` → when auth is implemented
- `pytest-cov`, `mypy` → when coverage or type checking is desired

---

### `backend/src/flowpay/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

Only `database_url` for now. Each module adds its settings when implemented:
- `auth` adds: `jwt_secret`, `jwt_algorithm`, `jwt_expire_seconds`
- `wallets` adds: `welcome_bonus_amount`

---

### `backend/src/flowpay/database.py`

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from flowpay.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

`Base` is the base class from which all ORM models inherit. `get_db` is the FastAPI dependency injected per request. Modules import `Base` and `get_db` from here — they never create their own engine.

---

### `backend/src/flowpay/main.py`

```python
from fastapi import FastAPI

app = FastAPI(title="FlowPay API", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
```

Only the health check. Routers are added with `app.include_router(...)` module by module in later phases.

---

### `backend/src/flowpay/shared/ids.py`

```python
import uuid


def generate_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex}"
```

Centralized function according to ADR 0003. All persistence adapters use it.

| Entity | Prefix | Example |
|---------|---------|---------|
| User | `usr_` | `usr_a1b2c3...` |
| Wallet | `wal_` | `wal_d4e5f6...` |
| Transaction | `txn_` | `txn_7890ab...` |
| TransferOperation | `op_` | `op_cdef01...` |

---

### `backend/alembic.ini`

```ini
[alembic]
script_location = migrations
sqlalchemy.url = %(DATABASE_URL)s

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
dateformat = %H:%M:%S
```

`%(DATABASE_URL)s` is resolved at runtime from the environment variable. It enables CI/CD without hardcoded credentials.

---

### `backend/migrations/env.py`

```python
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from flowpay.database import Base

config = context.config
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

No adapter imports yet — they are all empty. When a module defines its ORM model, its import is added here so that `alembic revision --autogenerate` can discover it.

---

### `backend/tests/conftest.py`

```python
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from flowpay.database import Base, get_db
from flowpay.main import app

TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL_TEST",
    "postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test",
)

test_engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture(scope="session", autouse=True)
def apply_schema():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db():
    connection = test_engine.connect()
    transaction = connection.begin()
    # join_transaction_mode="create_savepoint" allows session.commit()
    # inside the test to use savepoints without breaking the outer rollback.
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

**Key pattern — SQLAlchemy 2.x:** `Session(bind=connection, join_transaction_mode="create_savepoint")` shares the connection with the outer rollback. `join_transaction_mode="create_savepoint"` makes any `session.commit()` inside the test use a savepoint instead of a real commit, ensuring the fixture rollback cleans everything up at the end. No table truncation, no order dependency.

---

### Modules — empty skeletons

For each module `{auth, users, wallets, ledger, transfers, nfc}`:

```
backend/src/flowpay/{module}/
    __init__.py          ← empty
    domain/
        __init__.py      ← empty
    application/
        __init__.py      ← empty
    ports/
        __init__.py      ← empty
    adapters/
        __init__.py      ← empty
```

30 empty `__init__.py` files. No logic — structure enabled for valid imports from day one.

---

## Files NOT to Create

- No `.github/workflows/` (CI/CD out of scope)
- No `Dockerfile` yet
- No ORM models or real-schema migrations
- No business endpoints
- No domain tests
- No mobile scaffolding (`mobile/` only has `.gitkeep`)
- No `mypy`, `pytest-cov` — add when needed
- No `python-jose`, `passlib` — add when auth is implemented
- No JWT config or welcome bonus config — add with their respective module

---

## Implementation Steps

### Step 1 — Directories and skeletons

```bash
# Create module structure
for mod in auth users wallets ledger transfers nfc; do
  mkdir -p backend/src/flowpay/$mod/{domain,application,ports,adapters}
  touch backend/src/flowpay/$mod/__init__.py
  touch backend/src/flowpay/$mod/domain/__init__.py
  touch backend/src/flowpay/$mod/application/__init__.py
  touch backend/src/flowpay/$mod/ports/__init__.py
  touch backend/src/flowpay/$mod/adapters/__init__.py
 done

mkdir -p backend/src/flowpay/shared
mkdir -p backend/tests/{unit,integration}
mkdir -p backend/migrations/versions
mkdir -p mobile
touch mobile/.gitkeep
```

**Verification:**
```bash
find backend/src/flowpay -type d | sort
# should show the 6 modules with their 4 subfolders
```

---

### Step 2 — pyproject.toml + uv sync

```bash
cd backend
uv init --no-workspace --no-readme
# replace the generated pyproject.toml with the plan version
uv sync --dev
```

**Verification:**
```bash
uv run python -c "import fastapi, sqlalchemy, alembic, psycopg; print('deps ok')"
```

---

### Step 3 — Docker Compose + PostgreSQL

```bash
# from repo root
docker compose up -d db db_test
docker compose ps
```

**Verification:**
```bash
docker compose exec db psql -U flowpay -c "SELECT version();"
docker compose exec db_test psql -U flowpay -d flowpay_test -c "SELECT 1;"
```

---

### Step 4 — .env

```bash
cp .env.example .env
# .env is not committed — add to .gitignore
echo ".env" >> .gitignore
```

---

### Step 5 — Application code

Create in order:
1. `backend/src/flowpay/__init__.py`
2. `backend/src/flowpay/config.py`
3. `backend/src/flowpay/database.py`
4. `backend/src/flowpay/shared/__init__.py`
5. `backend/src/flowpay/shared/ids.py`
6. `backend/src/flowpay/main.py`

**Verification:**
```bash
cd backend
uv run python -c "from flowpay.config import settings; print('db:', settings.database_url[:30])"
uv run python -c "from flowpay.shared.ids import generate_id; print(generate_id('usr_'))"
uv run uvicorn flowpay.main:app &
curl http://localhost:8000/health
# → {"status":"ok"}
```

---

### Step 6 — Alembic

```bash
cd backend
uv run alembic init migrations
# replace migrations/env.py with the plan version
# replace alembic.ini with the plan version
```

**Verification:**
```bash
DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run alembic current
# → no error = Alembic connects and there is no pending revision
```

---

### Step 7 — Test harness

```bash
touch backend/tests/__init__.py
touch backend/tests/unit/__init__.py
touch backend/tests/integration/__init__.py
# create backend/tests/conftest.py with the plan version
```

**Verification:**
```bash
cd backend
DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/ -v
# → "no tests ran" without errors — harness ready
```

---

## Success Criteria

- [ ] `uv run pytest tests/` passes without errors (0 tests, 0 failures)
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `alembic current` connects to PostgreSQL without error
- [ ] `generate_id("usr_")` returns a string with prefix `usr_`
- [ ] Docker Compose brings up `db` (5432) and `db_test` (5433) without conflicts
- [ ] `uv run python -c "from flowpay.config import settings"` does not raise errors

---

## Rollback Plan

Everything is new files. Full rollback:

```bash
git stash
# or simply delete the backend folder and the new root files
```

Stop Docker Compose with `docker compose down`. Remove volumes with `docker compose down -v`.

---

## TL;DR

- **Files to create:** ~45 (including module `__init__.py` files)
- **Files to modify:** 0
- **Estimated lines:** ~200 added / 0 removed
- **Key deliverables:** hexagonal structure, minimal deps with uv, Docker Compose, Alembic, test harness with rollback
- **What will NOT be included:** ORM models, schema migrations, business endpoints, domain tests, mobile, auth deps (JWT/bcrypt), module config

---

## Team TL;DR

**What we’re building:** The complete FlowPay backend skeleton — folder structure, dependencies, database connection, and local Docker development environment.

**Why it matters:** With this setup, the next step is to implement any module directly (auth, wallets, transfers) with TDD without spending time on setup. The scaffolding is ready from day one.

**Timeline impact:** Prerequisite for everything else. Once complete, modules can be implemented in order: users/auth → wallets → transfers → ledger, without infrastructure blockers.
