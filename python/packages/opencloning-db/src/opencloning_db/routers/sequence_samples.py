"""Sequence sample (lab tracking) endpoints, including the sequencing files of the samples."""

from typing import Annotated, List
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from opencloning.endpoints.endpoint_utils import read_upload_with_limit
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from opencloning_db.apimodels import (
    DeletedResponse,
    SequenceSampleCreate,
    SequenceSampleCreated,
    SequenceSampleRead,
    SequenceSampleReassign,
    SequenceSampleUpdate,
    SequenceSampleWithSequence,
    SequencingFileRef,
    sequence_sample_read,
    sequence_sample_with_sequence,
    sequencing_file_ref,
)
from opencloning_db.config import get_config
from opencloning_db.db import create_sequencing_file
from opencloning_db.models import (
    BaseSequence,
    InputEntity,
    SequenceSample,
    SequenceType,
    SequencingFile,
    Tag,
    User,
    WorkspaceRole,
    require_real_sequence,
)
from opencloning_db.workspace_deps import (
    WorkspaceContext,
    get_editor_workspace_ctx,
    get_sequence_in_workspace_for_user,
    get_sequence_sample_in_workspace_for_user,
    get_sequencing_file_in_workspace_for_user,
    get_viewer_workspace_ctx,
)

router = APIRouter(tags=['sequence_samples'])


def _uid_taken(session, workspace_id: int, uid: str) -> bool:
    return (
        session.scalar(
            select(SequenceSample.id)
            .where(SequenceSample.uid_workspace_id == workspace_id, func.lower(SequenceSample.uid) == uid.lower())
            .limit(1)
        )
        is not None
    )


@router.get('/sequence_samples', response_model=Page[SequenceSampleWithSequence])
def get_sequence_samples(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    uid: str | None = Query(
        description='Filter sequence samples by uid (case-insensitive substring match)', default=None
    ),
    location: str | None = Query(
        description='Filter sequence samples by location (case-insensitive substring match)', default=None
    ),
    sequence_id: int | None = Query(description='Only the samples of this sequence', default=None),
    name: str | None = Query(
        description='Filter by the name of the sequence (case-insensitive substring match)', default=None
    ),
    sequence_types: list[SequenceType] = Query(description='Filter by the type of the sequence', default_factory=list),
    tags: list[int] = Query(description='Filter by the tag IDs of the sequence', default_factory=list),
    created_by: str | None = Query(
        description='Filter sequence samples by creator display name (case-insensitive substring match)',
        default=None,
    ),
):
    """List sequence samples in a workspace (lab samples with user-defined UIDs), most recent first,
    with their sequence and sequencing files (without content)."""
    _, session, workspace_id = ctx.destructure()

    query = (
        select(SequenceSample)
        .join(BaseSequence, SequenceSample.sequence_id == BaseSequence.id)
        .options(
            selectinload(SequenceSample.sequence).options(
                selectinload(InputEntity.tags),
                selectinload(BaseSequence.instances),
                selectinload(InputEntity.created_by),
            ),
            selectinload(SequenceSample.sequencing_files),
            selectinload(SequenceSample.created_by),
        )
        .where(SequenceSample.uid_workspace_id == workspace_id)
    )
    if uid is not None:
        query = query.where(SequenceSample.uid.ilike(f"%{uid}%"))
    if location is not None:
        query = query.where(SequenceSample.location.ilike(f"%{location}%"))
    if sequence_id is not None:
        query = query.where(SequenceSample.sequence_id == sequence_id)
    if name is not None:
        query = query.where(BaseSequence.name.ilike(f"%{name}%"))
    if sequence_types:
        query = query.where(BaseSequence.sequence_type.in_(sequence_types))
    if tags:
        query = query.where(BaseSequence.tags.any(and_(Tag.id.in_(tags), Tag.workspace_id == workspace_id)))
    if created_by is not None:
        query = query.join(User, User.id == SequenceSample.created_by_id).where(
            User.display_name.ilike(f"%{created_by}%")
        )
    query = query.order_by(SequenceSample.id.desc())
    return paginate(
        session, query, transformer=lambda items: [sequence_sample_with_sequence(sample) for sample in items]
    )


@router.post('/sequence_samples', response_model=SequenceSampleCreated)
def post_sequence_sample(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    body: SequenceSampleCreate,
):
    """Create a sequence sample. UID is user-defined, assigned before sequencing."""
    current_user, session, workspace_id = ctx.destructure()

    # Validate that the sequence exists and the user has access to it
    sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, body.sequence_id, WorkspaceRole.editor
    )

    if _uid_taken(session, workspace_id, body.uid):
        raise HTTPException(status_code=409, detail=f"UID '{body.uid}' already exists")
    ps = SequenceSample.from_create(uid=body.uid, sequence=sequence, location=body.location or None, ctx=ctx)
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
    return sequence_sample_read(ps)


@router.patch('/sequence_samples/{uid}', response_model=SequenceSampleRead)
def patch_sequence_sample(
    uid: str,
    body: SequenceSampleUpdate,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Rename a sequence sample and/or change its location."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.editor)
    if body.uid is not None and body.uid != ps.uid:
        if body.uid.lower() != ps.uid.lower() and _uid_taken(session, workspace_id, body.uid):
            raise HTTPException(status_code=409, detail=f"UID '{body.uid}' already exists")
        ps.uid = body.uid
    if body.location is not None:
        ps.location = body.location or None
    session.commit()
    session.refresh(ps)
    return sequence_sample_read(ps)


@router.post('/sequence_samples/{uid}/reassign', response_model=SequenceSampleRead)
def reassign_sequence_sample(
    uid: str,
    body: SequenceSampleReassign,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Point a sample to another sequence (e.g. the sequence found by sequencing it), together with its
    sequencing files."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.editor)
    sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, body.sequence_id, WorkspaceRole.editor
    )
    if sequence.id == ps.sequence_id:
        raise HTTPException(status_code=400, detail=f"Sample '{ps.uid}' already points to this sequence")
    if ps.sequencing_files:
        require_real_sequence(
            sequence, detail='Samples with sequencing files cannot point to a template sequence.', status_code=400
        )
    ps.sequence = sequence
    session.commit()
    session.refresh(ps)
    return sequence_sample_read(ps)


@router.delete('/sequence_samples/{uid}', response_model=DeletedResponse)
def delete_sequence_sample(
    uid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Delete a sequence sample, with its sequencing files and history."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.editor)
    sequence_id = ps.sequence_id
    session.delete(ps)
    session.commit()
    return DeletedResponse(deleted=ps.id, data={'sequence_id': sequence_id, 'uid': uid})


# --- Sequencing files ---


@router.get('/sequence_samples/{uid}/sequencing_files', response_model=List[SequencingFileRef])
def get_sequence_sample_sequencing_files(
    uid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """List the sequencing files of a sample."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.viewer)
    return [sequencing_file_ref(f) for f in ps.sequencing_files]


@router.post('/sequence_samples/{uid}/sequencing_files', response_model=List[SequencingFileRef])
def post_sequence_sample_sequencing_files(
    uid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    files: List[UploadFile] = File(...),
):
    """Upload one or more sequencing files of a sample. Nothing is created if any file is too large or
    the sample already has a file with the same name."""
    current_user, session, workspace_id = ctx.destructure()
    ps = get_sequence_sample_in_workspace_for_user(session, current_user, workspace_id, uid, WorkspaceRole.editor)
    require_real_sequence(ps.sequence, detail='Samples of template sequences cannot have sequencing files.')
    max_size_mb = get_config().max_sequencing_file_size_mb
    # Read all files first, so that nothing is created if any file is too large
    contents = [read_upload_with_limit(upload, max_size_mb) for upload in files]
    names = [upload.filename or 'unnamed' for upload in files]
    taken = {f.original_name for f in ps.sequencing_files}
    conflicts = sorted({name for i, name in enumerate(names) if name in taken or name in names[:i]})
    if conflicts:
        raise HTTPException(
            status_code=409, detail=f"Sample '{ps.uid}' already has sequencing files called {', '.join(conflicts)}"
        )
    created = [create_sequencing_file(ps, content, name) for name, content in zip(names, contents)]
    session.add_all(created)
    session.commit()
    return [sequencing_file_ref(f) for f in created]


@router.delete('/sequencing_files/{file_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_sequencing_file(
    file_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    db_file = get_sequencing_file_in_workspace_for_user(
        session, current_user, workspace_id, file_id, WorkspaceRole.editor
    )
    session.delete(db_file)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/sequencing_files/{file_id}/download')
def download_sequencing_file(
    file_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Download a sequencing file by ID."""
    current_user, session, workspace_id = ctx.destructure()
    db_file = get_sequencing_file_in_workspace_for_user(
        session, current_user, workspace_id, file_id, WorkspaceRole.viewer
    )
    # Selecting the column loads it, although it is deferred in the ORM
    content = session.scalar(select(SequencingFile.file_content).where(SequencingFile.id == file_id))
    return Response(
        content=content,
        media_type='application/octet-stream',
        headers={'Content-Disposition': f"attachment; filename*=UTF-8''{quote(db_file.original_name, safe='')}"},
    )
