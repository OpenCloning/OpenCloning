"""Line (engineered strain / cell line) endpoints."""

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import Select, and_, exists, func, select
from sqlalchemy.orm import selectinload

from opencloning_db.bulk_validation import bulk_commit_or_conflict, bulk_conflict_response, frequency_duplicates

from opencloning_db.apimodels import (
    DeletedResponse,
    LineBulkParentUidFlag,
    LineBulkRow,
    LineBulkSequenceNameFlag,
    LineBulkSubmission,
    LineCreate,
    LineRef,
    LineUpdate,
    line_ref,
)

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from opencloning_db.models import BaseSequence, Line, SequenceInLine, SequenceType, Tag, User, WorkspaceRole
from opencloning_db.workspace_deps import (
    WorkspaceContext,
    get_editor_workspace_ctx,
    get_line_in_workspace_for_user,
    get_sequence_in_workspace_for_user,
    get_tag_in_workspace_for_user,
    get_viewer_workspace_ctx,
)

router = APIRouter(tags=['lines'])


def _find_base_sequence_ids_by_name_and_type(
    session,
    workspace_id: int,
    name: str,
    sequence_type: SequenceType,
) -> list[int]:
    """IDs of BaseSequence rows in the workspace with this type and display name (case-insensitive equality)."""
    return list(
        session.scalars(
            select(BaseSequence.id).where(
                BaseSequence.workspace_id == workspace_id,
                BaseSequence.sequence_type == sequence_type,
                func.lower(BaseSequence.name) == name.casefold(),
            )
        ).all()
    )


def _find_line_ids_by_uid(session, workspace_id: int, uid: str) -> list[int]:
    return list(
        session.scalars(
            select(Line.id).where(
                Line.workspace_id == workspace_id,
                func.lower(Line.uid) == uid.lower(),
            )
        ).all()
    )


def _line_bulk_parent_uid_flags(
    session,
    workspace_id: int,
    parent_uids: list[str],
) -> list[LineBulkParentUidFlag]:
    flags: list[LineBulkParentUidFlag] = []
    for uid in parent_uids:
        matches = _find_line_ids_by_uid(session, workspace_id, uid)
        flags.append(
            LineBulkParentUidFlag(
                uid=uid,
                line_id=matches[0] if len(matches) == 1 else None,
            )
        )
    return flags


def _line_bulk_sequence_name_flags(
    session,
    workspace_id: int,
    names: list[str],
    sequence_type: SequenceType,
) -> list[LineBulkSequenceNameFlag]:
    duplicate_names = frequency_duplicates([n.casefold() for n in names])
    flags: list[LineBulkSequenceNameFlag] = []
    for n in names:
        matches = _find_base_sequence_ids_by_name_and_type(session, workspace_id, n, sequence_type)
        flags.append(
            LineBulkSequenceNameFlag(
                name=n,
                not_found=len(matches) == 0,
                ambiguous=len(matches) > 1,
                duplicated=n.casefold() in duplicate_names,
                sequence_id=matches[0] if len(matches) == 1 else None,
            )
        )
    return flags


def _line_bulk_rows_with_flags(
    items: list[LineBulkSubmission],
    session,
    workspace_id: int,
) -> list[LineBulkRow]:
    uids = [item.uid for item in items]
    duplicate_uids = frequency_duplicates([uid.casefold() for uid in uids])

    db_uid_matches = set(
        session.scalars(
            select(func.lower(Line.uid)).where(
                Line.workspace_id == workspace_id,
                func.lower(Line.uid).in_({uid.lower() for uid in uids}),
            )
        ).all()
    )

    rows: list[LineBulkRow] = []
    for item in items:
        parent_flags = _line_bulk_parent_uid_flags(session, workspace_id, item.parent_uids)
        rows.append(
            LineBulkRow(
                uid=item.uid,
                genotype=item.genotype,
                plasmids=item.plasmids,
                parent_uids=item.parent_uids,
                uid_exists=item.uid.lower() in db_uid_matches,
                uid_duplicated=item.uid.casefold() in duplicate_uids,
                genotype_flags=_line_bulk_sequence_name_flags(
                    session, workspace_id, item.genotype, SequenceType.allele
                ),
                plasmid_flags=_line_bulk_sequence_name_flags(
                    session, workspace_id, item.plasmids, SequenceType.plasmid
                ),
                parent_flags=parent_flags,
            )
        )
    return rows


def _has_any_line_conflict(rows: list[LineBulkRow]) -> bool:
    for row in rows:
        if row.uid_exists or row.uid_duplicated:
            return True
        for flag in row.genotype_flags + row.plasmid_flags:
            if flag.not_found or flag.ambiguous or flag.duplicated:
                return True
        for flag in row.parent_flags:
            if flag.line_id is None:
                return True
    return False


def get_line_subquery(line_id_col, sequence_type: SequenceType, name: str) -> Select:
    subq = (
        select(1)
        .select_from(SequenceInLine)
        .join(BaseSequence, SequenceInLine.sequence_id == BaseSequence.id)
        .where(
            SequenceInLine.line_id == line_id_col,
            BaseSequence.sequence_type == sequence_type,
            BaseSequence.name.ilike(f"%{name}%"),
        )
    )
    return subq


@router.get('/lines', response_model=Page[LineRef])
def get_lines(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    tags: list[int] = Query(description='Filter lines by tag IDs', default_factory=list),
    genotype: str | None = Query(
        description='Filter lines by genotype (case-insensitive substring to match allele names), spaces are AND',
        default=None,
    ),
    plasmid: str | None = Query(
        description='Filter lines by plasmid name (case-insensitive substring match), spaces are AND', default=None
    ),
    uid: str | None = Query(description='Filter lines by uid (case-insensitive substring match)', default=None),
    created_by: str | None = Query(
        description='Filter lines by creator display name (case-insensitive substring match)',
        default=None,
    ),
):
    current_user, session, workspace_id = ctx.destructure()

    query = (
        select(Line)
        .options(
            selectinload(Line.sequences_in_line)
            .selectinload(SequenceInLine.sequence)
            .options(selectinload(BaseSequence.tags)),
            selectinload(Line.parents),
            selectinload(Line.tags),
            selectinload(Line.created_by),
        )
        .where(Line.workspace_id == workspace_id)
    )
    if tags:
        query = query.where(Line.tags.any(and_(Tag.id.in_(tags), Tag.workspace_id == workspace_id)))
    if genotype is not None:
        for allele_bit in genotype.strip().split(' '):
            subq = get_line_subquery(Line.id, SequenceType.allele, allele_bit)
            query = query.where(exists(subq))
    if plasmid is not None:
        for plasmid_bit in plasmid.strip().split(' '):
            subq = get_line_subquery(Line.id, SequenceType.plasmid, plasmid_bit)
            query = query.where(exists(subq))
    if uid is not None:
        query = query.where(Line.uid.ilike(f"%{uid}%"))
    if created_by is not None:
        query = query.join(User, User.id == Line.created_by_id).where(User.display_name.ilike(f"%{created_by}%"))
    query = query.order_by(Line.id.desc())
    return paginate(session, query, transformer=lambda items: [line_ref(line) for line in items])


@router.get('/lines/{line_id}', response_model=LineRef)
def get_line(
    line_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get a single engineered strain / cell line by id."""
    current_user, session, workspace_id = ctx.destructure()
    line = get_line_in_workspace_for_user(session, current_user, workspace_id, line_id, WorkspaceRole.viewer)
    return line_ref(line)


@router.get('/lines/{line_id}/children', response_model=list[LineRef])
def get_line_children(
    line_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """List direct children of a line."""
    current_user, session, workspace_id = ctx.destructure()
    line = get_line_in_workspace_for_user(session, current_user, workspace_id, line_id, WorkspaceRole.viewer)
    return [line_ref(child) for child in line.children]


@router.post('/lines', response_model=LineRef)
def post_line(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    body: LineCreate,
):
    """Create a new engineered strain / cell line."""
    current_user, session, workspace_id = ctx.destructure()

    existing = (
        session.query(Line).filter(func.lower(Line.uid) == body.uid.lower(), Line.workspace_id == workspace_id).first()
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Line UID '{body.uid}' already exists")

    allele_seqs = [
        get_sequence_in_workspace_for_user(
            session,
            current_user,
            workspace_id,
            sid,
            WorkspaceRole.editor,
            expected_type=SequenceType.allele,
        )
        for sid in body.allele_ids
    ]
    plasmid_seqs = [
        get_sequence_in_workspace_for_user(
            session,
            current_user,
            workspace_id,
            sid,
            WorkspaceRole.editor,
            expected_type=SequenceType.plasmid,
        )
        for sid in body.plasmid_ids
    ]

    parents: list[Line] = []
    for parent_id in body.parent_ids:
        parents.append(
            get_line_in_workspace_for_user(
                session,
                current_user,
                workspace_id,
                parent_id,
                WorkspaceRole.editor,
            )
        )

    line = Line.from_create(uid=body.uid, ctx=ctx)
    line.parents = parents
    line.sequences_in_line = [SequenceInLine(sequence=seq) for seq in allele_seqs] + [
        SequenceInLine(sequence=seq) for seq in plasmid_seqs
    ]

    session.add(line)
    session.commit()
    session.refresh(line)
    return line_ref(line)


@router.post('/lines/validate-upload', response_model=list[LineBulkRow])
def validate_upload_lines(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    items: list[LineBulkSubmission] = Body(..., description='Lines to validate', min_length=1),
):
    _, session, workspace_id = ctx.destructure()
    return _line_bulk_rows_with_flags(items, session, workspace_id)


@router.post('/lines/bulk', response_model=list[LineRef])
def post_lines_bulk(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    items: list[LineBulkSubmission] = Body(..., description='Lines to create', min_length=1),
    tags: list[int] = Query(description='Tag IDs to apply to all created lines', default_factory=list),
):
    current_user, session, workspace_id = ctx.destructure()
    workspace_tags = [
        get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.editor)
        for tag_id in sorted(set(tags))
    ]
    validation_rows = _line_bulk_rows_with_flags(items, session, workspace_id)
    if _has_any_line_conflict(validation_rows):
        return bulk_conflict_response(validation_rows)

    db_lines: list[Line] = []
    with session.no_autoflush:
        for item, vrow in zip(items, validation_rows, strict=True):
            sequences_into_line = []
            for flag in vrow.genotype_flags:
                assert flag.sequence_id is not None
                sequences_into_line.append(
                    get_sequence_in_workspace_for_user(
                        session,
                        current_user,
                        workspace_id,
                        flag.sequence_id,
                        WorkspaceRole.editor,
                        expected_type=SequenceType.allele,
                    )
                )
            for flag in vrow.plasmid_flags:
                assert flag.sequence_id is not None
                sequences_into_line.append(
                    get_sequence_in_workspace_for_user(
                        session,
                        current_user,
                        workspace_id,
                        flag.sequence_id,
                        WorkspaceRole.editor,
                        expected_type=SequenceType.plasmid,
                    )
                )
            parent_ids = [flag.line_id for flag in vrow.parent_flags]
            parents = [
                get_line_in_workspace_for_user(session, current_user, workspace_id, parent_id, WorkspaceRole.editor)
                for parent_id in parent_ids
            ]
            line = Line.from_create(uid=item.uid, ctx=ctx)
            line.parents = parents
            line.sequences_in_line = [SequenceInLine(sequence=seq) for seq in sequences_into_line]
            db_lines.append(line)

    for line in db_lines:
        line.tags.extend(workspace_tags)

    conflict = bulk_commit_or_conflict(
        session,
        db_lines,
        lambda: _line_bulk_rows_with_flags(items, session, workspace_id),
    )
    if conflict is not None:
        return conflict

    for line in db_lines:
        session.refresh(line)
    return [line_ref(line) for line in db_lines]


@router.patch('/lines/{line_id}', response_model=LineRef)
def patch_line_links(
    line_id: int,
    body: LineUpdate,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Update a line uid, parents, and/or linked alleles/plasmids."""
    current_user, session, workspace_id = ctx.destructure()
    line = get_line_in_workspace_for_user(session, current_user, workspace_id, line_id, WorkspaceRole.editor)
    workspace_id = line.workspace_id

    if body.uid is not None and body.uid.lower() != line.uid.lower():
        existing = (
            session.query(Line)
            .filter(func.lower(Line.uid) == body.uid.lower(), Line.workspace_id == workspace_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail=f"Line UID '{body.uid}' already exists")
        line.uid = body.uid

    if body.allele_ids is not None:
        for sil in list(line.alleles):
            session.delete(sil)
        session.flush()
        for seq_id in body.allele_ids:
            seq = get_sequence_in_workspace_for_user(
                session,
                current_user,
                workspace_id,
                seq_id,
                WorkspaceRole.editor,
                expected_type=SequenceType.allele,
            )
            line.sequences_in_line.append(SequenceInLine(sequence=seq))

    if body.plasmid_ids is not None:
        for sil in list(line.plasmids):
            session.delete(sil)
        session.flush()
        for seq_id in body.plasmid_ids:
            seq = get_sequence_in_workspace_for_user(
                session,
                current_user,
                workspace_id,
                seq_id,
                WorkspaceRole.editor,
                expected_type=SequenceType.plasmid,
            )
            line.sequences_in_line.append(SequenceInLine(sequence=seq))

    if body.parent_ids is not None:
        if line_id in body.parent_ids:
            raise HTTPException(status_code=400, detail='A line cannot be its own parent')
        parents: list[Line] = []
        for parent_id in body.parent_ids:
            parents.append(
                get_line_in_workspace_for_user(
                    session,
                    current_user,
                    workspace_id,
                    parent_id,
                    WorkspaceRole.editor,
                )
            )
        line.parents = parents

    session.commit()
    session.refresh(line)
    return line_ref(line)


@router.delete('/lines/{line_id}', response_model=DeletedResponse)
def delete_line(
    line_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Delete a line when it has no children."""
    current_user, session, workspace_id = ctx.destructure()
    line = get_line_in_workspace_for_user(session, current_user, workspace_id, line_id, WorkspaceRole.editor)
    if line.children:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete line '{line.uid}' because it has children",
        )
    for sil in list(line.sequences_in_line):
        session.delete(sil)

    session.delete(line)
    session.commit()
    return DeletedResponse(deleted=line_id)
