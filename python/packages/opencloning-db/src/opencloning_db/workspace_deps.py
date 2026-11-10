"""Shared workspace-scoped dependencies and helpers."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from opencloning_db.context import WriteContext
from opencloning_db.deps import get_current_user, get_db
from opencloning_db.models import (
    BaseSequence,
    InputEntity,
    Line,
    Primer,
    Sequence,
    SequenceSample,
    SequenceType,
    Tag,
    User,
    WorkspaceRole,
)
from opencloning_db.workspace_auth import assert_workspace_access


@dataclass(frozen=True, slots=True)
class WorkspaceContext(WriteContext):
    """Per-request write context plus the bound DB session."""

    session: Session

    def destructure(self) -> tuple[User, Session, int]:
        return self.user, self.session, self.workspace_id


def get_viewer_workspace_ctx(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
    workspace_id: int = Header(alias='X-Workspace-Id', description='Workspace id'),
) -> WorkspaceContext:
    """Workspace-scoped context for read-only endpoints."""
    assert_workspace_access(session, user.id, workspace_id, WorkspaceRole.viewer)
    return WorkspaceContext(user=user, workspace_id=workspace_id, session=session)


def get_editor_workspace_ctx(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
    workspace_id: int = Header(alias='X-Workspace-Id', description='Workspace id'),
) -> WorkspaceContext:
    """Workspace-scoped context for write endpoints."""
    assert_workspace_access(session, user.id, workspace_id, WorkspaceRole.editor)
    return WorkspaceContext(user=user, workspace_id=workspace_id, session=session)


def get_resource_for_user(
    session: Session,
    user: User,
    resource_id: int,
    min_role: WorkspaceRole,
    resource_type: Primer | Sequence | Line | Tag | InputEntity,
) -> Primer | Sequence | Line | Tag | InputEntity:
    resource = session.get(resource_type, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail=f"{resource_type.__name__} not found")
    assert_workspace_access(session, user.id, resource.workspace_id, min_role)
    return resource


def _require_selected_workspace(
    entity_workspace_id: int,
    selected_workspace_id: int,
    not_found_detail: str,
) -> None:
    if entity_workspace_id != selected_workspace_id:
        raise HTTPException(status_code=404, detail=not_found_detail)


def _require_sequence_type(
    sequence: BaseSequence,
    expected_type: SequenceType,
    sequence_id: int,
) -> None:
    if sequence.sequence_type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sequence {sequence_id} is not of type '{expected_type.value}'",
        )


def get_resource_in_workspace_for_user(
    session: Session,
    user: User,
    workspace_id: int,
    resource_id: int,
    min_role: WorkspaceRole,
    resource_type: Primer | BaseSequence | Line | Tag | InputEntity,
) -> Primer | BaseSequence | Line | Tag | InputEntity:
    resource = get_resource_for_user(session, user, resource_id, min_role, resource_type)
    _require_selected_workspace(resource.workspace_id, workspace_id, f"{resource_type.__name__} not found")
    return resource


def get_primer_in_workspace_for_user(
    session: Session, user: User, workspace_id: int, primer_id: int, min_role: WorkspaceRole
) -> Primer:
    return get_resource_in_workspace_for_user(session, user, workspace_id, primer_id, min_role, Primer)


def get_sequence_in_workspace_for_user(
    session: Session,
    user: User,
    workspace_id: int,
    sequence_id: int,
    min_role: WorkspaceRole,
    expected_type: SequenceType | None = None,
) -> BaseSequence:
    seq = get_resource_in_workspace_for_user(session, user, workspace_id, sequence_id, min_role, BaseSequence)
    if expected_type is not None:
        _require_sequence_type(seq, expected_type, sequence_id)
    return seq


def get_line_in_workspace_for_user(
    session: Session, user: User, workspace_id: int, line_id: int, min_role: WorkspaceRole
) -> Line:
    return get_resource_in_workspace_for_user(session, user, workspace_id, line_id, min_role, Line)


def get_tag_in_workspace_for_user(
    session: Session, user: User, workspace_id: int, tag_id: int, min_role: WorkspaceRole
) -> Tag:
    return get_resource_in_workspace_for_user(session, user, workspace_id, tag_id, min_role, Tag)


def get_input_entity_in_workspace_for_user(
    session: Session, user: User, workspace_id: int, entity_id: int, min_role: WorkspaceRole
) -> InputEntity:
    return get_resource_in_workspace_for_user(session, user, workspace_id, entity_id, min_role, InputEntity)


def get_sequence_sample_in_workspace_for_user(
    session: Session, user: User, workspace_id: int, uid: str, min_role: WorkspaceRole
) -> SequenceSample:
    sample = (
        session.query(SequenceSample)
        .filter(
            SequenceSample.uid_workspace_id == workspace_id,
            func.lower(SequenceSample.uid) == uid.lower(),
        )
        .first()
    )
    if sample is None:
        raise HTTPException(status_code=404, detail='Sequence sample not found')

    assert_workspace_access(session, user.id, sample.uid_workspace_id, min_role)
    return sample
