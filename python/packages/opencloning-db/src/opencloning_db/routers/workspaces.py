"""Workspace listing endpoints for the current user."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from opencloning_db.apimodels import (
    DeletedResponse,
    UserWithRoleRef,
    WorkspaceCreate,
    WorkspaceMemberAdd,
    WorkspaceRef,
    WorkspaceRename,
    user_with_role_ref,
)
from opencloning_db.utils import normalize_email
from opencloning_db.deps import get_current_user, get_db
from opencloning_db.models import User, Workspace, WorkspaceMembership, WorkspaceRole
from opencloning_db.workspace_auth import assert_workspace_access, would_remove_last_owner
from opencloning_db.db_utils import get_workspace_or_404

router = APIRouter(tags=['workspaces'])


@router.post('/workspaces', response_model=WorkspaceRef)
def create_workspace(
    body: WorkspaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> WorkspaceRef:
    if not current_user.is_instance_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only instance admins can create workspaces',
        )
    workspace = Workspace(name=body.name)
    session.add(workspace)
    session.flush()
    session.add(
        WorkspaceMembership(
            user_id=current_user.id,
            workspace_id=workspace.id,
            role=WorkspaceRole.owner,
        )
    )
    session.commit()
    return WorkspaceRef(
        id=workspace.id,
        name=workspace.name,
        role=WorkspaceRole.owner.value,
    )


@router.get('/workspaces', response_model=list[WorkspaceRef])
def list_workspaces(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> list[WorkspaceRef]:
    memberships = session.scalars(
        select(WorkspaceMembership)
        .join(Workspace, Workspace.id == WorkspaceMembership.workspace_id)
        .where(WorkspaceMembership.user_id == current_user.id)
        .order_by(Workspace.id.asc())
    ).all()
    return [
        WorkspaceRef(
            id=membership.workspace.id,
            name=membership.workspace.name,
            role=membership.role.value,
        )
        for membership in memberships
    ]


@router.get('/workspaces/{workspace_id}', response_model=WorkspaceRef)
def get_workspace(
    workspace_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> WorkspaceRef:
    workspace = get_workspace_or_404(session, workspace_id)
    membership = assert_workspace_access(
        session,
        current_user.id,
        workspace_id,
        WorkspaceRole.viewer,
    )
    return WorkspaceRef(
        id=workspace.id,
        name=workspace.name,
        role=membership.role.value,
    )


@router.patch('/workspaces/{workspace_id}', response_model=WorkspaceRef)
def rename_workspace(
    workspace_id: int,
    body: WorkspaceRename,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> WorkspaceRef:
    workspace = get_workspace_or_404(session, workspace_id)
    membership = assert_workspace_access(
        session,
        current_user.id,
        workspace_id,
        WorkspaceRole.owner,
    )
    workspace.name = body.name
    session.commit()
    return WorkspaceRef(
        id=workspace.id,
        name=workspace.name,
        role=membership.role.value,
    )


@router.get('/workspaces/{workspace_id}/users', response_model=list[UserWithRoleRef])
def list_workspace_users(
    workspace_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> list[UserWithRoleRef]:
    get_workspace_or_404(session, workspace_id)
    assert_workspace_access(
        session,
        current_user.id,
        workspace_id,
        WorkspaceRole.owner,
    )
    memberships = session.scalars(
        select(WorkspaceMembership)
        .options(selectinload(WorkspaceMembership.user))
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .order_by(WorkspaceMembership.user_id.asc())
    ).all()
    return [user_with_role_ref(membership.user, membership.role) for membership in memberships]


@router.post('/workspaces/{workspace_id}/users', response_model=UserWithRoleRef)
def add_or_update_workspace_user(
    workspace_id: int,
    body: WorkspaceMemberAdd,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> UserWithRoleRef:
    get_workspace_or_404(session, workspace_id)
    assert_workspace_access(
        session,
        current_user.id,
        workspace_id,
        WorkspaceRole.owner,
    )

    user = session.scalar(select(User).where(User.email == normalize_email(body.email)))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    existing = session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.user_id == user.id,
            WorkspaceMembership.workspace_id == workspace_id,
        )
    )

    if existing is not None:
        if existing.role == body.role:
            response.status_code = status.HTTP_200_OK
            return user_with_role_ref(user, existing.role)
        if would_remove_last_owner(session, workspace_id, existing, body.role):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail='Workspace must have at least one owner',
            )
        existing.role = body.role
        session.commit()
        response.status_code = status.HTTP_200_OK
        return user_with_role_ref(user, existing.role)

    session.add(
        WorkspaceMembership(
            user_id=user.id,
            workspace_id=workspace_id,
            role=body.role,
        )
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='User is already a member of this workspace',
        ) from None

    response.status_code = status.HTTP_201_CREATED
    return user_with_role_ref(user, body.role)


@router.delete('/workspaces/{workspace_id}/users/{user_id}', response_model=DeletedResponse)
def remove_workspace_user(
    workspace_id: int,
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> DeletedResponse:
    get_workspace_or_404(session, workspace_id)
    assert_workspace_access(
        session,
        current_user.id,
        workspace_id,
        WorkspaceRole.owner,
    )
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Cannot remove yourself from the workspace',
        )

    membership = session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.user_id == user_id,
            WorkspaceMembership.workspace_id == workspace_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User is not a member of this workspace',
        )

    # This should never be reached because self-removal is forbidden.
    if would_remove_last_owner(session, workspace_id, membership, WorkspaceRole.viewer):  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Workspace must have at least one owner',
        )

    session.delete(membership)
    session.commit()
    return DeletedResponse(deleted=user_id)
