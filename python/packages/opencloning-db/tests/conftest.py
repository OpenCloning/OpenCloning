import os
from typing import Generator

from sqlalchemy.orm import Session

from opencloning_db.config import Config, OidcConfig, _peek_config
import opencloning_db.db as db_module
from fastapi.testclient import TestClient
from opencloning_db.api import app, fastapi_app
from opencloning_db.deps import get_db
from sqlalchemy.engine import Engine
import pytest

from opencloning_db.migrations import reset_database

_TEST_DATABASE_URL_WRITE = os.environ.get(
    'OPENCLONING_TEST_DATABASE_URL',
    'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_test',
)
_TEST_DATABASE_URL_READONLY = os.environ.get(
    'OPENCLONING_TEST_DATABASE_URL_READONLY',
    'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_test_readonly',
)


def _build_postgres_test_config(default_config: Config | None, database_url: str) -> Generator[Config, None, None]:
    """Postgres test config with DB-backed sequence content."""
    test_config = Config(
        database_url=database_url,
        oidc_config=OidcConfig(
            issuer_url='https://test.example',
            authorized_parties=[
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:3002',
            ],
            test_mode=True,
        ),
    )
    db_module.reset_runtime_state(test_config)
    yield test_config
    db_module.reset_runtime_state(default_config)


@pytest.fixture
def postgres_test_config_write() -> Generator[Config, None, None]:
    """Function-scoped config for mutating tests."""
    yield from _build_postgres_test_config(_peek_config(), _TEST_DATABASE_URL_WRITE)


@pytest.fixture(scope='module')
def postgres_test_config_readonly() -> Generator[Config, None, None]:
    """Module-scoped config for readonly_db-marked tests."""
    yield from _build_postgres_test_config(_peek_config(), _TEST_DATABASE_URL_READONLY)


@pytest.fixture
def postgres_test_engine_write(postgres_test_config_write: Config) -> Generator[Engine, None, None]:
    """Fresh schema bound to the shared Postgres test database."""
    engine = db_module.get_engine(postgres_test_config_write)
    reset_database(engine)
    yield engine


@pytest.fixture(scope='module')
def postgres_test_engine_readonly(postgres_test_config_readonly: Config) -> Generator[Engine, None, None]:
    """Single DB reset for readonly_db-marked tests in one module."""
    engine = db_module.get_engine(postgres_test_config_readonly)
    reset_database(engine)
    yield engine


def _engine_client_config(
    postgres_test_config: Config,
    postgres_test_engine: Engine,
) -> Generator[tuple[Engine, TestClient, Config], None, None]:
    """Shared TestClient/get_db wiring used by write and readonly chains."""

    def override_get_db():
        session = Session(postgres_test_engine)
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield postgres_test_engine, client, postgres_test_config
    fastapi_app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def engine_client_config_write(
    postgres_test_config_write: Config,
    postgres_test_engine_write: Engine,
) -> Generator[tuple[Engine, TestClient, Config], None, None]:
    """Write DB (function scope) for mutating tests."""
    yield from _engine_client_config(postgres_test_config_write, postgres_test_engine_write)


@pytest.fixture(scope='module')
def engine_client_config_readonly(
    postgres_test_config_readonly: Config,
    postgres_test_engine_readonly: Engine,
) -> Generator[tuple[Engine, TestClient, Config], None, None]:
    """Readonly DB (module scope) shared by readonly_db-marked tests."""
    yield from _engine_client_config(postgres_test_config_readonly, postgres_test_engine_readonly)
