"""``opencloning-cli db`` command group.

Nested layout::

        db
            migrate
            seed
            stubs

Each command delegates directly to :mod:`lifecycle`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from .. import lifecycle

db_app = typer.Typer(no_args_is_help=True, help='Database management commands.')

StubOutputDirOption = Annotated[
    Path,
    typer.Option(
        '--output-dir',
        help='Override generated stubs directory (default: ./stubs/db).',
    ),
]

RecreateSchemaOption = Annotated[
    bool,
    typer.Option(
        '--recreate-schema',
        help='Drop and recreate the public schema before migrating (destructive).',
    ),
]


@db_app.command('migrate')
def migrate_command() -> None:
    """Apply Alembic migrations to the configured database."""
    lifecycle.migrate()


@db_app.command('seed')
def seed_command(
    recreate_schema: RecreateSchemaOption = False,
) -> None:
    """Recreate the local test baseline. Requires ``OPENCLONING_TESTING=1``."""
    try:
        lifecycle.seed(recreate_schema=recreate_schema)
    except RuntimeError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=1) from exc


@db_app.command('stubs')
def stubs_command(
    output_dir: StubOutputDirOption = Path('stubs/db'),
) -> None:
    """Generate stubs for DB/frontend testing."""
    try:
        lifecycle.write_stubs(output_dir)
    except RuntimeError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=1) from exc


__all__ = ['db_app']
