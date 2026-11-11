"""Direct database access for admin CLI commands."""

from __future__ import annotations

from typing import Any

import opencloning_db.db as db_module
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from opencloning_db.utils import normalize_email
from fastapi import HTTPException
from opencloning_db.config import get_config
from opencloning_db.db_utils import get_workspace_or_404
from opencloning_db.models import User, Workspace, WorkspaceMembership, WorkspaceRole


def _parse_workspace_role(role: str) -> WorkspaceRole:
    try:
        return WorkspaceRole(role)
    except ValueError as exc:
        raise RuntimeError(f'Invalid role: {role}') from exc


def _get_user_by_email(session: Session, email: str) -> User:
    # Exact (case-insensitive) match
    users = session.scalars(select(User).where(func.lower(User.email) == normalize_email(email))).all()
    if not users:
        raise RuntimeError('User not found')
    if len(users) > 1:
        raise RuntimeError(f'Multiple users match email {email}')
    return users[0]


def list_user_emails() -> list[str]:
    config = get_config()
    with Session(db_module.get_engine(config)) as session:
        return list(session.scalars(select(User.email).order_by(User.email.asc())).all())


def list_workspaces() -> list[dict[str, Any]]:
    config = get_config()
    with Session(db_module.get_engine(config)) as session:
        workspaces = session.scalars(select(Workspace).order_by(Workspace.id.asc())).all()
        return [{'id': workspace.id, 'name': workspace.name} for workspace in workspaces]


def assign_user_to_workspace(email: str, workspace_id: int, role: str) -> dict[str, Any]:
    config = get_config()
    workspace_role = _parse_workspace_role(role)

    with Session(db_module.get_engine(config)) as session:
        try:
            get_workspace_or_404(session, workspace_id)
        except HTTPException as exc:
            raise RuntimeError('Workspace not found') from exc

        user = _get_user_by_email(session, email)

        membership = session.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.user_id == user.id,
                WorkspaceMembership.workspace_id == workspace_id,
            )
        )
        if membership is None:
            membership = WorkspaceMembership(
                user_id=user.id,
                workspace_id=workspace_id,
                role=workspace_role,
            )
            session.add(membership)
        else:
            membership.role = workspace_role
        session.commit()
        return {
            'user_id': user.id,
            'workspace_id': workspace_id,
            'role': membership.role.value,
        }


def set_user_instance_admin(email: str, *, is_instance_admin: bool) -> dict[str, Any]:
    config = get_config()

    with Session(db_module.get_engine(config)) as session:
        user = _get_user_by_email(session, email)

        user.is_instance_admin = is_instance_admin
        session.commit()
        return {
            'user_id': user.id,
            'email': user.email,
            'is_instance_admin': user.is_instance_admin,
        }
