"""
Database engine and conversion logic (Pydantic <-> ORM).
"""

from typing import List

import opencloning_linkml.datamodel.models as opencloning_models
from pydna.dseq import Dseq
from pydna.dseqrecord import Dseqrecord
import pydna.opencloning_models as pydna_opencloning_models
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, undefer

from opencloning_db.apimodels import (
    CloningStrategySyncResult,
    PrimerDatabaseIdMismatch,
    SequenceDatabaseIdMismatch,
)
from opencloning_db.config import Config, set_config
from opencloning_db.context import ReadContext, WriteContext
from opencloning_db.models import (
    Primer,
    Sequence,
    Source,
    SequencingFile,
    Tag,
    WorkspaceRole,
)
from opencloning_db.utils import guess_sequence_type, unique_and_sorted
from opencloning_db.models import require_real_sequence

_engine = None
_bound_database_url: str | None = None


def reset_runtime_state(config: Config | None = None) -> None:
    global _engine, _bound_database_url
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _bound_database_url = None
    set_config(config)


def get_engine(config: Config):
    """Return the DB engine; rebuild when ``config.database_url`` changes."""
    global _engine, _bound_database_url
    url = config.database_url
    if _engine is None or _bound_database_url != url:
        # hide_parameters: keep bound values (sequences, emails) out of exception messages and logs
        _engine = create_engine(url, hide_parameters=True)
        _bound_database_url = url
    return _engine


def create_sequencing_file(
    sequence: 'Sequence',
    file_content: bytes,
    original_name: str,
) -> SequencingFile:
    """Create a SequencingFile row backed directly by database storage."""
    return SequencingFile(
        sequence=sequence,
        original_name=original_name,
        file_content=file_content,
    )


def _source_order(cloning_strategy: opencloning_models.CloningStrategy) -> List[int]:
    """Return source ids in topological order (dependencies first) for single_parent compatibility."""
    source_ids = {s.id for s in cloning_strategy.sources}
    deps = {}
    for src in cloning_strategy.sources:
        input_seq_ids = {item.sequence for item in (src.input or [])}
        deps[src.id] = {sid for sid in input_seq_ids if sid in source_ids}

    order = []
    visited = set()

    def visit(sid: int) -> None:
        if sid in visited:
            return
        visited.add(sid)
        for dep in deps.get(sid, ()):
            visit(dep)
        order.append(sid)

    for src in cloning_strategy.sources:
        visit(src.id)
    return list(order)


def dseqrecord_to_db(
    dseqrecord: Dseqrecord,
    session: Session,
    *,
    ctx: WriteContext,
) -> Sequence:
    """Persist *dseqrecord* via ``from_dseqrecords`` → ``cloning_strategy_to_db``.

    Intended for single-output strategies (one sequence row). Returns that ``Sequence``.
    """
    cs = pydna_opencloning_models.CloningStrategy.from_dseqrecords([dseqrecord])
    if len(cs.sequences) != 1:
        raise ValueError(f"dseqrecord_to_db expects exactly one sequence in the strategy; got {len(cs.sequences)}")
    sequences, _ = cloning_strategy_to_db(cs, session, ctx=ctx)
    return sequences[0]


def _normalize_primer_sequence(sequence: str | None) -> str:
    return (sequence or '').lower()


def get_db_primers_from_database_ids(
    session: Session,
    workspace_id: int,
    database_ids: set[int],
) -> dict[int, Primer]:
    if len(database_ids) == 0:
        return {}
    return {
        primer.id: primer
        for primer in session.scalars(
            select(Primer).where(
                Primer.workspace_id == workspace_id,
                Primer.id.in_(database_ids),
            )
        ).all()
    }


def get_db_primers_grouped_by_sequence(
    session: Session,
    workspace_id: int,
    sequences: set[str],
) -> dict[str, list[Primer]]:
    assert len(sequences) > 0
    grouped: dict[str, list[Primer]] = {}
    for primer in session.scalars(
        select(Primer).where(
            Primer.workspace_id == workspace_id,
            func.lower(Primer.sequence).in_(sequences),
        )
    ).all():
        grouped.setdefault(_normalize_primer_sequence(primer.sequence), []).append(primer)
    return grouped


def get_primer_db_mismatch(
    primer: opencloning_models.Primer,
    existing_primer: Primer | None,
    normalized_sequence: str,
) -> PrimerDatabaseIdMismatch | None:
    provided_database_id = primer.database_id
    assert provided_database_id is not None

    if existing_primer is None:
        return PrimerDatabaseIdMismatch(
            primer_id=primer.id,
            provided_database_id=provided_database_id,
            kind='not_found',
        )

    if _normalize_primer_sequence(existing_primer.sequence) != normalized_sequence:
        return PrimerDatabaseIdMismatch(
            primer_id=primer.id,
            provided_database_id=provided_database_id,
            kind='sequence_mismatch',
        )

    return None


def _verify_incoming_primer_database_ids(
    primers: list[opencloning_models.Primer],
    existing_primers_by_id: dict[int, Primer],
) -> tuple[list[PrimerDatabaseIdMismatch], dict[int, str], set[str]]:

    mismatches: list[PrimerDatabaseIdMismatch] = []
    primer_sequences: dict[int, str] = {}
    sequences_needing_match: set[str] = set()

    for primer in primers:
        normalized_sequence = _normalize_primer_sequence(primer.sequence)
        primer_sequences[primer.id] = normalized_sequence

        if primer.database_id is None:
            sequences_needing_match.add(normalized_sequence)
            continue

        mismatch = get_primer_db_mismatch(
            primer,
            existing_primers_by_id.get(primer.database_id),
            normalized_sequence,
        )
        if mismatch is not None:
            mismatches.append(mismatch)
            primer.database_id = None
            sequences_needing_match.add(normalized_sequence)

    return mismatches, primer_sequences, sequences_needing_match


def _link_primers_by_sequence_match(
    primers: list[opencloning_models.Primer],
    primer_sequences: dict[int, str],
    existing_primers_by_sequence: dict[str, list[Primer]],
) -> None:
    for primer in primers:
        if primer.database_id is not None:
            continue
        matches = existing_primers_by_sequence.get(primer_sequences[primer.id], [])
        if len(matches) >= 1:
            primer.database_id = matches[0].id


def _sync_primers_with_db(
    primers: list[opencloning_models.Primer],
    session: Session,
    workspace_id: int,
    *,
    match_by_sequence: bool = True,
) -> list[PrimerDatabaseIdMismatch]:
    if len(primers) == 0:
        return []

    provided_database_ids = {primer.database_id for primer in primers if primer.database_id is not None}
    existing_primers_by_id = get_db_primers_from_database_ids(session, workspace_id, provided_database_ids)
    mismatches, primer_sequences, sequences_needing_match = _verify_incoming_primer_database_ids(
        primers, existing_primers_by_id
    )
    if match_by_sequence and len(sequences_needing_match) > 0:
        existing_primers_by_sequence = get_db_primers_grouped_by_sequence(
            session, workspace_id, sequences_needing_match
        )
        _link_primers_by_sequence_match(primers, primer_sequences, existing_primers_by_sequence)

    return mismatches


def get_db_sequences_from_database_ids(
    session: Session,
    workspace_id: int,
    database_ids: set[int],
) -> dict[int, Sequence]:
    if len(database_ids) == 0:
        return {}
    stmt = (
        select(Sequence)
        .where(
            Sequence.workspace_id == workspace_id,
            Sequence.id.in_(database_ids),
        )
        .options(undefer(Sequence.file_content))
    )
    return {sequence.id: sequence for sequence in session.scalars(stmt).all()}


def get_db_sequences_grouped_by_seguid(
    session: Session,
    workspace_id: int,
    seguids: set[str],
) -> dict[str, list[Sequence]]:
    if len(seguids) == 0:
        return {}
    grouped: dict[str, list[Sequence]] = {}
    stmt = (
        select(Sequence)
        .where(
            Sequence.workspace_id == workspace_id,
            Sequence.seguid.in_(seguids),
        )
        .options(undefer(Sequence.file_content))
    )
    for sequence in session.scalars(stmt).all():
        grouped.setdefault(sequence.seguid, []).append(sequence)
    return grouped


def _clear_dseqrecord_database_id(dseqr: Dseqrecord) -> None:
    assert dseqr.source is not None

    if isinstance(dseqr.source, pydna_opencloning_models.DatabaseSource):
        # This assignment is because DatabaseSource cannot have a database_id that is None
        dseqr.source = None
    else:
        dseqr.source.database_id = None


def _link_dseqrecord_to_database(dseqr: Dseqrecord, database_id: int) -> None:
    dseqr.source = pydna_opencloning_models.DatabaseSource(database_id=database_id, input=[])


def get_sequence_db_mismatch(
    *,
    sequence_id: int,
    provided_database_id: int,
    existing_sequence: Sequence | None,
    seguid: str,
) -> SequenceDatabaseIdMismatch | None:
    if existing_sequence is None:
        return SequenceDatabaseIdMismatch(
            sequence_id=sequence_id,
            provided_database_id=provided_database_id,
            kind='not_found',
        )

    if existing_sequence.seguid != seguid:
        return SequenceDatabaseIdMismatch(
            sequence_id=sequence_id,
            provided_database_id=provided_database_id,
            kind='seguid_mismatch',
        )

    return None


SeguidCache = dict[tuple[bool, str, str, int], str]


def _dseq_seguid_cached(dseq: Dseq, cache: SeguidCache) -> str:
    """Return pydna SEGUID for ``dseq``, reusing results within one sync pass."""
    key = (dseq.circular, dseq.watson, dseq.crick, dseq.ovhg)
    cached = cache.get(key)
    if cached is not None:
        return cached
    value = dseq.seguid()
    cache[key] = value
    return value


def _collect_dseqrecord_graph_lookups(
    dseqr: Dseqrecord,
    seguids: set[str],
    database_ids: set[int],
    seguid_cache: SeguidCache,
) -> None:
    """Collect SEGUIDs and database IDs from a Dseqrecord graph."""
    seguids.add(_dseq_seguid_cached(dseqr.seq, seguid_cache))
    if dseqr.source is None:
        return
    if dseqr.source.database_id is not None:
        database_ids.add(dseqr.source.database_id)

    for source_input in dseqr.source.input:
        child = source_input.sequence
        if isinstance(child, Dseqrecord):
            _collect_dseqrecord_graph_lookups(child, seguids, database_ids, seguid_cache)


def _replace_sequence_source_if_exists_in_db(
    dseqr: Dseqrecord,
    existing_sequences_by_id: dict[int, Sequence],
    existing_sequences_by_seguid: dict[str, list[Sequence]],
    mismatches: list[SequenceDatabaseIdMismatch],
    visited: set[int],
    seguid_cache: SeguidCache,
) -> None:
    """Recursively navigate a Dseqrecord history graph up to the first ancestor that exists in the database.
    If it exists, replace the source with a DatabaseSource, otherwise keep going up the graph.
    """
    local_id = pydna_opencloning_models.get_id(dseqr)
    if local_id in visited:
        return
    visited.add(local_id)

    seguid = _dseq_seguid_cached(dseqr.seq, seguid_cache)

    # "provided" because it comes from the cloning strategy, and might not be correct
    provided_database_id = None if dseqr.source is None else dseqr.source.database_id

    if provided_database_id is not None:
        mismatch = get_sequence_db_mismatch(
            sequence_id=local_id,
            provided_database_id=provided_database_id,
            existing_sequence=existing_sequences_by_id.get(provided_database_id),
            seguid=seguid,
        )
        if mismatch is None:
            if not isinstance(dseqr.source, pydna_opencloning_models.DatabaseSource):
                _link_dseqrecord_to_database(dseqr, provided_database_id)
            return

        mismatches.append(mismatch)
        _clear_dseqrecord_database_id(dseqr)

    matches = existing_sequences_by_seguid.get(seguid, [])
    if len(matches) > 0:
        db_sequence = min(matches, key=lambda sequence: sequence.id)
        _link_dseqrecord_to_database(dseqr, db_sequence.id)
        return

    if dseqr.source is None:
        return

    for source_input in dseqr.source.input:
        child = source_input.sequence
        if isinstance(child, Dseqrecord):
            _replace_sequence_source_if_exists_in_db(
                child,
                existing_sequences_by_id,
                existing_sequences_by_seguid,
                mismatches,
                visited,
                seguid_cache,
            )


def _replace_sequences_file_content_if_exists_in_db(
    synced_strategy: pydna_opencloning_models.CloningStrategy,
    existing_sequences_by_id: dict[int, Sequence],
    existing_sequences_by_seguid: dict[str, list[Sequence]],
) -> None:
    all_db_sequences = list(existing_sequences_by_id.values()) + sum(list(existing_sequences_by_seguid.values()), [])
    for source in synced_strategy.sources:
        if source.database_id is not None:
            sequence = next((s for s in synced_strategy.sequences if s.id == source.id))
            db_sequence = next((s for s in all_db_sequences if s.id == source.database_id))
            sequence.file_content = db_sequence.to_pydantic_sequence().file_content


def _sync_sequences_via_dseqrecords(
    pydna_strategy: pydna_opencloning_models.CloningStrategy,
    session: Session,
    workspace_id: int,
    *,
    match_by_sequence: bool = True,
) -> tuple[pydna_opencloning_models.CloningStrategy, list[SequenceDatabaseIdMismatch]]:
    terminals = pydna_strategy.to_dseqrecords()
    seguid_cache: SeguidCache = {}
    seguids: set[str] = set()
    database_ids: set[int] = set()
    for terminal in terminals:
        _collect_dseqrecord_graph_lookups(terminal, seguids, database_ids, seguid_cache)

    existing_sequences_by_id = get_db_sequences_from_database_ids(session, workspace_id, database_ids)
    existing_sequences_by_seguid = (
        get_db_sequences_grouped_by_seguid(session, workspace_id, seguids) if match_by_sequence else {}
    )

    mismatches: list[SequenceDatabaseIdMismatch] = []
    visited: set[int] = set()
    for terminal in terminals:
        _replace_sequence_source_if_exists_in_db(
            terminal,
            existing_sequences_by_id,
            existing_sequences_by_seguid,
            mismatches,
            visited,
            seguid_cache,
        )

    synced_strategy = pydna_opencloning_models.CloningStrategy.from_dseqrecords(
        terminals,
        pydna_strategy.description or '',
    )

    # Finally, for sequences that do exist in the database, replace their sequence.file_content with that of the db.
    _replace_sequences_file_content_if_exists_in_db(
        synced_strategy, existing_sequences_by_id, existing_sequences_by_seguid
    )

    # Then normalize
    try:
        synced_strategy = synced_strategy.normalize()
    except ValueError as e:
        raise ValueError(f"Error normalizing cloning strategy: {e}") from e

    return synced_strategy, mismatches


def sync_cloning_strategy_with_db(
    cloning_strategy: opencloning_models.CloningStrategy,
    session: Session,
    *,
    ctx: ReadContext,
    match_by_sequence: bool = True,
) -> CloningStrategySyncResult:
    """
    Sync a cloning strategy against existing workspace entities. It assumes that is
    validated before syncing.

    For primers:
    - If ``database_id`` is set, verify it exists in the workspace and matches sequence
      (case-insensitive). On failure, record a mismatch warning and clear ``database_id``.
    - Then match remaining primers by sequence; if exactly one workspace primer matches,
      set ``database_id`` to that primer (skipped if ``match_by_sequence`` is False).

    For sequences (via pydna graph):
    - Rebuild terminal ``Dseqrecord`` objects with ``to_dseqrecords()``.
    - Validate or resolve ``database_id`` by SEGUID; on match, replace source with
      ``DatabaseSource`` (dropping parent provenance). If ``match_by_sequence`` is False,
      only provided ``database_id`` values are validated; nothing is resolved by SEGUID.
    - Rebuild the strategy with ``from_dseqrecords()``.
    """
    synced_primers = [
        opencloning_models.Primer.model_validate(primer.model_dump(mode='json'))
        for primer in (cloning_strategy.primers or [])
    ]
    primer_mismatches = _sync_primers_with_db(
        synced_primers, session, ctx.workspace_id, match_by_sequence=match_by_sequence
    )
    pydna_strategy = pydna_opencloning_models.CloningStrategy.model_validate(cloning_strategy.model_dump(mode='json'))

    with pydna_opencloning_models.id_mode(use_python_internal_id=False):
        pydna_strategy, sequence_mismatches = _sync_sequences_via_dseqrecords(
            pydna_strategy,
            session,
            ctx.workspace_id,
            match_by_sequence=match_by_sequence,
        )

        linkml_strategy = opencloning_models.CloningStrategy.model_validate(pydna_strategy.model_dump(mode='json'))
    # Primers are added here, which means that even if they are not used in the cloning, they will be added.
    # If they are already in the db, they are skipped anyway.
    linkml_strategy.primers = synced_primers
    all_sequences_are_in_db = all(source.database_id is not None for source in linkml_strategy.sources)
    all_primers_are_in_db = all(primer.database_id is not None for primer in linkml_strategy.primers)

    return CloningStrategySyncResult(
        cloning_strategy=linkml_strategy,
        primer_database_id_mismatches=primer_mismatches,
        sequence_database_id_mismatches=sequence_mismatches,
        already_synced=all_sequences_are_in_db and all_primers_are_in_db,
    )


def cloning_strategy_to_db(
    cloning_strategy: opencloning_models.CloningStrategy,
    session: Session,
    *,
    ctx: WriteContext,
    tags: list[Tag] | None = None,
) -> tuple[list[Sequence], dict[int, int]]:
    from opencloning_db.workspace_deps import get_primer_in_workspace_for_user, get_sequence_in_workspace_for_user

    sequences = []
    entity_mapping = {}  # Combined mapping for sequences and primers (by id)

    for sequence in cloning_strategy.sequences:
        # New model: source.id == output sequence id
        parent_source = next((s for s in cloning_strategy.sources if s.id == sequence.id), None)
        if parent_source is None:
            raise ValueError(f"No source produces sequence {sequence.id}")
        if parent_source.database_id is None:
            db_sequence = Sequence.from_pydantic_sequence(sequence, ctx=ctx)
            db_sequence.sequence_type = guess_sequence_type(sequence, parent_source)
            if tags:
                db_sequence.tags.extend(tags)
        else:
            db_sequence = get_sequence_in_workspace_for_user(
                session, ctx.user, ctx.workspace_id, parent_source.database_id, WorkspaceRole.editor
            )
            require_real_sequence(
                db_sequence,
                detail=f'Parent sequence {parent_source.database_id} is a template. Please contact support.',
                status_code=400,
            )
        sequences.append(db_sequence)
        entity_mapping[sequence.id] = db_sequence

    for primer in cloning_strategy.primers or []:
        db_primer = (
            Primer.from_pydantic(primer, ctx=ctx)
            if primer.database_id is None
            else get_primer_in_workspace_for_user(
                session, ctx.user, ctx.workspace_id, primer.database_id, WorkspaceRole.editor
            )
        )
        entity_mapping[primer.id] = db_primer

    # Add primers first (no output_of_source); flush so they're persisted before any source references them
    for primer in cloning_strategy.primers or []:
        if primer.database_id is None:
            db_primer = entity_mapping[primer.id]
            if tags:
                db_primer.tags.extend(tags)
            session.add(db_primer)
    session.flush()

    # Process sources in topological order, add+flush each to satisfy single_parent
    source_by_id = {s.id: s for s in cloning_strategy.sources}
    for source_id in _source_order(cloning_strategy):
        source = source_by_id[source_id]
        if source.database_id is not None:
            continue
        output_sequence = entity_mapping[source.id]
        Source.from_pydantic(source, output_sequence, entity_mapping)
        session.add(output_sequence)
        session.flush()

    id_mappings = {k: v.id for k, v in entity_mapping.items()}
    return sequences, id_mappings


def get_cloning_strategy_from_db(
    session: Session,
    ctx: WriteContext,
    sequence_id: int,
    recursive: bool = False,
) -> opencloning_models.CloningStrategy:
    from opencloning_db.workspace_deps import get_sequence_in_workspace_for_user

    db_sequence = get_sequence_in_workspace_for_user(
        session, ctx.user, ctx.workspace_id, sequence_id, WorkspaceRole.viewer
    )
    db_sequence = require_real_sequence(db_sequence, detail='cloning_strategy endpoint only supports real sequences.')
    parent_source = db_sequence.output_of_source
    parent_sequences = [
        source_input.input_entity
        for source_input in parent_source.input
        if isinstance(source_input.input_entity, Sequence)
        and source_input.input_entity.workspace_id == db_sequence.workspace_id  # TODO: Maybe remove?
    ]
    primers: list[Primer] = [
        source_input.input_entity
        for source_input in parent_source.input
        if isinstance(source_input.input_entity, Primer)
        and source_input.input_entity.workspace_id == db_sequence.workspace_id  # TODO: Maybe remove?
    ]

    sequence_ids = {db_sequence.id}
    sequence_ids.update(sequence.id for sequence in parent_sequences)
    loaded_sequences = get_db_sequences_from_database_ids(session, ctx.workspace_id, sequence_ids)

    grandparent_sources: list[Source] = []
    grandparent_sources += [s.output_of_source for s in parent_sequences]

    all_sequences = [loaded_sequences[db_sequence.id]] + [
        loaded_sequences[sequence.id] for sequence in parent_sequences
    ]
    all_sources = [parent_source] + grandparent_sources

    exported_sequences = [seq.to_pydantic_sequence() for seq in unique_and_sorted(all_sequences)]
    exported_primers = [primer.to_pydantic_primer() for primer in unique_and_sorted(primers)]
    exported_sources = [source.to_pydantic_source() for source in unique_and_sorted(all_sources)]
    if not recursive:
        return opencloning_models.CloningStrategy(
            sequences=exported_sequences,
            sources=exported_sources,
            primers=exported_primers,
            description='',
            files=[],
        )
    else:
        for sequence in parent_sequences:
            cs = get_cloning_strategy_from_db(session, ctx, sequence.id, recursive=True)
            exported_sequences.extend(cs.sequences)
            exported_sources.extend(cs.sources)
            exported_primers.extend(cs.primers)
        return opencloning_models.CloningStrategy(
            sequences=unique_and_sorted(exported_sequences),
            sources=unique_and_sorted(exported_sources),
            primers=unique_and_sorted(exported_primers),
            description='',
            files=[],
        )


def build_workspace_cloning_strategy(
    session: Session,
    ctx: WriteContext,
    sequences: list[Sequence],
) -> opencloning_models.CloningStrategy:
    """Merge recursive cloning strategies for leaf sequences (no children) in *sequences*."""
    exported_sequences: list[opencloning_models.Sequence] = []
    exported_sources: list[opencloning_models.Source] = []
    exported_primers: list[opencloning_models.Primer] = []

    for db_sequence in sequences:
        if not isinstance(db_sequence, Sequence):
            continue
        if db_sequence.source_inputs:
            continue
        if db_sequence.output_of_source is None:
            continue
        cs = get_cloning_strategy_from_db(session, ctx, db_sequence.id, recursive=True)
        exported_sequences.extend(cs.sequences)
        exported_sources.extend(cs.sources)
        exported_primers.extend(cs.primers)

    return opencloning_models.CloningStrategy(
        sequences=unique_and_sorted(exported_sequences),
        sources=unique_and_sorted(exported_sources),
        primers=unique_and_sorted(exported_primers),
        description='',
        files=[],
    )
