"""Unit tests for stub lifecycle helpers."""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session
from sqlalchemy import text

import opencloning_db.db as db_module
from opencloning_db.models import SequencingFile, User, Sequence
from opencloning_db.migrations import reset_database
from opencloning_cli.lifecycle import _STUB_CREATED_AT, _replace_created_at_in_json, seed


def test_replace_created_at_nested_and_lists():
    original = {
        'items': [
            {'id': 1, 'created_at': '2026-01-01T00:00:00Z', 'nested': {'created_at': 'x'}},
            {'created_at': None},
        ],
        'created_at': 'old',
        'keep': 42,
    }
    out = _replace_created_at_in_json(original)

    assert out['created_at'] == _STUB_CREATED_AT
    assert out['keep'] == 42
    assert out['items'][0]['id'] == 1
    assert out['items'][0]['created_at'] == _STUB_CREATED_AT
    assert out['items'][0]['nested']['created_at'] == _STUB_CREATED_AT
    assert out['items'][1]['created_at'] == _STUB_CREATED_AT
    # input must be unchanged (no shared dict mutation)
    assert original['created_at'] == 'old'


def test_replace_created_at_scalars_unchanged():
    assert _replace_created_at_in_json('text') == 'text'
    assert _replace_created_at_in_json(3) == 3
    assert _replace_created_at_in_json(None) is None


def test_seed_requires_testing_mode(monkeypatch):
    monkeypatch.delenv('OPENCLONING_TESTING', raising=False)
    with pytest.raises(RuntimeError, match='OPENCLONING_TESTING=1'):
        seed(recreate_schema=True)


def test_seed_recreate_schema_rebuilds_broken_schema(temp_workspace, monkeypatch):
    """Dropping an app table is repaired by recreate_schema + migrate + seed."""
    _, config = temp_workspace
    monkeypatch.setenv('OPENCLONING_TESTING', '1')
    engine = db_module.get_engine(config)
    reset_database(engine)

    with engine.begin() as conn:
        conn.execute(text('DROP TABLE "user" CASCADE'))
    engine.dispose()

    seed(recreate_schema=True)

    with Session(db_module.get_engine(config)) as session:
        assert session.query(User).count() > 0
        assert session.query(SequencingFile).count() == 3
        assert session.query(Sequence).count() == 56
