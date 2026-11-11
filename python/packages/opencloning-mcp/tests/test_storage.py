import threading
from datetime import timedelta

import pytest
from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy.orm import Session

from opencloning_mcp import storage
from opencloning_mcp.db import StoredStrategy, engine


def get_row(strategy_id: str) -> StoredStrategy | None:
    with Session(engine) as session:
        return session.get(StoredStrategy, strategy_id)


def set_last_used_at(strategy_id: str, minutes_ago: int):
    with Session(engine) as session:
        row = session.get(StoredStrategy, strategy_id)
        row.last_used_at = row.last_used_at - timedelta(minutes=minutes_ago)
        session.commit()


def test_create_and_load():
    strategy_id = storage.create_strategy('my strategy')
    strategy = storage.load_strategy(strategy_id)
    assert strategy['description'] == 'my strategy'
    assert strategy['sources'] == strategy['sequences'] == strategy['primers'] == []


def test_load_marks_strategy_as_used():
    strategy_id = storage.create_strategy()
    set_last_used_at(strategy_id, minutes_ago=10)
    before = get_row(strategy_id).last_used_at
    storage.load_strategy(strategy_id)
    assert get_row(strategy_id).last_used_at > before


def test_inactive_strategies_are_deleted():
    active_id = storage.create_strategy()
    inactive_id = storage.create_strategy()
    set_last_used_at(inactive_id, minutes_ago=storage.INACTIVITY_MINUTES + 1)

    # Before the cleanup runs, the inactive strategy is already treated as gone
    with pytest.raises(ToolError, match='Unknown or expired strategy_id'):
        storage.load_strategy(inactive_id)

    storage.delete_inactive_strategies()
    assert get_row(inactive_id) is None
    assert get_row(active_id) is not None


def test_unknown_strategy_id():
    with pytest.raises(ToolError, match='Unknown or expired strategy_id'):
        storage.load_strategy('does-not-exist')


def test_append_step_gives_source_and_sequence_the_same_new_id():
    strategy_id = storage.create_strategy()
    primer_id = storage.add_primer(strategy_id, 'fwd', 'ACGT')
    sequence_id = storage.append_step(strategy_id, {'type': 'ManuallyTypedSource', 'input': []}, {'type': 'X'})
    assert (primer_id, sequence_id) == (1, 2)

    strategy = storage.load_strategy(strategy_id)
    assert strategy['sources'][0]['id'] == strategy['sequences'][0]['id'] == 2


def test_parallel_appends_do_not_lose_steps():
    strategy_id = storage.create_strategy()
    n_threads, steps_per_thread = 4, 5
    start_together = threading.Barrier(n_threads)

    def append_steps():
        start_together.wait()
        for _ in range(steps_per_thread):
            storage.append_step(strategy_id, {'type': 'ManuallyTypedSource', 'input': []}, {'type': 'X'})

    threads = [threading.Thread(target=append_steps) for _ in range(n_threads)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    strategy = storage.load_strategy(strategy_id)
    ids = [sequence['id'] for sequence in strategy['sequences']]
    assert sorted(ids) == list(range(1, n_threads * steps_per_thread + 1))
