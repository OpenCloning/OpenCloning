"""Top-level Typer application for ``opencloning-cli``.

The entry point registered in ``pyproject.toml`` as ``opencloning-cli`` is
:data:`app`.
"""

from __future__ import annotations

import typer

from .commands.admin import admin_app
from .commands.db import db_app


app = typer.Typer(
    no_args_is_help=True,
    help='Command-line tools for OpenCloning.',
)
app.add_typer(db_app, name='db')
app.add_typer(admin_app, name='admin')


if __name__ == '__main__':  # pragma: no cover
    app()
