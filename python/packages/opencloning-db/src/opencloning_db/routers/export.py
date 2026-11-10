"""Workspace export endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from opencloning_db.apimodels import (
    TagRead,
    UserRef,
    WorkspaceExport,
    export_line_ref,
    export_primer_ref,
    export_sequence_ref,
)
from opencloning_db.db import build_workspace_cloning_strategy
from opencloning_db.models import BaseSequence, InputEntity, Line, Primer, Tag, User, WorkspaceMembership
from opencloning_db.workspace_deps import WorkspaceContext, get_viewer_workspace_ctx

router = APIRouter(tags=['export'])


@router.get('/export', response_model=WorkspaceExport)
def export_workspace(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Export all lines, primers, sequences, tags, and workspace members as API references."""
    _, session, workspace_id = ctx.destructure()

    lines = session.scalars(
        select(Line)
        .options(
            selectinload(Line.sequences_in_line),
            selectinload(Line.parents),
            selectinload(Line.tags),
        )
        .where(Line.workspace_id == workspace_id)
        .order_by(Line.id.desc())
    ).all()

    primers = session.scalars(
        select(Primer)
        .where(Primer.workspace_id == workspace_id)
        .options(selectinload(InputEntity.tags))
        .order_by(Primer.id.desc())
    ).all()

    sequences = session.scalars(
        select(BaseSequence)
        .options(
            selectinload(InputEntity.tags),
            selectinload(BaseSequence.instances),
            selectinload(InputEntity.source_inputs),
        )
        .where(BaseSequence.workspace_id == workspace_id)
        .order_by(BaseSequence.id.desc())
    ).all()

    tags = session.scalars(select(Tag).where(Tag.workspace_id == workspace_id).order_by(Tag.id.asc())).all()

    users = session.scalars(
        select(User)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .order_by(User.id.asc())
    ).all()

    return WorkspaceExport(
        lines=[export_line_ref(line) for line in lines],
        primers=[export_primer_ref(primer) for primer in primers],
        sequences=[export_sequence_ref(sequence) for sequence in sequences],
        tags=[TagRead(id=tag.id, name=tag.name) for tag in tags],
        users=[UserRef(id=user.id, display_name=user.display_name) for user in users],
        cloning_strategy=build_workspace_cloning_strategy(session, ctx, sequences),
    )
