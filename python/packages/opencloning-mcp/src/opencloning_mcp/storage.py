"""Read and write cloning strategies in the database.

A strategy is stored as the OpenCloning CloningStrategy JSON (a plain dict). Every function that receives
a strategy_id also marks the strategy as used, and strategies unused for INACTIVITY_MINUTES are deleted.
"""

import copy
import os
import secrets
import threading
from datetime import datetime, timedelta

from mcp.server.mcpserver.exceptions import ToolError
from opencloning.pydantic_models import BaseCloningStrategy
from sqlalchemy import delete
from sqlalchemy.orm import Session

from .db import StoredStrategy, engine, utcnow

INACTIVITY_MINUTES = int(os.environ.get('OPENCLONING_MCP_INACTIVITY_MINUTES', '30'))

# Parallel tool calls on the same strategy must not overwrite each other's steps, so writes
# (read row -> append -> save) happen one at a time. The thread lock covers the threads of one process
# (and SQLite, which ignores row locks); with several processes (e.g. gunicorn workers on Postgres) the
# writers also lock the row, see _get_active_row.
_write_lock = threading.Lock()


def inactivity_cutoff() -> datetime:
    return utcnow() - timedelta(minutes=INACTIVITY_MINUTES)


def create_strategy(description: str = '') -> str:
    """Store a new empty strategy and return its strategy_id."""
    strategy_id = secrets.token_urlsafe(32)
    empty_strategy = BaseCloningStrategy(sequences=[], sources=[], primers=[], description=description)
    with Session(engine) as session:
        session.add(StoredStrategy(id=strategy_id, strategy=empty_strategy.model_dump(mode='json')))
        session.commit()
    return strategy_id


def _get_active_row(session: Session, strategy_id: str, for_update: bool = False) -> StoredStrategy:
    # for_update: SELECT ... FOR UPDATE, other transactions wait for this one to commit (ignored by SQLite)
    row = session.get(StoredStrategy, strategy_id, with_for_update=for_update)
    # Rows past the cutoff may still be in the table until the next cleanup, they count as deleted
    if row is None or row.last_used_at < inactivity_cutoff():
        raise ToolError(
            f'Unknown or expired strategy_id (strategies are deleted after {INACTIVITY_MINUTES} minutes '
            'without use). Start a new one with start_strategy.'
        )
    return row


def load_strategy(strategy_id: str) -> dict:
    """Return the strategy JSON, and mark the strategy as used."""
    with Session(engine) as session:
        row = _get_active_row(session, strategy_id)
        strategy = row.strategy
        row.last_used_at = utcnow()
        session.commit()
    return strategy


def get_by_id(strategy: dict, list_name: str, ids: list[int]) -> list[dict]:
    """Get items ('sequences' or 'primers') of the strategy by id, in the given order."""
    items_by_id = {item['id']: item for item in strategy[list_name]}
    for item_id in ids:
        if item_id not in items_by_id:
            raise ToolError(
                f'There is no item with id {item_id} in the {list_name} of this strategy. '
                f'The ids of {list_name} are: {sorted(items_by_id)}'
            )
    return [items_by_id[item_id] for item_id in ids]


def next_id(strategy: dict) -> int:
    """Sources, sequences and primers share one id space (same rule as BaseCloningStrategy.next_id)."""
    ids = [item['id'] for key in ('sources', 'sequences', 'primers') for item in strategy[key]]
    return max(ids, default=0) + 1


def _append_with_new_id(strategy_id: str, new_items: dict[str, dict]) -> int:
    """Append items to lists of the strategy, all with the same new id, and return that id.

    `new_items` maps a list name to the item to append, e.g. {'primers': primer}.
    """
    with _write_lock, Session(engine) as session:
        # Read the latest version here, inside the lock, not the one the caller loaded before
        row = _get_active_row(session, strategy_id, for_update=True)
        strategy = copy.deepcopy(row.strategy)
        new_id = next_id(strategy)
        for list_name, item in new_items.items():
            strategy[list_name].append({**item, 'id': new_id})
        # Assign a new dict: SQLAlchemy does not detect changes made inside a JSON value
        row.strategy = strategy
        row.last_used_at = utcnow()
        session.commit()
    return new_id


def append_step(strategy_id: str, source: dict, sequence: dict) -> int:
    """Add a cloning step: a source and the sequence it produced. Returns the new sequence id.

    The source and its output sequence get the same id, that is how OpenCloning links a sequence
    to the step that produced it. The ids in source['input'] refer to sequences/primers already in
    the strategy, so they don't change.
    """
    return _append_with_new_id(strategy_id, {'sources': source, 'sequences': sequence})


def add_primer(strategy_id: str, name: str, sequence: str) -> int:
    """Add a primer to the strategy and return its id."""
    return _append_with_new_id(strategy_id, {'primers': {'type': 'Primer', 'name': name, 'sequence': sequence}})


def rename_sequence(strategy_id: str, sequence_id: int, name: str, renamed_sequence: dict) -> None:
    """Replace a sequence of the strategy with its renamed version (see the rename_sequence tool)."""
    with _write_lock, Session(engine) as session:
        row = _get_active_row(session, strategy_id, for_update=True)
        strategy = copy.deepcopy(row.strategy)
        for sequence in strategy['sequences']:
            if sequence['id'] == sequence_id:
                sequence.update(renamed_sequence, id=sequence_id)
        # The source that produced the sequence records the name it was given
        for source in strategy['sources']:
            if source['id'] == sequence_id:
                source['output_name'] = name
        row.strategy = strategy
        row.last_used_at = utcnow()
        session.commit()


def replace_sequence(strategy_id: str, sequence_id: int, new_fields: dict) -> None:
    """Change a sequence of the strategy in place, e.g. its annotations (see tools_annotations.py)."""
    with _write_lock, Session(engine) as session:
        row = _get_active_row(session, strategy_id, for_update=True)
        strategy = copy.deepcopy(row.strategy)
        for sequence in strategy['sequences']:
            if sequence['id'] == sequence_id:
                sequence.update(new_fields, id=sequence_id)
        row.strategy = strategy
        row.last_used_at = utcnow()
        session.commit()


def delete_inactive_strategies() -> int:
    """Delete strategies unused for INACTIVITY_MINUTES. Returns how many were deleted."""
    with Session(engine) as session:
        result = session.execute(delete(StoredStrategy).where(StoredStrategy.last_used_at < inactivity_cutoff()))
        session.commit()
    return result.rowcount
