import ast
from pathlib import Path


def get_module_imports(file_path: Path) -> set[str]:
    """Extract all module imports from a Python file."""
    with open(file_path, "r") as f:
        tree = ast.parse(f.read(), filename=str(file_path))

    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split(".")[0])

    return imports


def find_python_files(directory: Path) -> list[Path]:
    """Find all Python files in a directory recursively."""
    return list(directory.glob("**/*.py"))


def test_auth_does_not_import_users_adapters():
    """Test that flowpay.auth does not import flowpay.users.adapters."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    auth_dir = backend_src / "flowpay" / "auth"

    for file_path in find_python_files(auth_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from flowpay.users.adapters" not in content
        assert "import flowpay.users.adapters" not in content


def test_auth_does_not_import_users_orm():
    """Test that flowpay.auth does not import users ORM models."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    auth_dir = backend_src / "flowpay" / "auth"

    for file_path in find_python_files(auth_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from flowpay.users.adapters.user_orm" not in content
        assert "User(" not in content  # Likely ORM model reference


def test_auth_application_no_fastapi():
    """Test that auth.application does not import FastAPI."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    auth_app_dir = backend_src / "flowpay" / "auth" / "application"

    for file_path in find_python_files(auth_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from fastapi" not in content
        assert "import fastapi" not in content


def test_auth_application_no_sqlalchemy():
    """Test that auth.application does not import SQLAlchemy."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    auth_app_dir = backend_src / "flowpay" / "auth" / "application"

    for file_path in find_python_files(auth_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from sqlalchemy" not in content
        assert "import sqlalchemy" not in content


def test_auth_application_no_passlib():
    """Test that auth.application does not import passlib."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    auth_app_dir = backend_src / "flowpay" / "auth" / "application"

    for file_path in find_python_files(auth_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from passlib" not in content
        assert "import passlib" not in content


def test_auth_application_no_jose():
    """Test that auth.application does not import python-jose."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    auth_app_dir = backend_src / "flowpay" / "auth" / "application"

    for file_path in find_python_files(auth_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from jose" not in content
        assert "import jose" not in content


def test_users_application_no_fastapi():
    """Test that users.application does not import FastAPI."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    users_app_dir = backend_src / "flowpay" / "users" / "application"

    for file_path in find_python_files(users_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from fastapi" not in content
        assert "import fastapi" not in content


def test_users_application_no_sqlalchemy():
    """Test that users.application does not import SQLAlchemy."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    users_app_dir = backend_src / "flowpay" / "users" / "application"

    for file_path in find_python_files(users_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from sqlalchemy" not in content
        assert "import sqlalchemy" not in content


def test_repositories_no_commit_or_rollback():
    """Test that repository adapters do not call commit() or rollback()."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")

    for pattern in ["*/adapters/*repository*.py", "*/adapters/*_repository.py"]:
        for file_path in backend_src.glob(f"flowpay/{pattern}"):
            if "__pycache__" in file_path.parts or "__init__" in file_path.name:
                continue

            with open(file_path, "r") as f:
                content = f.read()

            assert ".commit()" not in content
            assert ".rollback()" not in content


def test_composition_allowed_to_import_adapters():
    """Test that composition.py is allowed to import adapters from multiple modules."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    composition_file = backend_src / "flowpay" / "composition.py"

    if composition_file.exists():
        with open(composition_file, "r") as f:
            content = f.read()

        # Composition should be able to import adapters
        assert "from flowpay.auth.adapters" in content or \
               "from flowpay.users.adapters" in content or \
               "SQLAlchemy" in content


def test_wallets_does_not_import_users_adapters():
    """Test that flowpay.wallets does not import flowpay.users.adapters."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    wallets_dir = backend_src / "flowpay" / "wallets"

    if not wallets_dir.exists():
        return

    for file_path in find_python_files(wallets_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from flowpay.users.adapters" not in content
        assert "import flowpay.users.adapters" not in content


def test_wallets_does_not_import_users_orm():
    """Test that flowpay.wallets does not import users ORM models."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    wallets_dir = backend_src / "flowpay" / "wallets"

    if not wallets_dir.exists():
        return

    for file_path in find_python_files(wallets_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from flowpay.users.adapters.user_orm" not in content


def test_wallets_application_no_fastapi():
    """Test that wallets.application does not import FastAPI."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    wallets_app_dir = backend_src / "flowpay" / "wallets" / "application"

    if not wallets_app_dir.exists():
        return

    for file_path in find_python_files(wallets_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from fastapi" not in content
        assert "import fastapi" not in content


def test_wallets_application_no_sqlalchemy():
    """Test that wallets.application does not import SQLAlchemy."""
    backend_src = Path("/Users/angelbrand/Workspace/Personal/flowpay/backend/src")
    wallets_app_dir = backend_src / "flowpay" / "wallets" / "application"

    if not wallets_app_dir.exists():
        return

    for file_path in find_python_files(wallets_app_dir):
        if "__pycache__" in file_path.parts or "__init__" in file_path.name:
            continue

        with open(file_path, "r") as f:
            content = f.read()

        assert "from sqlalchemy" not in content
        assert "import sqlalchemy" not in content
