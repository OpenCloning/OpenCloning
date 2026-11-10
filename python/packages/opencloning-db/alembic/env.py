import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from opencloning_db.models import Base

config = context.config

if config.config_file_name is not None:
    # Do not disable loggers that already exist in the process (e.g. the app's own loggers when
    # migrations run in-process), which is what fileConfig does by default.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def get_url() -> str:
    """Prefer an explicit config URL (programmatic API), then OPENCLONING_DB_URL."""
    url = config.get_main_option('sqlalchemy.url')
    if url and not url.startswith('driver://'):
        return url
    url = os.environ.get('OPENCLONING_DB_URL')
    if url:
        return url
    raise RuntimeError('OPENCLONING_DB_URL is required for Alembic. For local development load .env.dev')


def _configure_context(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        **kwargs,
    )


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    _configure_context(
        url=get_url(),
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(get_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        _configure_context(connection=connection)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
