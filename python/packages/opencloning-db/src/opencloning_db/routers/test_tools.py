"""Test-only backend utilities."""

from __future__ import annotations

import os
import subprocess

from fastapi import APIRouter, Header, HTTPException, Response, status
import opencloning_db.db as db_module
from opencloning_db.config import parse_bool

router = APIRouter(prefix='/__test', tags=['test-tools'])


def _dispose_engine() -> None:
    if db_module._engine is not None:
        db_module._engine.dispose()
        db_module._engine = None
        db_module._bound_database_url = None


@router.post('/reset-db', status_code=status.HTTP_204_NO_CONTENT)
def reset_db(x_test_reset_token: str | None = Header(default=None)) -> Response:
    """Reset DB by delegating to ``opencloning-cli db seed``."""

    if not parse_bool(os.getenv('OPENCLONING_TESTING', False)) or x_test_reset_token != 'RESET-TOKEN':
        raise HTTPException(status_code=403, detail='Forbidden')

    _dispose_engine()

    result = subprocess.run(
        ['opencloning-cli', 'db', 'seed'],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or 'Reset command failed'
        raise HTTPException(status_code=500, detail=message)

    _dispose_engine()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
