"""Workspace membership checks for API routes."""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi import HTTPException, status

from opencloning_db.models import WorkspaceMembership, WorkspaceRole

logger = logging.getLogger('opencloning_db.auth')

_ROLE_ORDER: dict[WorkspaceRole, int] = {
    WorkspaceRole.viewer: 0,
    WorkspaceRole.editor: 1,
    WorkspaceRole.owner: 2,
}


def has_at_least(role: WorkspaceRole, minimum: WorkspaceRole) -> bool:
    return _ROLE_ORDER[role] >= _ROLE_ORDER[minimum]


def assert_workspace_access(
    session: Session,
    user_id: int,
    workspace_id: int,
    min_role: WorkspaceRole,
) -> WorkspaceMembership:
    """
    Require membership in workspace with at least ``min_role``.
    Raises 403 otherwise.
    """
    membership = session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.user_id == user_id,
            WorkspaceMembership.workspace_id == workspace_id,
        )
    )
    if membership is None or not has_at_least(membership.role, min_role):
        logger.warning(
            'access_denied',
            extra={
                'reason': 'not_member' if membership is None else 'insufficient_role',
                'workspace_id': workspace_id,
                'required_role': min_role.value,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not allowed for this workspace')
    return membership


def would_remove_last_owner(
    session: Session,
    workspace_id: int,
    membership: WorkspaceMembership,
    new_role: WorkspaceRole,
) -> bool:
    if membership.role != WorkspaceRole.owner or new_role == WorkspaceRole.owner:
        return False
    owner_count = session.scalar(
        select(func.count())
        .select_from(WorkspaceMembership)
        .where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.role == WorkspaceRole.owner,
        )
    )
    return (owner_count or 0) <= 1
