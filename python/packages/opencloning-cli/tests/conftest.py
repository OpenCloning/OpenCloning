"""Shared fixtures for opencloning-cli smoke tests."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Generator

import pytest

from opencloning_db.config import Config, OidcConfig, _peek_config
import opencloning_db.db as db_module

_TEST_DATABASE_URL = os.environ.get(
    'OPENCLONING_TEST_DATABASE_URL',
    'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_test',
)


@pytest.fixture
def temp_workspace() -> Generator[tuple[Path, Config], None, None]:
    """Yield ``(workspace_dir, config)`` pointing at a temp test workspace."""
    default_config = _peek_config()

    config = Config(
        database_url=_TEST_DATABASE_URL,
        oidc_config=OidcConfig(
            issuer_url='https://test.example',
            authorized_parties=['http://localhost:3002'],
            test_mode=True,
        ),
    )
    db_module.reset_runtime_state(config)
    with tempfile.TemporaryDirectory(prefix='opencloning-cli-test-') as tmp:
        workspace = Path(tmp)
        yield workspace, config
    db_module.reset_runtime_state(default_config)
