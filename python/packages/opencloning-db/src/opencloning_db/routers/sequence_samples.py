"""Sequence sample (lab tracking) endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func

from opencloning_db.apimodels import (
    DeletedResponse,
    SequenceSampleCreate,
    SequenceSampleCreated,
    SequenceSampleRead,
    SequenceSampleUpdate,
    SequenceSampleWithSequence,
    sequence_ref,
)
from opencloning_db.models import SequenceSample, WorkspaceRole
from opencloning_db.workspace_deps import (
    WorkspaceContext,
    get_editor_workspace_ctx,
    get_sequence_in_workspace_for_user,
    get_sequence_sample_in_workspace_for_user,
    get_viewer_workspace_ctx,
)

router = APIRouter(tags=['sequence_samples'])


@router.get('/sequence_samples', response_model=list[SequenceSampleWithSequence])
def get_sequence_samples(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    uid: str | None = Query(
        description='Filter sequence samples by uid (case-insensitive substring match)', default=None
    ),
):
    """List sequence samples in a workspace (lab samples with user-defined UIDs)."""
    current_user, session, workspace_id = ctx.destructure()

    query = session.query(SequenceSample).filter_by(uid_workspace_id=workspace_id)
    if uid is not None:
        query = query.filter(SequenceSample.uid.ilike(f"%{uid}%"))
    records = query.all()
    return [
        SequenceSampleWithSequence(
            id=r.id,
            uid=r.uid,
            sequence_id=r.sequence_id,
            sequence=sequence_ref(r.sequence),
        )
        for r in records
    ]


@router.post('/sequence_samples', response_model=SequenceSampleCreated)
def post_sequence_sample(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    body: SequenceSampleCreate,
):
    """Create a sequence sample. UID is user-defined, assigned before sequencing."""
    current_user, session, workspace_id = ctx.destructure()

    # Validate that the sequence exists and the user has access to it
    get_sequence_in_workspace_for_user(session, current_user, workspace_id, body.sequence_id, WorkspaceRole.editor)

    existing = (
        session.query(SequenceSample)
        .filter(
            SequenceSample.uid_workspace_id == workspace_id,
            func.lower(SequenceSample.uid) == body.uid.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"UID '{body.uid}' already exists")
    ps = SequenceSample(
        uid=body.uid,
        sequence_id=body.sequence_id,
        uid_workspace_id=workspace_id,
    )
    session.add(ps)
    session.commit()
    session.refresh(ps)
    return SequenceSampleCreated(id=ps.id, uid=ps.uid)


@router.get('/sequence_samples/{uid}', response_model=SequenceSampleRead)
def get_sequence_sample(
    uid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get a sequence sample by its user-defined UID."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.viewer)
    return SequenceSampleRead(id=ps.id, uid=ps.uid, sequence_id=ps.sequence_id)


@router.patch('/sequence_samples/{uid}', response_model=SequenceSampleRead)
def patch_sequence_sample(
    uid: str,
    body: SequenceSampleUpdate,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Update a sequence sample. Use to transfer UID to real sequence after sequencing."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.editor)
    get_sequence_in_workspace_for_user(session, current_user, workspace_id, body.sequence_id, WorkspaceRole.editor)
    ps.sequence_id = body.sequence_id
    session.commit()
    session.refresh(ps)
    return SequenceSampleRead(id=ps.id, uid=ps.uid, sequence_id=ps.sequence_id)


@router.delete('/sequence_samples/{uid}', response_model=DeletedResponse)
def delete_sequence_sample(
    uid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Delete a sequence sample."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.editor)
    sequence_id = ps.sequence_id
    session.delete(ps)
    session.commit()
    return DeletedResponse(deleted=ps.id, data={'sequence_id': sequence_id, 'uid': uid})
