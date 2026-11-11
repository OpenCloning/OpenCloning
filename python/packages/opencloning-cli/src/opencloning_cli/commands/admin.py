"""``opencloning-cli admin`` command group."""

from __future__ import annotations

import typer

from .. import admin_db

admin_app = typer.Typer(no_args_is_help=True, help='Database admin operations.')


def _handle_runtime_error(exc: RuntimeError) -> None:
    typer.echo(str(exc), err=True)
    raise typer.Exit(code=1) from exc


@admin_app.command('list-users')
def list_users_command() -> None:
    """List email addresses of all registered users."""
    try:
        emails = admin_db.list_user_emails()
    except RuntimeError as exc:
        _handle_runtime_error(exc)
    for email in emails:
        typer.echo(email)


@admin_app.command('list-workspaces')
def list_workspaces_command() -> None:
    """List all workspaces (id and name)."""
    try:
        workspaces = admin_db.list_workspaces()
    except RuntimeError as exc:
        _handle_runtime_error(exc)
    for workspace in workspaces:
        typer.echo(f"{workspace['id']}\t{workspace['name']}")


@admin_app.command('assign-user')
def assign_user_command(
    email: str = typer.Argument(help='User email to assign.'),
    workspace_id: int = typer.Argument(help='Target workspace id.'),
    role: str = typer.Option('viewer', help='Workspace role (owner, editor, or viewer).'),
) -> None:
    """Assign a user to a workspace with the given role."""
    try:
        membership = admin_db.assign_user_to_workspace(email, workspace_id, role)
    except RuntimeError as exc:
        _handle_runtime_error(exc)
    typer.echo(
        f"user_id={membership['user_id']} " f"workspace_id={membership['workspace_id']} " f"role={membership['role']}"
    )


@admin_app.command('set-instance-admin')
def set_instance_admin_command(
    email: str = typer.Argument(help='User email.'),
    grant: bool = typer.Option(
        True,
        '--grant/--revoke',
        help='Grant instance admin (--grant) or revoke it (--revoke).',
    ),
) -> None:
    """Grant or revoke instance-wide admin privileges for a user."""
    try:
        result = admin_db.set_user_instance_admin(email, is_instance_admin=grant)
    except RuntimeError as exc:
        _handle_runtime_error(exc)
    typer.echo(
        f"user_id={result['user_id']} email={result['email']} " f"is_instance_admin={result['is_instance_admin']}"
    )


__all__ = ['admin_app']
