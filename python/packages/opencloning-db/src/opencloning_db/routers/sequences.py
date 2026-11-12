"""Sequence, sequencing files, and cloning strategy endpoints."""

import csv
import io
import os
from pathlib import PurePosixPath
import warnings
import zipfile
from typing import Annotated, List
from urllib.parse import quote
from opencloning.dna_functions import read_dsrecord_from_json
from opencloning.app_settings import settings
from opencloning.endpoints.endpoint_utils import read_upload_with_limit
from opencloning.pydantic_models import BaseCloningStrategy
from opencloning_db.config import get_config
import opencloning_linkml.datamodel.models as opencloning_models
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from fastapi import status

from opencloning_db.models import BaseSequence
from pydna.utils import location_boundaries
from sqlalchemy.orm import Session
from opencloning_db.bulk_validation import bulk_commit_or_conflict, bulk_conflict_response, frequency_duplicates
from opencloning_db.cloning_strategy_bulk import (
    parse_cloning_strategy_file,
    validate_and_sync_cloning_strategy_dict,
)
import pydna.opencloning_models as pydna_opencloning_models
from sqlalchemy.orm import selectinload, undefer
from sqlalchemy import and_, exists, func, select, Select
from sqlalchemy.exc import IntegrityError

from pydantic import create_model
from pydna.parsers import parse as pydna_parse, parse_snapgene as pydna_parse_snapgene

from opencloning_db.apimodels import (
    CloningStrategyIdMapping,
    CloningStrategyResponse,
    CloningStrategySyncResult,
    CloningStrategySyncResultFilled,
    DeletedResponse,
    LineRef,
    SequenceRef,
    SequenceValidationRow,
    SequenceSearchResult,
    SequenceUpdate,
    SequenceWithTextFile,
    SequencingFileRef,
    PrimerRef,
    line_ref,
    primer_ref,
    sequence_ref,
)
from opencloning_db.db import cloning_strategy_to_db, create_sequencing_file, get_cloning_strategy_from_db
from opencloning_db.models import (
    InputEntity,
    Primer,
    Sequence,
    SequenceInLine,
    SequencingFile,
    Source,
    SequenceType,
    Tag,
    SequenceSample,
    SourceInput,
    TemplateSequence,
    User,
    WorkspaceRole,
    assert_template_sequence_name_available,
    require_real_sequence,
)
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from opencloning_db.workspace_deps import (
    WorkspaceContext,
    get_editor_workspace_ctx,
    get_sequence_in_workspace_for_user,
    get_tag_in_workspace_for_user,
    get_viewer_workspace_ctx,
)

from pydna.dseq import Dseq
from opencloning_db.utils import unique_and_sorted
from pydna.snapgene_history_parser import parse_snapgene_history, SnapgeneHistoryParserWarning

router = APIRouter(tags=['sequences'])


@router.get('/sequences', response_model=Page[SequenceRef])
def get_sequences(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    tags: list[int] = Query(description='Filter sequences by tag IDs', default_factory=list),
    instantiated: bool | None = Query(description='Filter sequences by whether they are instantiated', default=None),
    sequence_types: list[SequenceType] = Query(description='Filter sequences by type', default_factory=list),
    name: str | None = Query(description='Filter sequences by name (case-insensitive substring match)', default=None),
    uid: str | None = Query(
        description='Filter sequences by sample uid (case-insensitive substring match)', default=None
    ),
    has_uid: bool = Query(description='Filter sequences by whether they have a uid', default=False),
    created_by: str | None = Query(
        description='Filter sequences by creator display name (case-insensitive substring match)',
        default=None,
    ),
):
    _, session, workspace_id = ctx.destructure()

    query = (
        select(BaseSequence)
        .options(
            selectinload(InputEntity.tags),
            selectinload(BaseSequence.instances),
            selectinload(InputEntity.created_by),
        )
        .where(BaseSequence.workspace_id == workspace_id)
    )
    if tags:
        query = query.where(InputEntity.tags.any(and_(Tag.id.in_(tags), Tag.workspace_id == workspace_id)))
    if instantiated is not None:
        query = query.where(BaseSequence.instances.any() if instantiated else ~BaseSequence.instances.any())
    if sequence_types is not None and len(sequence_types) > 0:
        query = query.where(BaseSequence.sequence_type.in_(sequence_types))
    if name is not None:
        query = query.where(BaseSequence.name.ilike(f"%{name}%"))
    if uid is not None:
        # This creates a boolean filter by including 1 if the sequence has a sample with the given uid
        subq = (
            select(1)
            .select_from(SequenceSample)
            .where(
                SequenceSample.sequence_id == BaseSequence.id,
                SequenceSample.uid.ilike(f"%{uid}%"),
                SequenceSample.uid_workspace_id == workspace_id,
            )
        )
        query = query.where(exists(subq))
    if has_uid is True:
        subq = (
            select(1)
            .select_from(SequenceSample)
            .where(
                SequenceSample.sequence_id == BaseSequence.id,
                SequenceSample.uid.isnot(None),
                SequenceSample.uid_workspace_id == workspace_id,
            )
        )
        query = query.where(exists(subq))
    if created_by is not None:
        query = query.join(User, User.id == BaseSequence.created_by_id).where(
            User.display_name.ilike(f"%{created_by}%")
        )
    query = query.order_by(BaseSequence.id.desc())
    return paginate(session, query)


# Shared by bulk submission and bulk retrieval, so that whatever can be submitted at once can be fetched at once
MAX_BULK_SEQUENCES = 500


# Declared before /sequences/{sequence_id}, otherwise that route would match this path
@router.get('/sequences/text_file_sequences', response_model=list[SequenceWithTextFile])
def get_text_file_sequences(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    ids: list[int] = Query(description='Sequence IDs to retrieve', default_factory=list),
    tags: list[int] = Query(description='Retrieve all sequences with any of these tag IDs', default_factory=list),
    sequence_types: list[SequenceType] = Query(
        description='Only retrieve sequences of these types (only with tags)', default_factory=list
    ),
):
    """Retrieve several sequences with their file content, either by ID or by tag, sorted by ID.
    When retrieving by tag, the sequences can be filtered by type.
    Template sequences are not included, since they have no file content."""
    if bool(ids) == bool(tags):
        raise HTTPException(status_code=422, detail='Provide either ids or tags, but not both.')
    if ids and sequence_types:
        raise HTTPException(status_code=422, detail='sequence_types can only be used with tags.')
    _, session, workspace_id = ctx.destructure()

    query = select(Sequence).where(Sequence.workspace_id == workspace_id)
    if ids:
        query = query.where(Sequence.id.in_(ids))
    else:
        query = query.where(Sequence.tags.any(and_(Tag.id.in_(tags), Tag.workspace_id == workspace_id)))
        if sequence_types:
            query = query.where(Sequence.sequence_type.in_(sequence_types))

    count = session.scalar(select(func.count()).select_from(query.subquery()))
    if count > MAX_BULK_SEQUENCES:
        raise HTTPException(
            status_code=400,
            detail=f'Too many sequences ({count}), the maximum is {MAX_BULK_SEQUENCES}.',
        )

    query = query.options(
        selectinload(Sequence.tags),
        selectinload(Sequence.instances),
        selectinload(Sequence.created_by),
        undefer(Sequence.file_content),
    ).order_by(Sequence.id)
    db_sequences = session.scalars(query).all()

    if ids:
        missing = sorted(set(ids) - {s.id for s in db_sequences})
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f'Sequences not found (or template sequences): {", ".join(map(str, missing))}',
            )

    return [
        SequenceWithTextFile(sequence_ref=sequence_ref(s), sequence=s.to_pydantic_sequence()) for s in db_sequences
    ]


@router.get('/sequences/{sequence_id}', response_model=SequenceRef)
def get_sequence(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.viewer
    )
    return sequence_ref(db_sequence)


@router.patch('/sequences/{sequence_id}', response_model=SequenceRef)
def patch_sequence(
    sequence_id: int,
    body: SequenceUpdate,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Update the sequence name and/or sequence_type."""
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.editor
    )

    if body.name is not None:
        if isinstance(db_sequence, TemplateSequence):
            assert_template_sequence_name_available(
                session,
                workspace_id=workspace_id,
                name=body.name,
                exclude_id=db_sequence.id,
            )
        db_sequence.name = body.name

    if body.sequence_type is not None:
        if any(isinstance(i, SequenceInLine) for i in db_sequence.instances):
            raise HTTPException(status_code=400, detail='Cannot change sequence_type: sequence is present in a line.')
        if isinstance(db_sequence, Sequence):
            # Enforce: circular sequences can only be typed as plasmids.
            seq_record = read_dsrecord_from_json(db_sequence.to_pydantic_sequence())
            if seq_record.circular and body.sequence_type != SequenceType.plasmid:
                raise HTTPException(
                    status_code=400,
                    detail="Circular sequences can only have sequence_type 'plasmid'",
                )
        db_sequence.sequence_type = body.sequence_type

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        if body.name is not None and isinstance(db_sequence, TemplateSequence):
            raise HTTPException(
                status_code=409,
                detail=f"Template sequence '{body.name}' already exists in this workspace",
            ) from None
        raise  # pragma: no cover
    session.refresh(db_sequence)
    return sequence_ref(db_sequence)


@router.delete('/sequences/{sequence_id}', response_model=DeletedResponse)
def delete_sequence(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Delete a sequence with no children and not present in any strain.

    Linked sequence samples and sequencing files are removed via ORM cascade
    """

    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.editor
    )

    if isinstance(db_sequence, Sequence):
        if db_sequence.source_inputs:
            raise HTTPException(status_code=409, detail='Cannot delete sequence: it has child sequences.')
        if any(isinstance(instance, SequenceInLine) for instance in db_sequence.instances):
            raise HTTPException(status_code=409, detail='Cannot delete sequence: it is present in a line.')

    session.delete(db_sequence)
    session.commit()

    return DeletedResponse(deleted=sequence_id)


def _replace_sequence_file(session: Session, db_sequence: Sequence, file_content: str):
    db_sequence.file_content = file_content
    session.commit()
    session.refresh(db_sequence)


def _feature_spans_origin(feature) -> bool:
    x, y = location_boundaries(feature.location)
    return x >= y


@router.patch('/sequences/{sequence_id}/change_circularity', response_model=SequenceRef)
def change_sequence_circularity(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Toggle sequence circularity; only allowed when the sequence has no parents nor children."""
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.editor
    )
    db_sequence = require_real_sequence(db_sequence, detail='Only real sequences can have their circularity changed.')

    if db_sequence.source_inputs:
        raise HTTPException(status_code=400, detail='Cannot change circularity: sequence has child sequences.')
    parent_source = db_sequence.output_of_source
    if parent_source is not None and parent_source.input:
        raise HTTPException(status_code=400, detail='Cannot change circularity: sequence has parent sequences.')

    dseqr = read_dsrecord_from_json(db_sequence.to_pydantic_sequence())
    if dseqr.seq.ovhg != 0 or dseqr.seq.watson_ovhg != 0:
        raise HTTPException(status_code=400, detail='Cannot change circularity: sequence has overhangs.')

    if dseqr.circular and any(_feature_spans_origin(feature) for feature in dseqr.features):
        raise HTTPException(
            status_code=400, detail='Cannot change circularity: sequence has features spanning the origin.'
        )

    toggled = dseqr[:] if dseqr.circular else dseqr.looped()
    db_sequence.seguid = toggled.seq.seguid()
    db_sequence.sequence_type = SequenceType.plasmid if toggled.circular else SequenceType.linear_dna

    _replace_sequence_file(session, db_sequence, toggled.format('genbank'))

    return sequence_ref(db_sequence)


@router.get('/sequences/{sequence_id}/lines', response_model=list[LineRef])
def get_sequence_lines(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.viewer
    )
    lines = [instance.line for instance in db_sequence.instances if isinstance(instance, SequenceInLine)]
    return [line_ref(line) for line in lines]


@router.patch('/sequences/{sequence_id}/change_annotation', response_model=SequenceRef)
def change_sequence_annotation(
    sequence_id: int,
    body: opencloning_models.TextFileSequence,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.editor
    )
    db_sequence = require_real_sequence(db_sequence, detail='Only real sequences can have their annotation changed.')

    submitted_dseqr = read_dsrecord_from_json(body)
    existing_dseqr = read_dsrecord_from_json(db_sequence.to_pydantic_sequence())
    if submitted_dseqr.seq != existing_dseqr.seq:
        raise HTTPException(status_code=400, detail='Submitted sequence does not match the existing sequence.')

    db_sequence.seguid = submitted_dseqr.seq.seguid()
    _replace_sequence_file(session, db_sequence, body.file_content)
    return sequence_ref(db_sequence)


@router.get('/sequences/by-uid/{uid}', response_model=SequenceRef)
def get_sequence_by_uid(
    uid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """
    Look up the unique sequence associated with a given sample UID.
    Returns 404 if no sample/sequence exists for that UID.
    """
    _, session, workspace_id = ctx.destructure()
    stmt = (
        select(Sequence)
        .where(Sequence.workspace_id == workspace_id)
        .join(SequenceSample, SequenceSample.sequence_id == Sequence.id)
        .where(
            func.lower(SequenceSample.uid) == uid.lower(),
            SequenceSample.uid_workspace_id == workspace_id,
        )
        .options(
            selectinload(InputEntity.tags),
            selectinload(Sequence.instances),
        )
    )
    db_sequence = session.scalar(stmt)
    if db_sequence is None:
        raise HTTPException(status_code=404, detail='Sequence not found for UID')
    return sequence_ref(db_sequence)


def _seguid_query(seguid: str, workspace_id: int) -> Select[tuple[Sequence]]:
    return (
        select(Sequence)
        .where(
            Sequence.seguid == seguid,
            Sequence.workspace_id == workspace_id,
        )
        .options(
            selectinload(InputEntity.tags),
            selectinload(Sequence.instances),
            undefer(Sequence.file_content),
        )
    )


def _has_any_sequence_warning(rows: list[SequenceValidationRow], strict: bool) -> bool:
    if not strict:
        return any(row.reading_error for row in rows)
    return any(
        row.reading_error
        or row.sequence_exists
        or row.sequence_circularised_exists
        or row.name_exists
        or row.duplicated_seguid
        or row.duplicated_name
        for row in rows
    )


def _load_uploaded_files(files: List[UploadFile]) -> list[tuple[str, str | bytes]]:
    # Checked before reading, so that oversized requests are rejected without loading the files in memory
    if len(files) > MAX_BULK_SEQUENCES:
        raise HTTPException(
            status_code=400, detail=f'A maximum of {MAX_BULK_SEQUENCES} sequence files can be submitted'
        )
    loaded_files: list[tuple[str, str | bytes]] = []
    for file in files:
        file_name = file.filename or 'unnamed'
        file_bytes = read_upload_with_limit(file, settings.MAX_SEQUENCE_FILE_SIZE_MB)
        if file_name.lower().endswith('.dna'):
            loaded_files.append((file_name, file_bytes))
        else:
            loaded_files.append((file_name, file_bytes.decode('utf-8', errors='replace')))
    return loaded_files


def _sequence_validation_rows_with_flags(
    submitted_files: list[tuple[str, str]],
    session,
    workspace_id: int,
) -> tuple[list[SequenceValidationRow], list[opencloning_models.TextFileSequence]]:
    rows: list[SequenceValidationRow] = []
    parsed_names: list[str] = []
    parsed_seguids: list[str] = []
    linear_circularized_seguids: list[str] = []
    records = list()

    for file_name, file_content in submitted_files:
        try:
            if isinstance(file_content, bytes):
                parsed_records = pydna_parse_snapgene(file_content)
                for record in parsed_records:
                    record.name = file_name.removesuffix('.dna')
            else:
                parsed_records = pydna_parse(file_content)
            if len(parsed_records) != 1:
                raise ValueError('Expected exactly one sequence in file')
            dseqr = parsed_records[0]
            dseqr.source = pydna_opencloning_models.UploadedFileSource(
                file_name=file_name,
                sequence_file_format=str(dseqr.annotations['pydna_parse_sequence_file_format']),
                index_in_file=0,
            )
            records.append(dseqr)
            seguid = dseqr.seq.seguid()
            is_circular = dseqr.circular
            row = SequenceValidationRow(
                file_name=file_name,
                reading_error=False,
                name=dseqr.name,
                length=len(dseqr),
                circular=is_circular,
                seguid=seguid,
                circularised_seguid=None if is_circular else dseqr.looped().seq.seguid(),
            )
            rows.append(row)
            parsed_names.append(row.name or '')
            parsed_seguids.append(seguid)
            if row.circularised_seguid is not None:
                linear_circularized_seguids.append(row.circularised_seguid)
        except Exception:
            rows.append(SequenceValidationRow(file_name=file_name, reading_error=True))

    duplicate_names = frequency_duplicates(parsed_names)
    duplicate_seguids = frequency_duplicates(parsed_seguids)

    db_name_matches = set(
        session.scalars(
            select(Sequence.name).where(
                Sequence.workspace_id == workspace_id,
                Sequence.name.in_(set(parsed_names)),
            )
        ).all()
    )
    query_seguids = set(parsed_seguids) | set(linear_circularized_seguids)
    db_seguid_matches = set()
    for seguid in query_seguids:
        if session.scalar(_seguid_query(seguid, workspace_id)) is not None:
            db_seguid_matches.add(seguid)

    for row in rows:
        if row.reading_error:
            continue
        row.name_exists = row.name is not None and row.name in db_name_matches
        row.sequence_exists = row.seguid in db_seguid_matches
        row.sequence_circularised_exists = False if row.circular else row.circularised_seguid in db_seguid_matches
        row.duplicated_name = row.name is not None and row.name in duplicate_names
        row.duplicated_seguid = row.seguid in duplicate_seguids

    return rows, records


@router.post('/sequences/validate-upload', response_model=list[SequenceValidationRow])
def validate_upload_sequences(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    files: List[UploadFile] = File(...),
):
    _, session, workspace_id = ctx.destructure()
    loaded_files = _load_uploaded_files(files)
    rows, _records = _sequence_validation_rows_with_flags(loaded_files, session, workspace_id)
    return rows


@router.post('/sequences/bulk', response_model=list[SequenceRef])
def post_sequences_bulk(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    files: List[UploadFile] = File(...),
    strict: bool = Query(description='Fail on any validation warning', default=True),
    tags: list[int] = Query(description='Tag IDs to apply to all created sequences', default_factory=list),
):
    current_user, session, workspace_id = ctx.destructure()
    workspace_tags = [
        get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.editor)
        for tag_id in sorted(set(tags))
    ]
    loaded_files = _load_uploaded_files(files)
    validation_rows, records = _sequence_validation_rows_with_flags(loaded_files, session, workspace_id)
    if _has_any_sequence_warning(validation_rows, strict):
        return bulk_conflict_response(validation_rows)

    db_sequences = list()
    for record in records:
        db_sequences.extend(
            cloning_strategy_to_db(
                pydna_opencloning_models.CloningStrategy.from_dseqrecords([record]),
                session,
                ctx=ctx,
            )[0]
        )

    for db_sequence in db_sequences:
        db_sequence.tags.extend(workspace_tags)
    conflict = bulk_commit_or_conflict(
        session,
        db_sequences,
        lambda: _sequence_validation_rows_with_flags(loaded_files, session, workspace_id)[0],
    )
    if conflict is not None:
        return conflict

    for db_sequence in db_sequences:
        session.refresh(db_sequence)
    return [sequence_ref(s) for s in db_sequences]


def _parse_snapgene_history_file(content: bytes, file_name: str) -> tuple[dict | None, list[str], list[str]]:
    try:
        with warnings.catch_warnings(record=True, category=SnapgeneHistoryParserWarning) as warnings_captured:
            seqr = parse_snapgene_history(content, file_name)
        warning_messages = [str(w.message) for w in warnings_captured]
        cs_out = pydna_opencloning_models.CloningStrategy.from_dseqrecords([seqr])
        return cs_out.model_dump(), [], warning_messages
    except Exception as e:
        return None, ['Error parsing snapgene history file: ' + str(e)], []


@router.post('/sequences/cloning_strategy/bulk/validate', response_model=list[CloningStrategySyncResult])
def validate_cloning_strategy_bulk(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    files: List[UploadFile] = File(...),
):
    _, session, _workspace_id = ctx.destructure()
    output: list[CloningStrategySyncResult] = list()
    warning_list = list()
    for file in files:
        file_content = read_upload_with_limit(file, settings.MAX_SEQUENCE_FILE_SIZE_MB)
        if file.filename.endswith('.dna'):
            data, json_errors, warning_list = _parse_snapgene_history_file(file_content, file.filename)
        else:
            data, json_errors = parse_cloning_strategy_file(file_content)
        if data is None:
            output.append(CloningStrategySyncResult(file_name=file.filename, parsing_errors=json_errors))
            continue
        out = validate_and_sync_cloning_strategy_dict(data, session, ctx, file_name=file.filename)
        out.parsing_warnings.extend(warning_list)
        output.append(out)
    return output


def _cloning_strategy_response_from_db(
    sequences: list[Sequence],
    id_mappings: dict[int, int],
) -> CloningStrategyResponse:
    root_sequence = next(s for s in sequences if len(s.source_inputs) == 0)
    formatted_mappings = [
        CloningStrategyIdMapping(localId=k, databaseId=v) for k, v in id_mappings.items() if v is not None
    ]
    return CloningStrategyResponse(id=root_sequence.id, mappings=formatted_mappings)


@router.post('/sequences/cloning_strategy/bulk', response_model=list[SequenceRef])
def post_cloning_strategy_bulk(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    sync_results: list[CloningStrategySyncResultFilled],
    tags: list[int] = Query(
        description='Tag IDs to apply to all newly created sequences and primers', default_factory=list
    ),
):
    current_user, session, workspace_id = ctx.destructure()
    workspace_tags = [
        get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.editor)
        for tag_id in sorted(set(tags))
    ]
    payloads = [cs.cloning_strategy.model_dump(mode='json') for cs in sync_results]
    file_names = [cs.file_name for cs in sync_results]

    # We use a generator to ensure that the same sequence submitted twice
    # is added to the db once, and from then on synced.
    validation_rows_generator = (
        validate_and_sync_cloning_strategy_dict(data, session, ctx, file_name=file_name)
        for data, file_name in zip(payloads, file_names)
    )

    all_sequences: list[Sequence] = []
    error_found = False
    rows = list()
    for row in validation_rows_generator:
        rows.append(row)
        if row.parsing_errors:
            error_found = True
            continue
        if row.already_synced or error_found:
            continue
        assert row.cloning_strategy is not None
        sequences, _id_mappings = cloning_strategy_to_db(
            row.cloning_strategy,
            session,
            ctx=ctx,
            tags=workspace_tags or None,
        )
        all_sequences.extend(sequences)

    if error_found:
        return bulk_conflict_response(rows)

    conflict = bulk_commit_or_conflict(
        session,
        all_sequences,
        lambda: [
            validate_and_sync_cloning_strategy_dict(data, session, ctx, file_name=file_name)
            for data, file_name in zip(payloads, file_names)
        ],
    )
    if conflict is not None:
        return conflict

    for db_sequence in all_sequences:
        session.refresh(db_sequence)

    return [sequence_ref(s) for s in all_sequences]


@router.get('/sequences/by-seguid/{seguid}', response_model=list[SequenceRef])
def get_sequences_by_seguid(
    seguid: str,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """
    Look up all sequences with the given SEGUID.
    Returns an empty list if none are found.
    """
    _, session, workspace_id = ctx.destructure()
    stmt = _seguid_query(seguid, workspace_id)
    return [sequence_ref(seq) for seq in session.scalars(stmt).all()]


@router.get('/sequences/{sequence_id}/text_file_sequence', response_model=opencloning_models.TextFileSequence)
def get_text_file_sequence(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.viewer
    )
    if isinstance(db_sequence, Sequence):
        session.refresh(db_sequence, attribute_names=['file_content'])
    return db_sequence.to_pydantic_sequence()


@router.get('/sequences/{sequence_id}/cloning_strategy', response_model=opencloning_models.CloningStrategy)
def get_cloning_strategy(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    recursive: bool = Query(default=False, description='Whether to include all ancestors, or just immediate parents.'),
):
    current_user, session, workspace_id = ctx.destructure()

    return get_cloning_strategy_from_db(session, ctx, sequence_id, recursive=recursive)


@router.get('/sequences/{sequence_id}/children', response_model=list[SequenceRef])
def get_sequence_children(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.viewer
    )
    children = [sequence_ref(s.source.output_sequence) for s in db_sequence.source_inputs]
    return unique_and_sorted(children)


@router.get(
    '/sequences/{sequence_id}/primers',
    response_model=create_model(
        'SequencePrimers',
        templates=list[PrimerRef],
        products=list[PrimerRef],
    ),
)
def get_sequence_primers(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get primers linked to a sequence (as template input or product output)."""
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.viewer
    )
    workspace_id = db_sequence.workspace_id

    # Sources where this sequence was an input (i.e. this sequence acted as a "template")
    template_source_ids = select(SourceInput.source_id).where(SourceInput.input_entity_id == sequence_id)
    template_primers_stmt = (
        select(Primer)
        .options(selectinload(InputEntity.tags))
        .join(SourceInput, SourceInput.input_entity_id == Primer.id)
        .where(
            SourceInput.source_id.in_(template_source_ids),
            Primer.workspace_id == workspace_id,
        )
        .distinct()
    )

    # Sources where this sequence was the output (i.e. this sequence acted as a "product")
    product_source_ids = select(Source.id).where(Source.id == sequence_id)
    product_primers_stmt = (
        select(Primer)
        .options(selectinload(InputEntity.tags))
        .join(SourceInput, SourceInput.input_entity_id == Primer.id)
        .where(
            SourceInput.source_id.in_(product_source_ids),
            Primer.workspace_id == workspace_id,
        )
        .distinct()
    )

    templates = session.execute(template_primers_stmt).scalars().all()
    products = session.execute(product_primers_stmt).scalars().all()

    return {
        'templates': [primer_ref(p) for p in sorted(templates, key=lambda p: p.id)],
        'products': [primer_ref(p) for p in sorted(products, key=lambda p: p.id)],
    }


@router.get('/sequences/{sequence_id}/sequencing_files', response_model=List[SequencingFileRef])
def get_sequence_sequencing_files(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """List all sequencing files linked to a sequence."""
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.viewer
    )
    db_sequence = require_real_sequence(db_sequence, detail='sequencing_files endpoint only supports real sequences.')
    return [SequencingFileRef(id=f.id, original_name=f.original_name) for f in db_sequence.sequencing_files]


@router.post('/sequences/{sequence_id}/sequencing_files', response_model=List[SequencingFileRef])
def post_sequence_sequencing_files(
    sequence_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    files: List[UploadFile] = File(...),
):
    """Upload one or more sequencing files and link them to a sequence."""
    current_user, session, workspace_id = ctx.destructure()
    db_sequence = get_sequence_in_workspace_for_user(
        session, current_user, workspace_id, sequence_id, WorkspaceRole.editor
    )
    db_sequence = require_real_sequence(db_sequence, detail='sequencing_files endpoint only supports real sequences.')
    max_size_mb = get_config().max_sequencing_file_size_mb
    # Read all files first, so that nothing is created if any file is too large
    contents = [read_upload_with_limit(upload, max_size_mb) for upload in files]
    created = []
    for upload, content in zip(files, contents):
        sf = create_sequencing_file(
            sequence=db_sequence,
            file_content=content,
            original_name=upload.filename or 'unnamed',
        )
        session.add(sf)
        session.flush()
        created.append(SequencingFileRef(id=sf.id, original_name=sf.original_name))

    session.commit()
    return created


def _read_single_fastq(upload: UploadFile, max_size_mb: int) -> tuple[str, bytes]:
    """Return (name, content) of the single .fastq file in an uploaded zip, raise a ValueError otherwise."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(read_upload_with_limit(upload, max_size_mb)))
    except zipfile.BadZipFile:
        raise ValueError(f'{upload.filename} is not a valid zip file')
    # Skip directories, hidden files (e.g. ._A1.fastq from macOS) and anything in __MACOSX/ or hidden folders
    real_files = [
        i
        for i in zf.infolist()
        if not i.is_dir() and not any(p.startswith('.') or p == '__MACOSX' for p in PurePosixPath(i.filename).parts)
    ]
    fastqs = [i for i in real_files if i.filename.lower().endswith('.fastq')]
    print(fastqs)
    if len(fastqs) != 1:
        raise ValueError(f'{upload.filename} contains {len(fastqs)} .fastq files instead of one')
    if fastqs[0].file_size > max_size_mb * 1024 * 1024:
        raise ValueError(f'{fastqs[0].filename} in {upload.filename} exceeds the maximum size of {max_size_mb} MB')
    return os.path.basename(fastqs[0].filename), zf.read(fastqs[0])


@router.post('/sequences/sequencing_files/bulk')
def post_sequencing_files_bulk(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    files: List[UploadFile] = File(...),
):
    """Link zipped .fastq files to sequences in bulk. Submit a table (.csv or .tsv) with the columns sequence_name
    and zip_file_name, and the zip files, each containing a single .fastq file. Zip files that are not in the table
    are ignored. If several sequences have the same name, the first one is used. Nothing is linked if there is any
    error."""
    _, session, workspace_id = ctx.destructure()
    max_size_mb = get_config().max_sequencing_file_size_mb

    tables = [f for f in files if (f.filename or '').lower().endswith(('.csv', '.tsv'))]
    zips = {f.filename: f for f in files if (f.filename or '').lower().endswith('.zip')}
    if len(tables) != 1 or len(tables) + len(zips) != len(files):
        raise HTTPException(400, 'Submit a single .csv or .tsv file and .zip files')

    delimiter = '\t' if tables[0].filename.lower().endswith('.tsv') else ','
    reader = csv.DictReader(
        io.StringIO(read_upload_with_limit(tables[0], max_size_mb).decode('utf-8-sig')), delimiter=delimiter
    )
    if not {'sequence_name', 'zip_file_name'}.issubset(reader.fieldnames or []):
        raise HTTPException(400, 'The table must have the columns sequence_name and zip_file_name')
    rows = [(r['sequence_name'].strip(), r['zip_file_name'].strip()) for r in reader if any(r.values())]
    if not rows or not all(name and zip_name for name, zip_name in rows):
        raise HTTPException(400, 'The table must have at least one row, and no empty values')

    missing_zips = sorted({zip_name for _, zip_name in rows if zip_name not in zips})
    if missing_zips:
        raise HTTPException(400, f'Zip files in the table that were not submitted: {", ".join(missing_zips)}')

    fastqs, zip_errors = {}, []
    for zip_name in sorted({z for _, z in rows}):
        try:
            fastqs[zip_name] = _read_single_fastq(zips[zip_name], max_size_mb)
        except ValueError as e:
            zip_errors.append(str(e))
    if zip_errors:
        raise HTTPException(400, '; '.join(zip_errors))

    sequences = {}
    names = {name for name, _ in rows}
    for seq in session.scalars(
        select(Sequence).where(Sequence.workspace_id == workspace_id, Sequence.name.in_(names)).order_by(Sequence.id)
    ):
        sequences.setdefault(seq.name, seq)
    missing_names = sorted(names - sequences.keys())
    if missing_names:
        raise HTTPException(400, f'Sequences not found: {", ".join(missing_names)}')

    # Tuples of sequence_id, sequencing_file names to ensure that the same file is not
    # added twice
    taken = set(
        session.execute(
            select(SequencingFile.sequence_id, SequencingFile.original_name).where(
                SequencingFile.sequence_id.in_([s.id for s in sequences.values()])
            )
        ).all()
    )
    conflicts = []
    for name, zip_name in rows:
        key = (sequences[name].id, fastqs[zip_name][0])
        if key in taken:
            conflicts.append(f'{name} already has a sequencing file called {key[1]}')
        taken.add(key)
    if conflicts:
        raise HTTPException(400, '; '.join(sorted(set(conflicts))))

    for name, zip_name in rows:
        fastq_name, content = fastqs[zip_name]
        session.add(create_sequencing_file(sequences[name], content, fastq_name))
    session.commit()
    return {'created': len(rows)}


@router.delete('/sequences/{sequence_id}/sequencing_files/{file_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_sequence_sequencing_file(
    sequence_id: int,
    file_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    current_user, session, workspace_id = ctx.destructure()
    get_sequence_in_workspace_for_user(session, current_user, workspace_id, sequence_id, WorkspaceRole.editor)
    db_file = session.scalar(
        select(SequencingFile).where(SequencingFile.id == file_id, SequencingFile.sequence_id == sequence_id)
    )
    if db_file is None:
        raise HTTPException(status_code=404, detail='Sequencing file not found')
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
    db_file = session.scalar(
        select(SequencingFile).where(SequencingFile.id == file_id).options(undefer(SequencingFile.file_content))
    )
    if db_file is None:
        raise HTTPException(status_code=404, detail='Sequencing file not found')
    get_sequence_in_workspace_for_user(session, current_user, workspace_id, db_file.sequence_id, WorkspaceRole.viewer)
    original_name = db_file.original_name

    return Response(
        content=db_file.file_content,
        media_type='application/octet-stream',
        headers={'Content-Disposition': f"attachment; filename*=UTF-8''{quote(original_name, safe='')}"},
    )


@router.post('/sequences', response_model=CloningStrategyResponse)
def post_cloning_strategy(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    cloning_strategy: BaseCloningStrategy,
):
    _, session, _workspace_id = ctx.destructure()
    # Same validation as the bulk endpoints, but a wrong database_id is rejected (not cleared and re-matched),
    # and entities without a database_id are not looked up by content, so repeated sequences can be created.
    row = validate_and_sync_cloning_strategy_dict(
        cloning_strategy.model_dump(mode='json'), session, ctx, match_by_sequence=False
    )
    if row.parsing_errors:
        raise HTTPException(status_code=400, detail=row.parsing_errors)
    if row.primer_database_id_mismatches or row.sequence_database_id_mismatches:
        raise HTTPException(
            status_code=409,
            detail={
                'primer_database_id_mismatches': [
                    m.model_dump(mode='json') for m in row.primer_database_id_mismatches
                ],
                'sequence_database_id_mismatches': [
                    m.model_dump(mode='json') for m in row.sequence_database_id_mismatches
                ],
            },
        )
    sequences, id_mappings = cloning_strategy_to_db(row.cloning_strategy, session, ctx=ctx)
    session.flush()
    response = _cloning_strategy_response_from_db(sequences, id_mappings)
    session.refresh(session.get(Sequence, response.id))
    session.commit()
    return response


def _search_rotation(seqr: Dseq, query_seqr: Dseq) -> tuple[int, bool]:
    if len(seqr) != len(query_seqr) or not seqr.circular or not query_seqr.circular:
        raise ValueError('Sequences must be the same length and circular')

    reference_seq = seqr.upper() + seqr.upper()
    query_seqr = query_seqr.upper()
    result_fwd = reference_seq.find(query_seqr)
    if result_fwd != -1:
        return result_fwd, False
    result_rev = reference_seq.find(query_seqr.reverse_complement())
    if result_rev != -1:
        return result_rev, True
    raise ValueError('Query sequence not found in reference sequence')


@router.post('/sequences/search', response_model=list[SequenceSearchResult])
def search_sequences(
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
    query: opencloning_models.TextFileSequence,
):
    query_dseq = read_dsrecord_from_json(query).seq
    seguid = query_dseq.seguid()
    current_user, session, workspace_id = ctx.destructure()
    output = []
    results = session.scalars(_seguid_query(seguid, workspace_id))
    for db_seq in results:
        db_seq: Sequence
        db_dseq = read_dsrecord_from_json(db_seq.to_pydantic_sequence()).seq
        if db_dseq.circular:
            shift, reverse_complemented = _search_rotation(db_dseq, query_dseq)
            output.append(
                SequenceSearchResult(
                    sequence_ref=sequence_ref(db_seq),
                    sequence=db_seq.to_pydantic_sequence(),
                    shift=shift,
                    reverse_complemented=reverse_complemented,
                )
            )
        else:
            output.append(
                SequenceSearchResult(
                    sequence_ref=sequence_ref(db_seq),
                    sequence=db_seq.to_pydantic_sequence(),
                    shift=0,
                    reverse_complemented=db_dseq != query_dseq,
                )
            )
    return output
