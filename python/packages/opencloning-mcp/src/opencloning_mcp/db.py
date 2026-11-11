"""Database model and setup. A single table: one row per cloning strategy.

There are no migrations: the table is created at startup if it does not exist.
"""

import os
from datetime import datetime, timezone

from sqlalchemy import JSON, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    # Stored without timezone, because SQLite does not keep it. All times in the table are UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class StoredStrategy(Base):
    __tablename__ = 'mcp_strategy'

    # The strategy_id that the model passes to every tool (a random token)
    id: Mapped[str] = mapped_column(primary_key=True)
    # The OpenCloning CloningStrategy JSON
    strategy: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    # Updated every time a tool uses the strategy, inactive strategies are deleted
    last_used_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)


engine = create_engine(os.environ.get('OPENCLONING_MCP_DB_URL', 'sqlite:///opencloning_mcp.sqlite'))


# Arbitrary number that identifies our lock in Postgres
INIT_LOCK_KEY = 7_345_001


def init_db():
    # Every gunicorn worker runs this at startup. On Postgres, two workers creating the table at the same
    # time make one of them fail, so they take turns: the lock is released when the transaction ends, and
    # then create_all sees the table made by the first worker.
    with engine.begin() as connection:
        if engine.dialect.name == 'postgresql':
            connection.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': INIT_LOCK_KEY})
        Base.metadata.create_all(connection)
