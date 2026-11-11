"""Primer endpoints."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from opencloning.pydantic_models import MAX_PRIMER_LENGTH
from opencloning_db.bulk_validation import bulk_commit_or_conflict, bulk_conflict_response, frequency_duplicates

from opencloning_db.apimodels import (
    DeletedResponse,
    IdResponse,
    PrimerBulkSubmission,
    PrimerBulkRow,
    PrimerRef,
    SequenceRef,
    primer_ref,
    sequence_ref,
    PrimerUpdate,
    PrimerCreate,
)
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from opencloning_db.models import InputEntity, Primer, Sequence, Source, SourceInput, Tag, User, WorkspaceRole
from pydantic import create_model
from opencloning_db.workspace_deps import (
    WorkspaceContext,
    get_editor_workspace_ctx,
    get_primer_in_workspace_for_user,
    get_tag_in_workspace_for_user,
    get_viewer_workspace_ctx,
)

router = APIRouter(tags=['primers'])


def _normalize_name(value: str) -> str:
    return value.strip().casefold()


def _normalize_sequence(value: str) -> str:
    return value.upper()


def _normalize_uid(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if stripped == '':
        return None
    return stripped.casefold()


def _is_invalid_sequence(value: str) -> bool:
    return len(value) <= 2 or len(value) > MAX_PRIMER_LENGTH or re.fullmatch(r'[ACGTacgt]+', value) is None


def _primer_bulk_rows_with_flags(
    primers: list[PrimerBulkSubmission],
    session,
    workspace_id: int,
) -> list[PrimerBulkRow]:
    normalized_names = [_normalize_name(primer.name) for primer in primers]
    normalized_sequences = [_normalize_sequence(primer.sequence) for primer in primers]
    normalized_uids = [_normalize_uid(primer.uid) for primer in primers]

    duplicate_names = frequency_duplicates(normalized_names)
    duplicate_sequences = frequency_duplicates(normalized_sequences)
    duplicate_uids = frequency_duplicates([uid for uid in normalized_uids if uid is not None])

    db_name_matches = set(
        session.scalars(
            select(func.lower(func.trim(Primer.name))).where(
                Primer.workspace_id == workspace_id,
                func.lower(func.trim(Primer.name)).in_(set(normalized_names)),
            )
        ).all()
    )
    db_sequence_matches = set(
        session.scalars(
            select(func.upper(Primer.sequence)).where(
                Primer.workspace_id == workspace_id,
                func.upper(Primer.sequence).in_(set(normalized_sequences)),
            )
        ).all()
    )
    uid_candidates = {uid for uid in normalized_uids if uid is not None}
    db_uid_matches = set(
        session.scalars(
            select(func.lower(func.trim(Primer.uid))).where(
                Primer.workspace_id == workspace_id,
                Primer.uid.isnot(None),
                func.lower(func.trim(Primer.uid)).in_(uid_candidates),
            )
        ).all()
    )

    rows: list[PrimerBulkRow] = []
    for primer, name_norm, sequence_norm, uid_norm in zip(
        primers, normalized_names, normalized_sequences, normalized_uids
    ):
        rows.append(
            PrimerBulkRow(
                name=primer.name,
                sequence=primer.sequence,
                uid=primer.uid,
                sequence_invalid=_is_invalid_sequence(primer.sequence),
                name_exists=name_norm in db_name_matches,
                sequence_exists=sequence_norm in db_sequence_matches,
                uid_exists=uid_norm is not None and uid_norm in db_uid_matches,
                name_duplicated=name_norm in duplicate_names,
                sequence_duplicated=sequence_norm in duplicate_sequences,
                uid_duplicated=uid_norm in duplicate_uids,
            )
        )
    return rows


def _has_any_conflict(rows: list[PrimerBulkRow], strict: bool) -> bool:
    if any(row.uid_duplicated or row.uid_exists or row.sequence_invalid for row in rows):
        return True
    if not strict:
        return False

    return any(
        row.name_exists or row.sequence_exists or row.name_duplicated or row.sequence_duplicated for row in rows
    )


@router.get('/primers', response_model=Page[PrimerRef])
def get_primers(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    tags: list[int] = Query(description='Filter primers by tag IDs', default_factory=list),
    name: str | None = Query(description='Filter primers by name (case-insensitive substring match)', default=None),
    uid: str | None = Query(
        description='Filter primers by sample uid (case-insensitive substring match)', default=None
    ),
    has_uid: bool = Query(description='Filter primers by whether they have a uid', default=False),
    created_by: str | None = Query(
        description='Filter primers by creator display name (case-insensitive substring match)',
        default=None,
    ),
):
    current_user, session, workspace_id = ctx.destructure()

    query = (
        select(Primer)
        .where(Primer.workspace_id == workspace_id)
        .options(selectinload(InputEntity.tags), selectinload(InputEntity.created_by))
    )
    if tags:
        query = query.where(InputEntity.tags.any(and_(Tag.id.in_(tags), Tag.workspace_id == workspace_id)))
    if name is not None:
        query = query.where(Primer.name.ilike(f"%{name}%"))
    if uid is not None:
        query = query.where(Primer.uid.ilike(f"%{uid}%"))
    if has_uid is True:
        query = query.where(Primer.uid.isnot(None))
    if created_by is not None:
        query = query.join(User, User.id == Primer.created_by_id).where(User.display_name.ilike(f"%{created_by}%"))
    query = query.order_by(Primer.id.desc())
    return paginate(session, query)


@router.post('/primers', response_model=IdResponse)
def post_primer(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    primer: PrimerCreate,
):
    """Submit a standalone primer (unlinked to any cloning strategy)."""
    current_user, session, workspace_id = ctx.destructure()

    if primer.uid is not None:
        existing_uid = session.scalar(
            select(Primer).where(
                func.lower(Primer.uid) == primer.uid.lower(),
                Primer.workspace_id == workspace_id,
            )
        )
        if existing_uid is not None:
            raise HTTPException(status_code=409, detail=f"Primer UID '{primer.uid}' already exists")

    db_primer = Primer.from_create(
        name=primer.name,
        sequence=primer.sequence,
        uid=primer.uid,
        ctx=ctx,
    )

    session.add(db_primer)
    session.commit()
    session.refresh(db_primer)
    return IdResponse(id=db_primer.id)


@router.post('/primers/validate-upload', response_model=list[PrimerBulkRow])
def validate_upload_primers(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    primers: list[PrimerBulkSubmission],
):
    current_user, session, workspace_id = ctx.destructure()
    return _primer_bulk_rows_with_flags(primers, session, workspace_id)


@router.post('/primers/bulk', response_model=list[PrimerRef])
def post_primers_bulk(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    primers: list[PrimerBulkSubmission],
    strict: bool = Query(description='Fail if duplicate name or sequence exists', default=True),
    tags: list[int] = Query(description='Tag IDs to apply to all created primers', default_factory=list),
):
    current_user, session, workspace_id = ctx.destructure()
    workspace_tags = [
        get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.editor)
        for tag_id in sorted(set(tags))
    ]
    validation_rows = _primer_bulk_rows_with_flags(primers, session, workspace_id)
    if _has_any_conflict(validation_rows, strict):
        return bulk_conflict_response(validation_rows)

    db_primers: list[Primer] = [
        Primer.from_create(name=primer.name, sequence=primer.sequence, uid=primer.uid, ctx=ctx) for primer in primers
    ]
    for db_primer in db_primers:
        db_primer.tags.extend(workspace_tags)
    conflict = bulk_commit_or_conflict(
        session,
        db_primers,
        lambda: _primer_bulk_rows_with_flags(primers, session, workspace_id),
    )
    if conflict is not None:
        return conflict

    for db_primer in db_primers:
        session.refresh(db_primer)

    return [primer_ref(db_primer) for db_primer in db_primers]


@router.get('/primers/{primer_id}', response_model=PrimerRef)
def get_primer(
    primer_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    primer = get_primer_in_workspace_for_user(session, current_user, workspace_id, primer_id, WorkspaceRole.viewer)

    return primer_ref(primer)


@router.get(
    '/primers/{primer_id}/sequences',
    response_model=create_model('PrimerSequences', templates=list[SequenceRef], products=list[SequenceRef]),
)
def get_primer_sequences(
    primer_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get sequences linked to a primer."""
    current_user, session, workspace_id = ctx.destructure()
    # Check that the user has access to the primer and the primer exists
    get_primer_in_workspace_for_user(session, current_user, workspace_id, primer_id, WorkspaceRole.viewer)

    # 1) All source IDs where this primer was an input
    primer_source_ids = select(SourceInput.source_id).where(SourceInput.input_entity_id == primer_id)
    # 2) All sequences that were inputs to those same sources
    template_sequences = (
        select(Sequence)
        .join(
            SourceInput,
            SourceInput.input_entity_id == Sequence.id,
        )
        .where(
            SourceInput.source_id.in_(primer_source_ids),
            Sequence.workspace_id == Primer.workspace_id,  # Safety check TODO: Maybe remove?
        )
        .distinct()
    )
    # 3) All sequences that were outputs of those same sources
    product_sequences = (
        select(Sequence)
        .join(Source)
        .where(
            Source.id.in_(primer_source_ids),
            Sequence.workspace_id == Primer.workspace_id,  # Safety check TODO: Maybe remove?
        )
    )
    templates = session.execute(template_sequences).scalars().all()
    products = session.execute(product_sequences).scalars().all()

    return {
        'templates': [sequence_ref(s) for s in templates],
        'products': [sequence_ref(s) for s in products],
    }


@router.patch('/primers/{primer_id}', response_model=PrimerRef)
def patch_primer(
    primer_id: int,
    body: PrimerUpdate,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """
    Update primer name and/or uid. Sending an empty or whitespace-only uid clears it.

    Note: the primer "type" is fixed by polymorphic identity and cannot be changed.
    """

    current_user, session, workspace_id = ctx.destructure()
    primer = get_primer_in_workspace_for_user(session, current_user, workspace_id, primer_id, WorkspaceRole.editor)
    if body.name is not None:
        primer.name = body.name
    if body.uid is not None:
        if body.uid == '':
            primer.uid = None
        else:
            existing_primer = session.scalar(
                select(Primer).where(
                    func.lower(Primer.uid) == body.uid.lower(),
                    Primer.workspace_id == workspace_id,
                )
            )
            if existing_primer is not None:
                raise HTTPException(status_code=409, detail=f"Primer UID '{body.uid}' already exists")
            primer.uid = body.uid

    session.commit()
    session.refresh(primer)

    return primer_ref(primer)


@router.delete('/primers/{primer_id}', response_model=DeletedResponse)
def delete_primer(
    primer_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Delete a primer that is not used as input to any source."""
    current_user, session, workspace_id = ctx.destructure()
    primer = get_primer_in_workspace_for_user(session, current_user, workspace_id, primer_id, WorkspaceRole.editor)

    if primer.source_inputs:
        raise HTTPException(status_code=409, detail='Cannot delete primer in use.')

    session.delete(primer)
    session.commit()
    return DeletedResponse(deleted=primer_id)
