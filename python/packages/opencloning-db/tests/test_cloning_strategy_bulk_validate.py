"""Bulk cloning-strategy validate (multipart) and submit (JSON) endpoints."""

import json
from pathlib import Path
import copy

import opencloning_linkml.datamodel.models as opencloning_models
import pytest

from tests.cloning_strategy_examples import cs_pcr
from tests.helpers import workspace_headers
from opencloning_db.db import sync_cloning_strategy_with_db
from opencloning_db.context import ReadContext
from opencloning_db.db import _sync_sequences_via_dseqrecords
from sqlalchemy.orm import Session
from pydna.dseqrecord import Dseqrecord
import pydna.opencloning_models as pydna_opencloning_models
from pydna.assembly2 import pcr_assembly
from pydna.primer import Primer as PydnaPrimer

pytest_plugins = ['tests.test_sequences']

_TEST_FILES = Path(__file__).resolve().parents[2] / 'opencloning' / 'tests' / 'test_files'
_GATEWAY_FILES = _TEST_FILES / 'gateway_manual_cloning'
_OLD_FORMAT_FILE = _TEST_FILES / 'homologous_recombination_old_format.json'

readonly_db = pytest.mark.readonly_db


@pytest.fixture(scope='module')
def shifted_pcr_template_and_product() -> tuple[Dseqrecord, Dseqrecord, Dseqrecord]:
    pcr_product = cs_pcr.to_dseqrecords()[0]
    pcr_template = pcr_product.source.input[1].sequence
    new_template = Dseqrecord(pcr_template.seq, circular=True).shifted(4)
    new_template.name = 'new_template'
    new_product, *_ = pcr_assembly(
        new_template,
        PydnaPrimer('aaaaACGTACGT', name='primer1-with-tail'),
        pcr_product.source.input[2].sequence,
        limit=8,
    )
    new_product.name = 'new_product'
    return pcr_template, new_template, new_product


def _post_bulk_validate(
    client,
    token: str,
    workspace_id: int,
    files: list[tuple[str, bytes]],
    *,
    content_type: str = 'application/json',
):
    return client.post(
        '/sequences/cloning_strategy/bulk/validate',
        headers=workspace_headers(token, workspace_id),
        files=[('files', (name, body, content_type)) for name, body in files],
    )


def _pcr_strategy_bytes(drop_database_ids: bool = False) -> bytes:
    data = cs_pcr.model_dump()
    if drop_database_ids:
        for source in data['sources']:
            source['database_id'] = None
    return json.dumps(data).encode('utf-8')


def _invalid_pcr_strategy_bytes() -> bytes:
    data = _invalid_pcr_strategy_dict()
    return json.dumps(data).encode('utf-8')


def _invalid_pcr_strategy_dict() -> dict:
    from pydna.dseq import Dseq

    product = cs_pcr.to_dseqrecords()[0]
    product.seq = Dseq('A')
    data = pydna_opencloning_models.CloningStrategy.from_dseqrecords([product]).model_dump()
    return data


def _pcr_strategy_dict(drop_database_ids: bool = False) -> dict:
    data = cs_pcr.model_dump()
    if drop_database_ids:
        for source in data['sources']:
            source['database_id'] = None
    return data


def _sync_result_filled(cloning_strategy: dict, file_name: str = 'strategy.json') -> dict:
    """Build a ``CloningStrategySyncResultFilled`` request body item."""
    return {'cloning_strategy': cloning_strategy, 'file_name': file_name}


def _post_bulk_submit(
    client,
    token: str,
    workspace_id: int,
    sync_results: list[dict],
    *,
    tags: list[int] | None = None,
):
    params = [('tags', str(tag_id)) for tag_id in (tags or [])]
    return client.post(
        '/sequences/cloning_strategy/bulk',
        headers=workspace_headers(
            token,
            workspace_id,
            extra={'Content-Type': 'application/json'},
        ),
        params=params,
        json=sync_results,
    )


@readonly_db
def test_sync_cloning_strategy_with_db_matches_primers_case_insensitively(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    assert strategy.primers is not None
    for primer in strategy.primers:
        primer.database_id = None
        primer.sequence = primer.sequence.lower()

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w1']),
        )

    synced_ids = {primer.database_id for primer in (result.cloning_strategy.primers or [])}
    assert sequences_client['primer1_id'] in synced_ids
    assert sequences_client['primer2_id'] in synced_ids
    assert result.primer_database_id_mismatches == []
    assert result.sequence_database_id_mismatches == []
    assert result.already_synced is True


@readonly_db
def test_sync_cloning_strategy_with_db_does_not_cross_workspaces(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    assert strategy.primers is not None
    for primer in strategy.primers:
        primer.database_id = None

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w2']),
        )

    assert all(primer.database_id is None for primer in (result.cloning_strategy.primers or []))
    assert result.primer_database_id_mismatches == []
    assert result.sequence_database_id_mismatches == []
    assert result.already_synced is False


@readonly_db
def test_sync_cloning_strategy_with_db_warns_and_rematches_on_stale_database_id(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    assert strategy.primers is not None
    primer1 = next(p for p in strategy.primers if p.name == 'primer1')
    primer1.database_id = sequences_client['primer2_id']

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w1']),
        )

    assert len(result.primer_database_id_mismatches) == 1
    mismatch = result.primer_database_id_mismatches[0]
    assert mismatch.primer_id == primer1.id
    assert mismatch.provided_database_id == sequences_client['primer2_id']
    assert mismatch.kind == 'sequence_mismatch'
    synced_primer1 = next(p for p in (result.cloning_strategy.primers or []) if p.name == 'primer1')
    assert synced_primer1.database_id == sequences_client['primer1_id']


@readonly_db
def test_sync_cloning_strategy_with_db_warns_when_database_id_not_in_workspace(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    assert strategy.primers is not None
    primer1 = next(p for p in strategy.primers if p.name == 'primer1')
    primer1.database_id = 999_999

    assert len(strategy.sources) == 2
    strategy.sources[0].database_id = 999_999
    strategy.sources[1].database_id = 999_999

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w1']),
        )

    assert len(result.primer_database_id_mismatches) == 1
    mismatch = result.primer_database_id_mismatches[0]
    assert mismatch.primer_id == primer1.id
    assert mismatch.provided_database_id == 999_999
    assert mismatch.kind == 'not_found'
    synced_primer1 = next(p for p in (result.cloning_strategy.primers or []) if p.name == 'primer1')
    assert synced_primer1.database_id == sequences_client['primer1_id']

    assert len(result.sequence_database_id_mismatches) == 1
    mismatch = result.sequence_database_id_mismatches[0]
    assert mismatch.sequence_id == strategy.sources[0].id
    assert mismatch.provided_database_id == 999_999
    assert mismatch.kind == 'not_found'
    assert len(result.cloning_strategy.sequences) == 1
    assert len(result.cloning_strategy.sources) == 1
    synced_source = result.cloning_strategy.sources[0]
    assert synced_source.type == 'DatabaseSource'
    assert synced_source.database_id == sequences_client['pcr_product_id']


def _terminal_sequence_ids(strategy: opencloning_models.CloningStrategy) -> set[int]:
    input_ids = {item.sequence for source in strategy.sources for item in (source.input or [])}
    return {sequence.id for sequence in strategy.sequences if sequence.id not in input_ids}


def _source_for_sequence(strategy: opencloning_models.CloningStrategy, sequence_id: int):
    return next(source for source in strategy.sources if source.id == sequence_id)


@readonly_db
def test_sync_cloning_strategy_with_db_links_terminal_by_seguid(sequences_client):
    """Locates sequence and trims parents"""

    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    for source in strategy.sources:
        source.database_id = None

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w1']),
        )

    synced = result.cloning_strategy
    assert len(synced.sources) == 1
    assert len(synced.sequences) == 1
    terminal_source = synced.sources[0]
    assert terminal_source.type == 'DatabaseSource'
    assert terminal_source.database_id == sequences_client['pcr_product_id']
    assert result.sequence_database_id_mismatches == []


@readonly_db
def test_sync_cloning_strategy_with_db_sequence_stale_database_id(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    terminal_id = next(iter(_terminal_sequence_ids(strategy)))
    terminal_source = _source_for_sequence(strategy, terminal_id)
    terminal_source.database_id = sequences_client['pcr_template_id']

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w1']),
        )

    assert len(result.sequence_database_id_mismatches) == 1
    mismatch = result.sequence_database_id_mismatches[0]
    assert mismatch.provided_database_id == sequences_client['pcr_template_id']
    assert mismatch.kind == 'seguid_mismatch'

    assert len(result.cloning_strategy.sequences) == 1
    assert len(result.cloning_strategy.sources) == 1
    synced_terminal = result.cloning_strategy.sequences[0]
    assert synced_terminal.id == terminal_id
    synced_source = result.cloning_strategy.sources[0]
    assert synced_source.type == 'DatabaseSource'
    assert synced_source.database_id == sequences_client['pcr_product_id']


@readonly_db
def test_sync_cloning_strategy_with_db_sequence_not_found_database_id(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    terminal_id = next(iter(_terminal_sequence_ids(strategy)))
    terminal_source = _source_for_sequence(strategy, terminal_id)
    terminal_source.database_id = 999_999

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=sequences_client['w1']),
        )

    assert len(result.sequence_database_id_mismatches) == 1
    mismatch = result.sequence_database_id_mismatches[0]
    assert mismatch.provided_database_id == 999_999
    assert mismatch.kind == 'not_found'

    assert len(result.cloning_strategy.sequences) == 1
    assert len(result.cloning_strategy.sources) == 1
    synced_terminal = result.cloning_strategy.sequences[0]
    assert synced_terminal.id == terminal_id
    synced_source = result.cloning_strategy.sources[0]
    assert synced_source.type == 'DatabaseSource'
    assert synced_source.database_id == sequences_client['pcr_product_id']


@pytest.mark.parametrize('provide_database_id', ['', 'correct', 'wrong'])
@readonly_db
def test_sync_cloning_strategy_with_db_walks_to_parent_when_terminal_not_in_db(sequences_client, provide_database_id):

    from Bio.Restriction import AfaI

    pydna_strategy = pydna_opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    if provide_database_id:
        pcr_source = next(s for s in pydna_strategy.sources if s.type == 'PCRSource')
        if provide_database_id == 'correct':
            pcr_source.database_id = sequences_client['pcr_product_id']
        elif provide_database_id == 'wrong':
            pcr_source.database_id = 999_999

    product = pydna_strategy.to_dseqrecords()[0]
    children_of_product = product.cut(AfaI)

    with Session(sequences_client['engine']) as session:
        pydna_out, sequence_mismatches = _sync_sequences_via_dseqrecords(
            pydna_opencloning_models.CloningStrategy.from_dseqrecords(children_of_product),
            session,
            sequences_client['w1'],
        )

    assert len(pydna_out.sequences) == 3
    assert len(pydna_out.sources) == 3
    assert len([s for s in pydna_out.sources if s.type == 'DatabaseSource']) == 1
    assert len([s for s in pydna_out.sources if s.type == 'RestrictionEnzymeDigestionSource']) == 2


@readonly_db
def test_sync_cloning_strategy_with_db_database_source_with_wrong_db_id(sequences_client):
    strategy = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json'))
    sequence = strategy.sequences[0]

    sequence.id = 123
    source = {
        'id': 123,
        'type': 'DatabaseSource',
        'database_id': 999_999,
    }
    cs = opencloning_models.CloningStrategy.model_validate(
        {
            'sequences': [sequence.model_dump(mode='json')],
            'sources': [source],
            'primers': [],
        }
    )
    client = sequences_client['client']
    r = client.post(
        '/sequences/cloning_strategy/bulk',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json=[_sync_result_filled(cs.model_dump(), file_name='cs.json')],
    )
    assert r.status_code == 200
    assert len(r.json()) == 0


@readonly_db
def test_sync_cloning_strategy_with_db_picks_lowest_id_for_ambiguous_seguid(sequences_client):
    c = sequences_client['client']
    wid = sequences_client['w1']
    headers = workspace_headers(sequences_client['token_owner_w1'], wid)

    dup_record = Dseqrecord('atgcagctagctagctagctgactgactg', name='ambiguous-seguid-a')
    dup_record_b = Dseqrecord('atgcagctagctagctagctgactgactg', name='ambiguous-seguid-b')
    files_a = {'files': ('ambiguous-a.gb', dup_record.format('genbank'), 'application/octet-stream')}
    files_b = {'files': ('ambiguous-b.gb', dup_record_b.format('genbank'), 'application/octet-stream')}
    r1 = c.post('/sequences/bulk?strict=false', headers=headers, files=files_a)
    assert r1.status_code == 200, r1.text
    lower_id = min(item['id'] for item in r1.json())

    r2 = c.post('/sequences/bulk?strict=false', headers=headers, files=files_b)
    assert r2.status_code == 200, r2.text
    higher_id = max(item['id'] for item in r2.json())
    assert lower_id < higher_id

    strategy = opencloning_models.CloningStrategy.model_validate(
        pydna_opencloning_models.CloningStrategy.from_dseqrecords([dup_record]).model_dump(mode='json')
    )
    for source in strategy.sources:
        source.database_id = None

    with Session(sequences_client['engine']) as session:
        result = sync_cloning_strategy_with_db(
            strategy,
            session,
            ctx=ReadContext(workspace_id=wid),
        )

    terminal_id = next(iter(_terminal_sequence_ids(result.cloning_strategy)))
    synced_source = _source_for_sequence(result.cloning_strategy, terminal_id)
    assert synced_source.type == 'DatabaseSource'
    assert synced_source.database_id == lower_id


@readonly_db
def test_sync_cloning_strategy_with_db_returns_rotated_or_oriented_sequences(
    sequences_client, shifted_pcr_template_and_product
):
    wid = sequences_client['w1']

    pcr_template, new_template, _ = shifted_pcr_template_and_product
    with Session(sequences_client['engine']) as session:
        pydna_out, sequence_mismatches = _sync_sequences_via_dseqrecords(
            pydna_opencloning_models.CloningStrategy.from_dseqrecords([new_template]),
            session,
            wid,
        )
    assert len(pydna_out.sequences) == 1
    assert len(pydna_out.sources) == 1
    assert pydna_out.sources[0].database_id == sequences_client['pcr_template_id']
    assert pydna_out.sources[0].type == 'DatabaseSource'
    assert pydna_out.to_dseqrecords()[0].seq == pcr_template.seq


@readonly_db
def test_sync_cloning_strategy_with_db_returns_normalized_cloning_strategy(
    sequences_client, shifted_pcr_template_and_product
):

    wid = sequences_client['w1']

    pcr_template, new_template, new_product = shifted_pcr_template_and_product
    with Session(sequences_client['engine']) as session:
        pydna_out, sequence_mismatches = _sync_sequences_via_dseqrecords(
            pydna_opencloning_models.CloningStrategy.from_dseqrecords([new_product]),
            session,
            wid,
        )
    assert len(pydna_out.sequences) == 2
    assert len(pydna_out.sources) == 2

    # Template is the same as the original (not shifted)
    returned_product = pydna_out.to_dseqrecords()[0]
    returned_template = returned_product.source.input[1].sequence
    assert returned_template.seq == pcr_template.seq

    # Coordinates are different to what was submitted because the cloning strategy was normalized
    assert returned_product.source.input[1].left_location != new_product.source.input[1].left_location


@readonly_db
def test_bulk_validate_malformed_json(sequences_client):
    c = sequences_client['client']
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('bad.json', b'{not json')],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['file_name'] == 'bad.json'
    assert row['parsing_errors'] == ['Cloning strategy is not valid JSON']
    assert row['cloning_strategy'] is None
    assert row['already_synced'] is False


@readonly_db
def test_bulk_validate_unrelated_json(sequences_client):
    c = sequences_client['client']
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('unrelated.json', json.dumps({'dummy': 'dummy'}).encode('utf-8'))],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['file_name'] == 'unrelated.json'
    assert row['parsing_errors'] == ['The cloning strategy is invalid']
    assert row['cloning_strategy'] is None
    assert row['already_synced'] is False


@readonly_db
def test_bulk_validate_schema_invalid_cloning_strategy(sequences_client):
    data = cs_pcr.model_dump()
    data['dummy'] = 'dummy'
    c = sequences_client['client']
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('invalid_schema.json', json.dumps(data).encode('utf-8'))],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['file_name'] == 'invalid_schema.json'
    assert row['parsing_errors'] == ['The cloning strategy is invalid']
    assert row['cloning_strategy'] is None
    assert row['already_synced'] is False


@readonly_db
def test_bulk_validate_migrates_old_format(sequences_client):
    c = sequences_client['client']
    old_bytes = _OLD_FORMAT_FILE.read_bytes()
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('homologous_recombination_old_format.json', old_bytes)],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['file_name'] == 'homologous_recombination_old_format.json'
    assert row['parsing_errors'] == []
    assert row['cloning_strategy'] is not None
    assert any('previous version of the model and has been migrated' in w for w in row['parsing_warnings'])
    assert row['already_synced'] is False


@readonly_db
def test_bulk_validate_pydna_graph_invalid(sequences_client):
    c = sequences_client['client']
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('invalid_graph.json', _invalid_pcr_strategy_bytes())],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['file_name'] == 'invalid_graph.json'
    assert len(row['parsing_errors']) == 1
    assert row['parsing_errors'][0].startswith('Cloning strategy is not correct:')
    assert row['cloning_strategy'] is None
    assert row['already_synced'] is False


@readonly_db
def test_bulk_validate_happy_path_syncs_with_db(sequences_client):
    c = sequences_client['client']
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('pcr.json', _pcr_strategy_bytes(drop_database_ids=True))],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['file_name'] == 'pcr.json'
    assert row['parsing_errors'] == []
    assert row['parsing_warnings'] == []
    assert row['cloning_strategy'] is not None
    assert row['primer_database_id_mismatches'] == []
    assert row['sequence_database_id_mismatches'] == []
    assert row['already_synced'] is True

    primers = row['cloning_strategy']['primers']
    assert primers is not None
    synced_ids = {p['database_id'] for p in primers}
    assert sequences_client['primer1_id'] in synced_ids
    assert sequences_client['primer2_id'] in synced_ids


@readonly_db
def test_bulk_validate_multiple_files_in_one_request(sequences_client):
    c = sequences_client['client']
    schema_invalid = cs_pcr.model_dump()
    schema_invalid['dummy'] = 'dummy'
    files = [
        ('bad.json', b'{not json'),
        ('unrelated.json', json.dumps({'dummy': 'dummy'}).encode('utf-8')),
        ('invalid_schema.json', json.dumps(schema_invalid).encode('utf-8')),
        ('homologous_recombination_old_format.json', _OLD_FORMAT_FILE.read_bytes()),
        ('invalid_graph.json', _invalid_pcr_strategy_bytes()),
        ('pcr.json', _pcr_strategy_bytes()),
    ]
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        files,
    )
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == len(files)
    assert [row['file_name'] for row in rows] == [name for name, _ in files]

    assert rows[0]['parsing_errors'] == ['Cloning strategy is not valid JSON']
    assert rows[1]['parsing_errors'] == ['The cloning strategy is invalid']
    assert rows[2]['parsing_errors'] == ['The cloning strategy is invalid']
    assert rows[3]['parsing_errors'] == []
    assert any('previous version' in w for w in rows[3]['parsing_warnings'])
    assert rows[4]['parsing_errors'][0].startswith('Cloning strategy is not correct:')
    assert rows[4]['already_synced'] is False
    assert rows[5]['parsing_errors'] == []
    assert rows[5]['cloning_strategy'] is not None
    assert rows[5]['already_synced'] is True


@readonly_db
def test_bulk_validate_snapgene_dna_files(sequences_client):
    c = sequences_client['client']
    token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    # Submit pDONR so that it's picked up as already synced
    resp = c.post(
        '/sequences/bulk',
        headers=workspace_headers(token, wid),
        files={
            'files': ('pDONRtm221.dna', (_GATEWAY_FILES / 'pDONRtm221.dna').read_bytes(), 'application/octet-stream')
        },
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    pdonr_id = resp.json()[0]['id']

    files = [
        ('entry-attP1_1-attP2_1.dna', (_GATEWAY_FILES / 'entry-attP1_1-attP2_1.dna').read_bytes()),
        ('circularize.dna', (_TEST_FILES / 'circularize.dna').read_bytes()),
        ('pDONRtm221.dna', (_GATEWAY_FILES / 'pDONRtm221.dna').read_bytes()),
        ('malformed.dna', b'not a valid snapgene history file'),
    ]
    r = _post_bulk_validate(c, token, wid, files, content_type='application/octet-stream')
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == len(files)
    assert [row['file_name'] for row in rows] == [name for name, _ in files]

    entry = rows[0]
    assert entry['parsing_errors'] == []
    assert entry['parsing_warnings'] == []
    assert entry['cloning_strategy'] is not None
    assert {s['type'] for s in entry['cloning_strategy']['sources']} == {
        'GatewaySource',
        'UploadedFileSource',
        'PCRSource',
        'DatabaseSource',
    }
    pdonr_in_entry = list(s for s in entry['cloning_strategy']['sources'] if s['type'] == 'DatabaseSource')
    assert len(pdonr_in_entry) == 1
    assert pdonr_in_entry[0]['database_id'] == pdonr_id

    circularize = rows[1]
    assert circularize['parsing_errors'] == []
    assert any('Stopped at change topology operation' in w for w in circularize['parsing_warnings'])
    assert circularize['cloning_strategy'] is not None

    pdonr = rows[2]
    assert pdonr['parsing_errors'] == []
    assert pdonr['parsing_warnings'] == []
    assert pdonr['cloning_strategy'] is not None
    assert len(pdonr['cloning_strategy']['sequences']) == 1
    assert len(pdonr['cloning_strategy']['sources']) == 1
    assert pdonr['cloning_strategy']['sources'][0]['type'] == 'DatabaseSource'
    assert pdonr['already_synced'] is True

    malformed = rows[3]
    assert len(malformed['parsing_errors']) == 1
    assert malformed['parsing_errors'][0].startswith('Error parsing snapgene history file:')
    assert malformed['cloning_strategy'] is None


def _create_tag(client, token: str, workspace_id: int, name: str):
    return client.post(
        '/tags',
        headers=workspace_headers(token, workspace_id),
        json={'name': name},
    )


def test_bulk_submit_happy_path(sequences_client):
    """Submit a strategy that is not yet fully in the DB (homologous recombination fixture)."""
    c = sequences_client['client']
    tag_id = _create_tag(c, sequences_client['token_owner_w1'], sequences_client['w1'], 'test_tag').json()['id']
    old_bytes = _OLD_FORMAT_FILE.read_bytes()
    # We run this to fast-forward to current state
    val = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('homologous.json', old_bytes)],
    )
    assert val.json()[0]['already_synced'] is False
    filled = _sync_result_filled(val.json()[0]['cloning_strategy'], file_name='homologous.json')

    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [filled],
        tags=[tag_id],
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 4
    ids = {row['id'] for row in r.json()}

    # Sequences are created and tagged
    r = c.get(
        f"/sequences?tags={tag_id}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert len(r.json()['items']) == 4
    assert {row['id'] for row in r.json()['items']} == ids

    # Primers also created in the db
    r = c.get(
        f"/primers?tags={tag_id}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert len(r.json()['items']) == 2
    assert {p['name'] for p in r.json()['items']} == {'fwd', 'rvs'}


def test_bulk_submit_tags_only_in_new_entities(sequences_client, shifted_pcr_template_and_product):
    pcr_template, new_template, new_product = shifted_pcr_template_and_product
    c = sequences_client['client']
    tag_id = _create_tag(c, sequences_client['token_owner_w1'], sequences_client['w1'], 'test_tag').json()['id']
    payload = _sync_result_filled(
        pydna_opencloning_models.CloningStrategy.from_dseqrecords([new_product]).model_dump(), file_name='pcr.json'
    )
    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [payload],
        tags=[tag_id],
    )
    assert r.status_code == 200
    assert len(r.json()) == 2
    names = {row['name'] for row in r.json()}
    # The name is taken from the database, not the new template
    assert names == {'new_product', 'template'}

    # Only new entities have been tagged (one primer and one sequence)
    r = c.get(
        f"/sequences?tags={tag_id}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert len(r.json()['items']) == 1
    assert {row['name'] for row in r.json()['items']} == {'new_product'}
    r = c.get(
        f"/primers?tags={tag_id}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert len(r.json()['items']) == 1
    assert {p['name'] for p in r.json()['items']} == {'primer1-with-tail'}


@readonly_db
def test_bulk_validate_seeded_pcr_already_synced(sequences_client):
    c = sequences_client['client']
    r = _post_bulk_validate(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [('pcr.json', _pcr_strategy_bytes())],
    )
    assert r.status_code == 200
    row = r.json()[0]
    assert row['parsing_errors'] == []
    assert row['already_synced'] is True

    filled = _sync_result_filled(row['cloning_strategy'], file_name='pcr.json')
    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [filled],
    )
    assert r.status_code == 200, r.text
    # Empty list because all sequences are already in the db
    assert r.json() == []


def test_bulk_submit_unknown_tag_404(sequences_client):
    c = sequences_client['client']
    filled = _sync_result_filled(
        _pcr_strategy_dict(drop_database_ids=True),
        file_name='pcr.json',
    )
    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [filled],
        tags=[999999],
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'Tag not found'


def test_bulk_submit_validation_failure_409(sequences_client):
    """Logical validation errors return 409 with ``CloningStrategySyncResult`` rows."""
    c = sequences_client['client']
    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [
            _sync_result_filled(_pcr_strategy_dict(drop_database_ids=True), file_name='ok.json'),
            _sync_result_filled(_invalid_pcr_strategy_dict(), file_name='bad.json'),
        ],
    )
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['file_name'] == 'ok.json'
    assert rows[0]['parsing_errors'] == []
    assert rows[0]['already_synced'] is True
    assert rows[1]['file_name'] == 'bad.json'
    assert rows[1]['parsing_errors'][0].startswith('Cloning strategy is not correct:')


def test_bulk_submit_viewer_forbidden(sequences_client):
    c = sequences_client['client']
    r = _post_bulk_submit(
        c,
        sequences_client['token_viewer_w1'],
        sequences_client['w1'],
        [_sync_result_filled(_pcr_strategy_dict(drop_database_ids=True), file_name='pcr.json')],
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


def test_bulk_submit_same_sequence_twice_only_one_created(sequences_client, shifted_pcr_template_and_product):
    c = sequences_client['client']
    pcr_template, new_template, new_product = shifted_pcr_template_and_product
    payload = _sync_result_filled(
        pydna_opencloning_models.CloningStrategy.from_dseqrecords([new_product]).model_dump(), file_name='pcr.json'
    )
    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [payload, payload],
    )
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_bulk_submit_primers_only_works(sequences_client):
    c = sequences_client['client']
    cs = copy.deepcopy(cs_pcr)
    cs.sources = []
    cs.sequences = []
    tag_id = _create_tag(c, sequences_client['token_owner_w1'], sequences_client['w1'], 'test_tag').json()['id']
    primer1_id = sequences_client['primer1_id']
    primer1 = cs.primers[0]
    primer1.database_id = primer1_id
    cs.primers = [
        pydna_opencloning_models.PrimerModel(id=12, name='primer-only1', sequence='AAAAAAAAAA'),
        pydna_opencloning_models.PrimerModel(id=13, name='primer-only2', sequence='TTTTTTTTTT'),
        primer1,
    ]
    payload = _sync_result_filled(cs.model_dump(), file_name='primers_only.json')
    r = _post_bulk_submit(
        c,
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        [payload],
        tags=[tag_id],
    )
    assert r.status_code == 200
    assert len(r.json()) == 0

    # The primers have been created in the db
    r = c.get(
        f"/primers?tags={tag_id}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert len(r.json()['items']) == 2
    assert {p['name'] for p in r.json()['items']} == {'primer-only1', 'primer-only2'}
