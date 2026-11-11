"""Sequences routes: workspace scoping, filters, cloning strategy graph, and files."""

import copy
from opencloning.dna_functions import read_dsrecord_from_json
import opencloning_linkml.datamodel.models as opencloning_models
import pytest
from fastapi import HTTPException
from unittest.mock import patch
from opencloning_db.routers import sequences as sequences_router
from opencloning_db import config as app_config
from opencloning_db.config import get_config
from pydna.dseqrecord import Dseqrecord
from pydna.dseq import Dseq
from pydna.opencloning_models import TextFileSequence
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from opencloning_db.context import WriteContext
from opencloning_db.db import (
    cloning_strategy_to_db,
    create_sequencing_file,
    dseqrecord_to_db,
)
from opencloning_db.models import (
    Line,
    Sequence,
    SequenceInLine,
    SequenceSample,
    SequencingFile,
    Tag,
    Primer,
    User,
    TemplateSequence,
    SequenceType,
    BaseSequence,
)
from tests.cloning_strategy_examples import cs_gateway_BP, cs_pcr, pcr_product, pcr_template
from .helpers import (
    assert_get_invalid_workspace_id_422,
    assert_get_missing_workspace_header_422,
    assert_get_non_member_workspace_403,
    assert_get_unauthenticated_401,
    assert_patch_unauthenticated_401,
    attach_standard_tokens,
    bearer_headers,
    post_sequencing_file_upload,
    seed_standard_users,
    workspace_headers,
)
from opencloning_db.routers.sequences import _search_rotation

from pathlib import Path

TEST_FOLDER = Path(__file__).parent / '../../opencloning/tests/test_files'


def _write_ctx(workspace_id: int, user_id: int) -> WriteContext:
    """Build a WriteContext from raw id values used by the standard test fixtures."""
    return WriteContext(user=User(id=user_id, email='unused@test'), workspace_id=workspace_id)


def _sequence_in_workspace(session: Session, workspace_id: int, name: str) -> Sequence:
    """Load a sequence by workspace id and record name (fixture / strategy lookups)."""
    row = session.scalar(select(Sequence).where(Sequence.workspace_id == workspace_id, Sequence.name == name))
    assert row is not None, f"No Sequence in workspace {workspace_id} with name {name!r}"
    return row


def _primer_in_workspace(session: Session, workspace_id: int, name: str) -> Primer:
    """Load a primer by workspace id and record name (fixture / strategy lookups)."""
    row = session.scalar(select(Primer).where(Primer.workspace_id == workspace_id, Primer.name == name))
    assert row is not None, f"No Primer in workspace {workspace_id} with name {name!r}"
    return row


readonly_db = pytest.mark.readonly_db


def _seed_sequences_context(engine, config):
    """Build the shared seed payload for sequence route tests."""
    with Session(engine) as session:
        ctx = seed_standard_users(session)
        w1, w2 = ctx['w1'], ctx['w2']

        w1_ctx = _write_ctx(w1, ctx['owner_w1_id'])
        w2_ctx = _write_ctx(w2, ctx['owner_w2_id'])

        seq_w1 = dseqrecord_to_db(Dseqrecord('atgcag', name='seq-w1'), session, ctx=w1_ctx)
        seq_w2 = dseqrecord_to_db(Dseqrecord('atgcagc', name='seq-w2'), session, ctx=w2_ctx)

        sample_w1 = SequenceSample(
            uid='UID-W1',
            sequence_id=seq_w1.id,
            uid_workspace_id=w1,
        )
        session.add(sample_w1)

        cloning_strategy_to_db(cs_pcr, session, ctx=w1_ctx)
        cloning_strategy_to_db(cs_gateway_BP, session, ctx=w1_ctx)
        session.flush()

        pcr_template = _sequence_in_workspace(session, w1, 'template')
        pcr_product = _sequence_in_workspace(session, w1, 'pcr_product')
        primer1 = _primer_in_workspace(session, w1, 'primer1')
        primer2 = _primer_in_workspace(session, w1, 'primer2')
        gw_product = _sequence_in_workspace(session, w1, 'product_gateway_BP')
        attb = _sequence_in_workspace(session, w1, 'attB_input')
        attp = _sequence_in_workspace(session, w1, 'attP_input')

        tag = Tag(name='seq-filter-tag', workspace_id=w1)
        tag_w2 = Tag(name='seq-filter-tag-w2', workspace_id=w2)
        session.add_all([tag, tag_w2])
        session.flush()
        pcr_product.tags.append(tag)

        line = Line.from_create(uid='line-for-seq-filter', ctx=w1_ctx)
        session.add(line)
        session.flush()
        session.add(SequenceInLine(sequence_id=pcr_template.id, line_id=line.id))

        session.add(
            SequenceSample(
                uid='FILTER-UID-99',
                sequence_id=pcr_product.id,
                uid_workspace_id=w1,
            )
        )

        dseqr = Dseqrecord('atgcgatcgatac', circular=True, name='circ_plasmid')
        dseqr.add_feature(0, 4, type_='CDS')
        seq_circ = dseqrecord_to_db(dseqr, session, ctx=w1_ctx)
        bulk_tag = Tag(name='seq-bulk-tag', workspace_id=w1)
        session.add(bulk_tag)
        session.flush()
        seq_circ.tags.append(bulk_tag)
        seq_patch_linear = dseqrecord_to_db(Dseqrecord('atgcag', name='patch-linear-target'), session, ctx=w1_ctx)

        seq_with_overhangs = dseqrecord_to_db(
            Dseqrecord(Dseq.from_full_sequence_and_overhangs('atgcag', 1, 1), name='with-overhangs'),
            session,
            ctx=w1_ctx,
        )

        dseqr = Dseqrecord('ACGT', circular=True, name='with-origin-spanning-feature')
        dseqr.add_feature(0, 4, type_='CDS')
        dseqr = dseqr.shifted(2)
        dseqr.id = '0'
        seq_with_origin_spanning_feature = dseqrecord_to_db(dseqr, session, ctx=w1_ctx)

        dseqr_rc = dseqr.reverse_complement()
        dseqr_rc.source = None
        seq_with_origin_spanning_feature_rc = dseqrecord_to_db(dseqr_rc, session, ctx=w1_ctx)

        seq_with_sequencing_file = dseqrecord_to_db(
            Dseqrecord('AAAAAA', name='seq_with_sequencing_file'), session, ctx=w1_ctx
        )
        session.add(seq_with_sequencing_file)
        session.flush()
        sequencing_file = create_sequencing_file(seq_with_sequencing_file, b'hello_world', 'hello_world.txt')
        session.add(sequencing_file)

        template_sequence = TemplateSequence.from_create(
            name='template_sequence', sequence_type=SequenceType.plasmid, ctx=w1_ctx
        )
        template_sequence.tags.append(bulk_tag)
        session.add(template_sequence)
        session.flush()
        template_sequence_id = template_sequence.id

        session.commit()

        w1_ids = set(session.scalars(select(BaseSequence.id).where(BaseSequence.workspace_id == w1)).all())
        w2_ids = set(session.scalars(select(BaseSequence.id).where(BaseSequence.workspace_id == w2)).all())

        ctx.update(
            {
                'engine': engine,
                'config': config,
                'seq_w1_id': seq_w1.id,
                'seq_w2_id': seq_w2.id,
                'uid_w1': sample_w1.uid,
                'w1_sequence_ids': w1_ids,
                'w2_sequence_ids': w2_ids,
                'pcr_template_id': pcr_template.id,
                'pcr_product_id': pcr_product.id,
                'pcr_product_seguid': pcr_product.seguid,
                'primer1_id': primer1.id,
                'primer2_id': primer2.id,
                'gateway_product_id': gw_product.id,
                'attb_input_id': attb.id,
                'attp_input_id': attp.id,
                'filter_tag_id': tag.id,
                'filter_tag_w2_id': tag_w2.id,
                'bulk_tag_id': bulk_tag.id,
                'seq_circ_id': seq_circ.id,
                'seq_patch_linear_id': seq_patch_linear.id,
                'seq_with_overhangs_id': seq_with_overhangs.id,
                'seq_with_origin_spanning_feature_id': seq_with_origin_spanning_feature.id,
                'seq_with_origin_spanning_feature_rc_id': seq_with_origin_spanning_feature_rc.id,
                'seq_with_sequencing_file_id': seq_with_sequencing_file.id,
                'sequencing_file_id': sequencing_file.id,
                'template_sequence_id': template_sequence_id,
            }
        )
    return ctx


@pytest.fixture
def sequences_client(request):
    """Seed read-only or write DB based on ``readonly_db`` marker."""
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_sequences_client_readonly')

    engine, client, config = request.getfixturevalue('engine_client_config_write')
    return attach_standard_tokens(_seed_sequences_context(engine, config), client)


@pytest.fixture(scope='module')
def _sequences_client_readonly(engine_client_config_readonly):
    """Shared seeded client for readonly_db-marked tests."""
    engine, client, config = engine_client_config_readonly
    return attach_standard_tokens(_seed_sequences_context(engine, config), client)


@readonly_db
def test_get_sequences_requires_workspace_id(sequences_client):
    """GET /sequences without X-Workspace-Id fails validation (422)."""
    assert_get_missing_workspace_header_422(
        sequences_client['client'],
        '/sequences',
        sequences_client['token_owner_w1'],
    )


@readonly_db
def test_get_sequences_scoped_to_workspace(sequences_client):
    """Pagination list includes all sequences in the selected workspace."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    response = c.get('/sequences', headers=workspace_headers(tok, sequences_client['w1']))
    assert response.status_code == 200
    items = response.json()['items']
    ids = [item['id'] for item in items]
    assert set(ids) == sequences_client['w1_sequence_ids']
    assert ids == sorted(ids, reverse=True)


@readonly_db
def test_get_sequences_filter_by_tag(sequences_client):
    c = sequences_client['client']
    tid = sequences_client['filter_tag_id']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('tags', str(tid))],
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert ids == {sequences_client['pcr_product_id']}


@readonly_db
def test_get_sequences_filter_instantiated_true(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params={'instantiated': 'true'},
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert {
        sequences_client['pcr_template_id'],
        sequences_client['seq_w1_id'],
        sequences_client['pcr_product_id'],
    } == ids


@readonly_db
def test_get_sequences_filter_instantiated_false(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params={'instantiated': 'false'},
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert sequences_client['attp_input_id'] in ids
    assert sequences_client['pcr_template_id'] not in ids
    assert sequences_client['seq_w1_id'] not in ids


@readonly_db
def test_get_sequences_filter_sequence_types(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('sequence_types', 'pcr_product')],
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert {sequences_client['pcr_product_id']} == ids


@readonly_db
def test_get_sequences_filter_name(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params={'name': 'seq-w'},
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert ids == {sequences_client['seq_w1_id']}


@readonly_db
def test_get_sequences_filter_uid_substring(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params={'uid': 'filter-UID'},
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert ids == {sequences_client['pcr_product_id']}


@readonly_db
def test_get_sequences_filter_has_uid(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params={'has_uid': 'true'},
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()['items']}
    assert {sequences_client['seq_w1_id'], sequences_client['pcr_product_id']} == ids


@readonly_db
def test_get_sequences_forbidden_non_member(sequences_client):
    """Non-member cannot list sequences when passing another workspace id."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w2']
    response = c.get('/sequences', headers=workspace_headers(tok, sequences_client['w1']))
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_sequence_owner_ok(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['pcr_product_id']
    r = c.get(
        f"/sequences/{sid}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    body = r.json()
    assert body['id'] == sid
    assert body['name'] == 'pcr_product'


@readonly_db
def test_get_sequence_forbidden_cross_workspace(sequences_client):
    """User not in W1 cannot GET a W1 sequence even with W1 header."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w2']
    response = c.get(
        f"/sequences/{sequences_client['seq_w1_id']}", headers=workspace_headers(tok, sequences_client['w1'])
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_sequence_workspace_mismatch_404(sequences_client):
    """W2 sequence with W1 header returns 404."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_both']
    response = c.get(
        f"/sequences/{sequences_client['seq_w2_id']}", headers=workspace_headers(tok, sequences_client['w1'])
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'BaseSequence not found'


def test_patch_template_sequence_integrity_error_returns_409(sequences_client, monkeypatch):
    """IntegrityError during PATCH commit (race after name check) returns 409 for templates."""
    from sqlalchemy.exc import IntegrityError

    c = sequences_client['client']
    headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    sid = sequences_client['template_sequence_id']

    original_commit = Session.commit
    call_count = [0]

    def commit_raising_once(self):
        call_count[0] += 1
        if call_count[0] == 1:
            raise IntegrityError('mock', {}, Exception())
        return original_commit(self)

    monkeypatch.setattr(Session, 'commit', commit_raising_once)

    response = c.patch(
        f'/sequences/{sid}',
        headers=headers,
        json={'name': 'race-rename'},
    )
    assert response.status_code == 409
    assert response.json()['detail'] == "Template sequence 'race-rename' already exists in this workspace"


def test_patch_sequence_owner_rename_ok(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    r = c.patch(
        f"/sequences/{sid}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json={'name': 'renamed-linear'},
    )
    assert r.status_code == 200
    assert r.json()['name'] == 'renamed-linear'


@readonly_db
def test_patch_sequence_empty_name_422(sequences_client):
    c = sequences_client['client']
    r = c.patch(
        f"/sequences/{sequences_client['seq_patch_linear_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json={'name': ''},
    )
    assert r.status_code == 422


def test_patch_sequence_type_linear_ok(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    r = c.patch(
        f"/sequences/{sid}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json={'sequence_type': 'pcr_product'},
    )
    assert r.status_code == 200
    assert r.json()['sequence_type'] == 'pcr_product'


@readonly_db
def test_patch_sequence_circular_rejects_non_plasmid_type(sequences_client):
    c = sequences_client['client']
    r = c.patch(
        f"/sequences/{sequences_client['seq_circ_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json={'sequence_type': 'allele'},
    )
    assert r.status_code == 400
    assert r.json()['detail'] == "Circular sequences can only have sequence_type 'plasmid'"


@readonly_db
def test_patch_sequence_type_rejects_sequence_in_line(sequences_client):
    """Cannot change sequence_type when the sequence is linked to a line."""
    c = sequences_client['client']
    r = c.patch(
        f"/sequences/{sequences_client['pcr_template_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json={'sequence_type': 'allele'},
    )
    assert r.status_code == 400
    assert r.json()['detail'] == 'Cannot change sequence_type: sequence is present in a line.'


@readonly_db
def test_patch_sequence_viewer_forbidden(sequences_client):
    """Viewer cannot PATCH a sequence."""
    c = sequences_client['client']
    tok = sequences_client['token_viewer_w1']
    response = c.patch(
        f"/sequences/{sequences_client['seq_w1_id']}",
        headers=workspace_headers(tok, sequences_client['w1']),
        json={'name': 'new-name'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_delete_sequence_owner_removes_sample_and_files(sequences_client):
    """Owner can delete an isolated sequence; sample row and uploaded file rows are removed."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    sid = sequences_client['seq_w1_id']
    headers = workspace_headers(tok, wid)

    sequencing_file_ids = []
    for file_name, payload in [('attached-1.ab1', b'ABIF-1'), ('attached-2.ab1', b'ABIF-2')]:
        up = post_sequencing_file_upload(c, sid, tok, wid, file_name, payload)
        assert up.status_code == 200
        sequencing_file_ids.append(up.json()[0]['id'])

    r = c.delete(f"/sequences/{sid}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {'deleted': sid, 'data': None}

    assert c.get(f"/sequences/{sid}", headers=headers).status_code == 404
    assert c.get(f"/sequences/by-uid/{sequences_client['uid_w1']}", headers=headers).status_code == 404
    with Session(sequences_client['engine']) as session:
        assert session.scalar(select(SequenceSample).where(SequenceSample.sequence_id == sid)) is None
        for sequencing_file_id in sequencing_file_ids:
            assert session.get(SequencingFile, sequencing_file_id) is None


def test_delete_template_sequence_owner_ok(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['template_sequence_id']
    r = c.delete(
        f"/sequences/{sid}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert r.json()['deleted'] == sid
    assert (
        c.get(
            f"/sequences/{sid}", headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
        ).status_code
        == 404
    )


@readonly_db
def test_delete_sequence_rejects_when_has_children(sequences_client):
    """Sequences used as input to another source cannot be deleted (409)."""
    c = sequences_client['client']
    r = c.delete(
        f"/sequences/{sequences_client['pcr_template_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 409
    assert 'child sequences' in r.json()['detail']


def test_delete_sequence_allows_when_has_parents(sequences_client):
    """Sequences produced by a source with inputs can still be deleted."""
    c = sequences_client['client']
    sid = sequences_client['pcr_product_id']
    r = c.delete(
        f"/sequences/{sid}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert r.json()['deleted'] == sequences_client['pcr_product_id']

    r = c.get(
        f"/sequences/{sid}", headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    )
    assert r.status_code == 404

    # Primers and template still exist though
    r = c.get(
        f"/primers/{sequences_client['primer1_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    r = c.get(
        f"/primers/{sequences_client['primer2_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    r = c.get(
        f"/sequences/{sequences_client['pcr_template_id']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200


def test_delete_sequence_session_delete_rejects_when_has_children(sequences_client):
    sid = sequences_client['pcr_template_id']

    with Session(sequences_client['engine']) as session:
        db_sequence = session.get(Sequence, sid)
        assert db_sequence is not None

        session.delete(db_sequence)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    with Session(sequences_client['engine']) as session:
        assert session.get(Sequence, sid) is not None


def test_delete_sequence_session_delete_allows_when_has_parents(sequences_client):
    sid = sequences_client['pcr_product_id']

    with Session(sequences_client['engine']) as session:
        db_sequence = session.get(Sequence, sid)
        assert db_sequence is not None

        session.delete(db_sequence)
        session.commit()

    with Session(sequences_client['engine']) as session:
        assert session.get(Sequence, sid) is None
        assert session.get(Sequence, sequences_client['pcr_template_id']) is not None


def test_delete_sequence_rejects_when_in_strain(sequences_client):
    """Sequences linked to a strain via SequenceInLine cannot be deleted (409)."""
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    with Session(sequences_client['engine']) as session:
        line = Line.from_create(
            uid='line-blocking-delete',
            ctx=_write_ctx(sequences_client['w1'], sequences_client['owner_w1_id']),
        )
        session.add(line)
        session.flush()
        session.add(SequenceInLine(sequence_id=sid, line_id=line.id))
        session.commit()

    r = c.delete(
        f"/sequences/{sid}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 409
    assert 'present in a line' in r.json()['detail']


def test_delete_sequence_viewer_forbidden(sequences_client):
    """Viewers cannot delete sequences."""
    c = sequences_client['client']
    r = c.delete(
        f"/sequences/{sequences_client['seq_patch_linear_id']}",
        headers=workspace_headers(sequences_client['token_viewer_w1'], sequences_client['w1']),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


def test_delete_sequence_workspace_mismatch_404(sequences_client):
    """W2 sequence id with W1 header returns 404."""
    c = sequences_client['client']
    r = c.delete(
        f"/sequences/{sequences_client['seq_w2_id']}",
        headers=workspace_headers(sequences_client['token_owner_both'], sequences_client['w1']),
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'BaseSequence not found'


def _parse_dseqr(payload: dict) -> Dseqrecord:
    return read_dsrecord_from_json(TextFileSequence.model_validate(payload))


def test_change_circularity_isolated_linear_to_circular(sequences_client):
    """Isolated linear sequence toggles to circular and updates stored GenBank content."""
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])

    with Session(sequences_client['engine']) as session:
        seq = session.get(Sequence, sid)
        old_file_content = seq.file_content

    r0 = c.get(f'/sequences/{sid}/text_file_sequence', headers=headers)
    assert r0.status_code == 200
    assert _parse_dseqr(r0.json()).seq == Dseq('atgcag'.upper())

    r = c.patch(f'/sequences/{sid}/change_circularity', headers=headers)
    assert r.status_code == 200
    assert r.json()['id'] == sid

    r1 = c.get(f'/sequences/{sid}/text_file_sequence', headers=headers)
    assert r1.status_code == 200
    assert _parse_dseqr(r1.json()).seq == Dseq('atgcag'.upper(), circular=True)

    r1_db = c.get(f'/sequences/{sid}', headers=headers)
    assert r1_db.status_code == 200
    assert r1_db.json()['sequence_type'] == 'plasmid'

    with Session(sequences_client['engine']) as session:
        seq = session.get(Sequence, sid)
        assert seq.file_content != old_file_content


def test_change_circularity_isolated_circular_to_linear(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_circ_id']
    headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])

    with Session(sequences_client['engine']) as session:
        old_file_content = session.get(Sequence, sid).file_content

    r0 = c.get(f'/sequences/{sid}/text_file_sequence', headers=headers)
    assert _parse_dseqr(r0.json()).seq == Dseq('atgcgatcgatac'.upper(), circular=True)

    r = c.patch(f'/sequences/{sid}/change_circularity', headers=headers)
    assert r.status_code == 200

    r1 = c.get(f'/sequences/{sid}/text_file_sequence', headers=headers)
    assert _parse_dseqr(r1.json()).seq == Dseq('atgcgatcgatac'.upper())

    r1_db = c.get(f'/sequences/{sid}', headers=headers)
    assert r1_db.status_code == 200
    assert r1_db.json()['sequence_type'] == 'linear_dna'

    with Session(sequences_client['engine']) as session:
        seq = session.get(Sequence, sid)
        assert seq.file_content != old_file_content


@readonly_db
def test_change_circularity_rejects_when_sequence_has_children(sequences_client):
    c = sequences_client['client']
    tid = sequences_client['pcr_template_id']
    r = c.patch(
        f'/sequences/{tid}/change_circularity',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 400
    assert 'child sequences' in r.json()['detail']


@readonly_db
def test_change_circularity_rejects_when_sequence_has_parents(sequences_client):
    c = sequences_client['client']
    pid = sequences_client['pcr_product_id']
    r = c.patch(
        f'/sequences/{pid}/change_circularity',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 400
    assert 'parent sequences' in r.json()['detail']


@readonly_db
def test_change_circularity_rejects_when_sequence_has_overhangs(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_with_overhangs_id']
    r = c.patch(
        f'/sequences/{sid}/change_circularity',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 400
    assert 'overhangs' in r.json()['detail']


@pytest.mark.parametrize(
    'sid',
    [
        'seq_with_origin_spanning_feature_id',
        'seq_with_origin_spanning_feature_rc_id',
    ],
)
@readonly_db
def test_change_circularity_rejects_when_sequence_has_features_spanning_origin(sequences_client, sid):
    c = sequences_client['client']
    sid = sequences_client[sid]
    r = c.patch(
        f'/sequences/{sid}/change_circularity',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 400
    assert 'features spanning the origin' in r.json()['detail']


@readonly_db
def test_change_circularity_viewer_forbidden(sequences_client):
    c = sequences_client['client']
    tok = sequences_client['token_viewer_w1']
    r = c.patch(
        f"/sequences/{sequences_client['seq_w1_id']}/change_circularity",
        headers=workspace_headers(tok, sequences_client['w1']),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_change_circularity_workspace_mismatch_404(sequences_client):
    c = sequences_client['client']
    r = c.patch(
        f"/sequences/{sequences_client['seq_w2_id']}/change_circularity",
        headers=workspace_headers(
            sequences_client['token_owner_both'],
            sequences_client['w1'],
        ),
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'BaseSequence not found'


@readonly_db
def test_change_circularity_unauthenticated_401(sequences_client):
    c = sequences_client['client']
    assert_patch_unauthenticated_401(
        c,
        f"/sequences/{sequences_client['seq_w1_id']}/change_circularity",
        sequences_client['w1'],
        json={},
    )


existing_sequence_annotated = Dseqrecord('aTgCag')
existing_sequence_annotated.add_feature(0, 4, type_='CDS')
existing_sequence_annotated = TextFileSequence.from_dseqrecord(existing_sequence_annotated).model_dump(mode='json')


def test_change_annotation_success_replaces_file(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    token = sequences_client['token_owner_w1']
    workspace_id = sequences_client['w1']
    headers = workspace_headers(token, workspace_id)

    with Session(sequences_client['engine']) as session:
        seq = session.get(Sequence, sid)
        old_file_content = seq.file_content

    r = c.patch(f'/sequences/{sid}/change_annotation', headers=headers, json=existing_sequence_annotated)
    assert r.status_code == 200

    r1 = c.get(f'/sequences/{sid}/text_file_sequence', headers=headers)
    assert r1.status_code == 200
    assert len(_parse_dseqr(r1.json()).features) == 1

    with Session(sequences_client['engine']) as session:
        seq = session.get(Sequence, sid)
        assert seq.file_content != old_file_content


@readonly_db
def test_change_annotation_rejects_when_dseq_differs(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    payload = TextFileSequence.from_dseqrecord(Dseqrecord('TTTTTT', name='different')).model_dump(mode='json')
    r = c.patch(
        f'/sequences/{sid}/change_annotation',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        json=payload,
    )
    assert r.status_code == 400
    assert 'does not match the existing sequence' in r.json()['detail']


@readonly_db
def test_change_annotation_viewer_forbidden(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    r = c.patch(
        f'/sequences/{sid}/change_annotation',
        headers=workspace_headers(sequences_client['token_viewer_w1'], sequences_client['w1']),
        json=existing_sequence_annotated,
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_change_annotation_workspace_mismatch_404(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_w2_id']
    r = c.patch(
        f'/sequences/{sid}/change_annotation',
        headers=workspace_headers(sequences_client['token_owner_both'], sequences_client['w1']),
        json=existing_sequence_annotated,
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'BaseSequence not found'


@readonly_db
def test_change_annotation_unauthenticated_401(sequences_client):
    c = sequences_client['client']
    sid = sequences_client['seq_patch_linear_id']
    assert_patch_unauthenticated_401(
        c,
        f'/sequences/{sid}/change_annotation',
        sequences_client['w1'],
        json=existing_sequence_annotated,
    )


@readonly_db
def test_get_sequence_by_uid_scoped_to_workspace(sequences_client):
    """Resolve sequence by lab sample UID within the selected workspace (case-insensitive lookup)."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    response = c.get(
        f"/sequences/by-uid/{sequences_client['uid_w1'].swapcase()}",
        headers=workspace_headers(tok, sequences_client['w1']),
    )
    assert response.status_code == 200
    assert response.json()['id'] == sequences_client['seq_w1_id']


@readonly_db
def test_get_sequence_by_uid_not_found_404(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences/by-uid/no-such-uid-xyz',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'Sequence not found for UID'


@readonly_db
def test_get_sequence_by_uid_forbidden_non_member(sequences_client):
    """Non-member cannot use by-uid with another workspace header."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w2']
    response = c.get(
        f"/sequences/by-uid/{sequences_client['uid_w1']}", headers=workspace_headers(tok, sequences_client['w1'])
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_sequences_by_seguid_known(sequences_client):
    c = sequences_client['client']
    r = c.get(
        f"/sequences/by-seguid/{sequences_client['pcr_product_seguid']}",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    ids = {item['id'] for item in r.json()}
    assert sequences_client['pcr_product_id'] in ids


@readonly_db
def test_get_sequences_by_seguid_unknown_empty(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences/by-seguid/zzzznonexistentseguiddummy',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert r.json() == []


def _post_validate_upload_sequences(client, token: str, workspace_id: int, files: list[tuple[str, bytes]]):
    return client.post(
        '/sequences/validate-upload',
        headers=workspace_headers(token, workspace_id),
        files=[('files', (filename, body, 'application/octet-stream')) for filename, body in files],
    )


def _post_sequences_bulk(
    client,
    token: str,
    workspace_id: int,
    files: list[tuple[str, bytes]],
    strict: bool = True,
    tags: list[int] | None = None,
):
    params: list[tuple[str, str]] = [('strict', str(strict).lower())]
    if tags:
        params.extend(('tags', str(tag_id)) for tag_id in tags)
    return client.post(
        '/sequences/bulk',
        headers=workspace_headers(token, workspace_id),
        params=params,
        files=[('files', (filename, body, 'application/octet-stream')) for filename, body in files],
    )


@readonly_db
def test_validate_upload_sequences_returns_flags(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']

    dup = Dseqrecord('ATGCATGC', name='dup_name')
    linear_same_as_existing_circular = Dseqrecord('atgcgatcgatac', name='lin_to_existing_circular')
    invalid_content = b'not a valid sequence format'
    files = [
        ('dup1.gb', dup.format('genbank').encode('utf-8')),
        ('dup2.gb', dup.format('genbank').encode('utf-8')),
        ('linear.gb', linear_same_as_existing_circular.format('genbank').encode('utf-8')),
        ('bad.gb', invalid_content),
        ('circularize.dna', (TEST_FOLDER / 'circularize.dna').read_bytes()),
    ]

    r = _post_validate_upload_sequences(c, h_token, wid, files)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 5

    assert rows[0]['file_name'] == 'dup1.gb'
    assert rows[0]['reading_error'] is False
    assert rows[0]['name'] == 'dup_name'
    assert rows[0]['length'] == len(dup)
    assert rows[0]['circular'] is False
    assert rows[0]['sequence_exists'] is False
    assert rows[0]['name_exists'] is False
    assert rows[0]['duplicated_name'] is True
    assert rows[0]['duplicated_seguid'] is True
    assert rows[0]['sequence_circularised_exists'] is False
    assert rows[0]['circularised_seguid'] == dup.looped().seq.seguid()

    assert rows[1]['duplicated_name'] is True
    assert rows[1]['duplicated_seguid'] is True
    assert rows[1]['circularised_seguid'] == dup.looped().seq.seguid()

    assert rows[2]['file_name'] == 'linear.gb'
    assert rows[2]['reading_error'] is False
    assert rows[2]['circular'] is False
    assert rows[2]['sequence_exists'] is False
    assert rows[2]['sequence_circularised_exists'] is True
    assert rows[2]['circularised_seguid'] is not None
    assert rows[2]['duplicated_name'] is False
    assert rows[2]['duplicated_seguid'] is False

    assert rows[3]['file_name'] == 'bad.gb'
    assert rows[3]['reading_error'] is True
    assert rows[3]['name'] is None
    assert rows[3]['length'] is None
    assert rows[3]['circular'] is None
    assert rows[3]['seguid'] is None
    assert rows[3]['circularised_seguid'] is None
    assert rows[3]['sequence_exists'] is None
    assert rows[3]['sequence_circularised_exists'] is None
    assert rows[3]['name_exists'] is None
    assert rows[3]['duplicated_seguid'] is None
    assert rows[3]['duplicated_name'] is None

    assert rows[4]['file_name'] == 'circularize.dna'
    assert rows[4]['name'] == 'circularize'
    assert rows[4]['reading_error'] is False


@readonly_db
def test_validate_upload_sequences_limit_500(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    rec = Dseqrecord('ATGCATGC', name='bulk')
    body = rec.format('genbank').encode('utf-8')
    files = [(f'seq_{i}.gb', body) for i in range(501)]
    r = _post_validate_upload_sequences(c, h_token, wid, files)
    assert r.status_code == 400
    assert 'maximum of 500' in r.json()['detail']


@readonly_db
@pytest.mark.parametrize('endpoint', ['/sequences/validate-upload', '/sequences/bulk'])
def test_upload_sequences_over_limit_rejected_before_reading(sequences_client, monkeypatch, endpoint):
    monkeypatch.setattr(sequences_router, 'MAX_BULK_SEQUENCES', 1)

    def fail_read(*args, **kwargs):
        raise AssertionError('Files should not be read when over the limit')

    monkeypatch.setattr(sequences_router, 'read_upload_with_limit', fail_read)
    body = Dseqrecord('ATGCATGC', name='bulk').format('genbank').encode('utf-8')
    r = sequences_client['client'].post(
        endpoint,
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        files=[('files', (f'seq_{i}.gb', body, 'application/octet-stream')) for i in range(2)],
    )
    assert r.status_code == 400, r.text
    assert 'maximum of 1' in r.json()['detail']


@readonly_db
def test_validate_upload_sequences_viewer_ok(sequences_client):
    c = sequences_client['client']
    rec = Dseqrecord('ATGCATGC', name='viewer_file')
    r = _post_validate_upload_sequences(
        c,
        sequences_client['token_viewer_w1'],
        sequences_client['w1'],
        [('viewer.gb', rec.format('genbank').encode('utf-8'))],
    )
    assert r.status_code == 200
    assert len(r.json()) == 1


@readonly_db
def test_validate_upload_sequences_non_member_forbidden(sequences_client):
    c = sequences_client['client']
    rec = Dseqrecord('ATGCATGC', name='forbidden_file')
    r = _post_validate_upload_sequences(
        c,
        sequences_client['token_owner_w2'],
        sequences_client['w1'],
        [('forbidden.gb', rec.format('genbank').encode('utf-8'))],
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_validate_upload_sequences_missing_workspace_header_422(sequences_client):
    c = sequences_client['client']
    rec = Dseqrecord('ATGCATGC', name='missing_header')
    r = c.post(
        '/sequences/validate-upload',
        headers=bearer_headers(sequences_client['token_owner_w1']),
        files={'files': ('missing.gb', rec.format('genbank').encode('utf-8'), 'application/octet-stream')},
    )
    assert r.status_code == 422


def test_post_sequences_bulk_success_strict_true(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        ('bulk_ok_1.gb', Dseqrecord('ATGCATGCAAA', name='bulk_ok_1').format('genbank').encode('utf-8')),
        ('bulk_ok_2.gb', Dseqrecord('GGGATGCATTT', name='bulk_ok_2').format('genbank').encode('utf-8')),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=True)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['id'] > 0
    assert rows[1]['id'] > 0
    assert rows[0]['name'] == 'bulk_ok_1'
    assert rows[1]['name'] == 'bulk_ok_2'

    list_r = c.get('/sequences', headers=workspace_headers(h_token, wid), params={'name': 'bulk_ok'})
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 2


def test_post_sequences_bulk_applies_tags(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    tag_id = sequences_client['filter_tag_id']
    payload = [
        ('bulk_tg1.gb', Dseqrecord('ATGCATGCAAA', name='bulk_tg1').format('genbank').encode('utf-8')),
        ('bulk_tg2.gb', Dseqrecord('GGGATGCATTT', name='bulk_tg2').format('genbank').encode('utf-8')),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=True, tags=[tag_id])
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 2
    headers = workspace_headers(h_token, wid)
    for row in rows:
        assert {t['id'] for t in row['tags']} == {tag_id}
        tags_r = c.get(f"/input_entities/{row['id']}/tags", headers=headers)
        assert tags_r.status_code == 200
        assert {t['id'] for t in tags_r.json()} == {tag_id}


def test_post_sequences_bulk_unknown_tag_404(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        ('bulk_notag.gb', Dseqrecord('ATGCATGCNNN', name='bulk_notag').format('genbank').encode('utf-8')),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=True, tags=[999999])
    assert r.status_code == 404
    assert r.json()['detail'] == 'Tag not found'

    list_r = c.get('/sequences', headers=workspace_headers(h_token, wid), params={'name': 'bulk_notag'})
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 0


def test_post_sequences_bulk_cross_workspace_tag_403(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        (
            'bulk_wrtag.gb',
            Dseqrecord('ATGCATGCWWW', name='bulk_wrtag').format('genbank').encode('utf-8'),
        ),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=True, tags=[sequences_client['filter_tag_w2_id']])
    assert r.status_code == 403

    list_r = c.get('/sequences', headers=workspace_headers(h_token, wid), params={'name': 'bulk_wrtag'})
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 0


def test_post_sequences_bulk_strict_true_conflict_on_warning_and_is_atomic(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        ('dup_a.gb', Dseqrecord('ATGCATGC', name='dup_name').format('genbank').encode('utf-8')),
        ('dup_b.gb', Dseqrecord('ATGCATGC', name='dup_name').format('genbank').encode('utf-8')),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=True)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['duplicated_name'] is True
    assert rows[0]['duplicated_seguid'] is True
    assert rows[1]['duplicated_name'] is True
    assert rows[1]['duplicated_seguid'] is True

    list_r = c.get('/sequences', headers=workspace_headers(h_token, wid), params={'name': 'dup_name'})
    assert list_r.status_code == 200
    assert len([item for item in list_r.json()['items'] if item['name'] == 'dup_name']) == 0


def test_post_sequences_bulk_non_strict_allows_warnings(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        ('dup_a.gb', Dseqrecord('ATGCATGC', name='dup_non_strict').format('genbank').encode('utf-8')),
        ('dup_b.gb', Dseqrecord('ATGCATGC', name='dup_non_strict').format('genbank').encode('utf-8')),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=False)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['name'] == 'dup_non_strict'
    assert rows[1]['name'] == 'dup_non_strict'


def test_post_sequences_bulk_non_strict_still_rejects_reading_errors_and_is_atomic(sequences_client):
    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        ('ok.gb', Dseqrecord('ATGCATGCGG', name='ok_should_not_persist').format('genbank').encode('utf-8')),
        ('bad.gb', b'not a parseable sequence file'),
    ]
    r = _post_sequences_bulk(c, h_token, wid, payload, strict=False)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['reading_error'] is False
    assert rows[1]['reading_error'] is True

    list_r = c.get('/sequences', headers=workspace_headers(h_token, wid), params={'name': 'ok_should_not_persist'})
    assert list_r.status_code == 200
    assert len([item for item in list_r.json()['items'] if item['name'] == 'ok_should_not_persist']) == 0


@readonly_db
def test_post_sequences_bulk_viewer_forbidden(sequences_client):
    c = sequences_client['client']
    r = _post_sequences_bulk(
        c,
        sequences_client['token_viewer_w1'],
        sequences_client['w1'],
        [('viewer_forbidden.gb', Dseqrecord('ATGCATGC', name='viewer_forbidden').format('genbank').encode('utf-8'))],
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_post_sequences_bulk_non_member_forbidden(sequences_client):
    c = sequences_client['client']
    r = _post_sequences_bulk(
        c,
        sequences_client['token_owner_w2'],
        sequences_client['w1'],
        [('non_member_forbidden.gb', Dseqrecord('ATGCATGC', name='non_member').format('genbank').encode('utf-8'))],
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_post_sequences_bulk_missing_workspace_header_422(sequences_client):
    c = sequences_client['client']
    rec = Dseqrecord('ATGCATGC', name='missing_ws')
    r = c.post(
        '/sequences/bulk',
        headers=bearer_headers(sequences_client['token_owner_w1']),
        files={'files': ('missing_ws.gb', rec.format('genbank').encode('utf-8'), 'application/octet-stream')},
    )
    assert r.status_code == 422


@readonly_db
def test_get_text_file_sequence_ok(sequences_client):
    c = sequences_client['client']
    r = c.get(
        f"/sequences/{sequences_client['pcr_product_id']}/text_file_sequence",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert 'LOCUS' in r.json()['file_content']


@readonly_db
def test_get_text_file_sequences_by_ids(sequences_client):
    c = sequences_client['client']
    ids = [sequences_client['seq_circ_id'], sequences_client['pcr_product_id']]
    r = c.get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('ids', str(i)) for i in ids],
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert [item['sequence_ref']['id'] for item in data] == sorted(ids)
    for item in data:
        assert item['sequence']['type'] == 'TextFileSequence'
        assert 'LOCUS' in item['sequence']['file_content']
    pcr_item = next(item for item in data if item['sequence_ref']['id'] == sequences_client['pcr_product_id'])
    assert pcr_item['sequence_ref']['tags'] == [{'id': sequences_client['filter_tag_id'], 'name': 'seq-filter-tag'}]
    assert pcr_item['sequence_ref']['sample_uids'] == ['FILTER-UID-99']


@readonly_db
def test_get_text_file_sequences_by_tag(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('tags', str(sequences_client['filter_tag_id']))],
    )
    assert r.status_code == 200, r.text
    assert [item['sequence_ref']['id'] for item in r.json()] == [sequences_client['pcr_product_id']]

    # Tag from another workspace matches nothing
    r = c.get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('tags', str(sequences_client['filter_tag_w2_id']))],
    )
    assert r.status_code == 200, r.text
    assert r.json() == []


@readonly_db
def test_get_text_file_sequences_by_several_tags(sequences_client):
    """Sequences with any of the tags are returned, and template sequences with the tag are left out."""
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('tags', str(sequences_client['filter_tag_id'])), ('tags', str(sequences_client['bulk_tag_id']))],
    )
    assert r.status_code == 200, r.text
    ids = [item['sequence_ref']['id'] for item in r.json()]
    assert ids == sorted([sequences_client['seq_circ_id'], sequences_client['pcr_product_id']])
    assert sequences_client['template_sequence_id'] not in ids


@readonly_db
@pytest.mark.parametrize(
    'sequence_types, expected_keys',
    [
        (['plasmid'], ['seq_circ_id']),
        (['pcr_product'], ['pcr_product_id']),
        (['plasmid', 'pcr_product'], ['seq_circ_id', 'pcr_product_id']),
        (['locus'], []),
    ],
)
def test_get_text_file_sequences_by_tag_and_sequence_type(sequences_client, sequence_types, expected_keys):
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('tags', str(sequences_client['filter_tag_id'])), ('tags', str(sequences_client['bulk_tag_id']))]
        + [('sequence_types', t) for t in sequence_types],
    )
    assert r.status_code == 200, r.text
    assert [item['sequence_ref']['id'] for item in r.json()] == sorted(sequences_client[k] for k in expected_keys)


@readonly_db
def test_get_text_file_sequences_sequence_types_requires_tags(sequences_client):
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('ids', str(sequences_client['seq_circ_id'])), ('sequence_types', 'plasmid')],
    )
    assert r.status_code == 422, r.text


@readonly_db
def test_get_text_file_sequences_invalid_sequence_type_422(sequences_client):
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('tags', str(sequences_client['bulk_tag_id'])), ('sequence_types', 'not_a_type')],
    )
    assert r.status_code == 422, r.text


@readonly_db
def test_get_text_file_sequences_duplicate_ids(sequences_client):
    sid = sequences_client['seq_circ_id']
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('ids', str(sid)), ('ids', str(sid))],
    )
    assert r.status_code == 200, r.text
    assert [item['sequence_ref']['id'] for item in r.json()] == [sid]


@readonly_db
@pytest.mark.parametrize('params', [[], [('ids', '1'), ('tags', '1')]])
def test_get_text_file_sequences_requires_ids_or_tags(sequences_client, params):
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=params,
    )
    assert r.status_code == 422, r.text


@readonly_db
@pytest.mark.parametrize('missing_key', ['seq_w2_id', 'template_sequence_id', None])
def test_get_text_file_sequences_missing_ids_404(sequences_client, missing_key):
    missing_id = sequences_client[missing_key] if missing_key else 999999
    ids = [sequences_client['pcr_product_id'], missing_id]
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('ids', str(i)) for i in ids],
    )
    assert r.status_code == 404, r.text
    assert str(missing_id) in r.json()['detail']


@readonly_db
def test_get_text_file_sequences_over_limit_400(sequences_client, monkeypatch):
    monkeypatch.setattr(sequences_router, 'MAX_BULK_SEQUENCES', 1)
    ids = [sequences_client['seq_circ_id'], sequences_client['pcr_product_id']]
    r = sequences_client['client'].get(
        '/sequences/text_file_sequences',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        params=[('ids', str(i)) for i in ids],
    )
    assert r.status_code == 400, r.text
    assert 'maximum is 1' in r.json()['detail']


@readonly_db
def test_get_text_file_sequences_auth(sequences_client):
    c = sequences_client['client']
    path = f"/sequences/text_file_sequences?ids={sequences_client['seq_circ_id']}"
    assert_get_missing_workspace_header_422(c, path, sequences_client['token_owner_w1'])
    assert_get_invalid_workspace_id_422(c, path, sequences_client['token_owner_w1'])
    assert_get_non_member_workspace_403(c, path, sequences_client['token_owner_w1'], sequences_client['w3'])
    assert_get_unauthenticated_401(c, path, sequences_client['w1'])


@pytest.mark.parametrize(
    'query_sequence, expected_shift, expected_reverse_complemented, result_count',
    [
        (pcr_product, 0, False, 1),
        (pcr_template, 0, False, 1),
        (pcr_product.reverse_complement(), 0, True, 1),
        (pcr_template.reverse_complement(), 0, True, 1),
        (pcr_template.shifted(4), 4, False, 1),
        (pcr_template.shifted(-4), len(pcr_template) - 4, False, 1),
        (pcr_template.shifted(4).reverse_complement(), 4, True, 1),
        (Dseqrecord('A'), None, None, 0),
        (Dseqrecord(Dseq.from_full_sequence_and_overhangs(str(pcr_product.seq), -2, 0)), None, None, 0),
        (Dseqrecord(Dseq.from_full_sequence_and_overhangs(str(pcr_product.seq), 0, 2)), None, None, 0),
    ],
)
@readonly_db
def test_post_sequence_search_finds_linear_and_circular_rotation(
    sequences_client, query_sequence, expected_shift, expected_reverse_complemented, result_count
):
    c = sequences_client['client']
    headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    linear_query = TextFileSequence.from_dseqrecord(query_sequence)
    linear_r = c.post('/sequences/search', headers=headers, json=linear_query.model_dump(mode='json'))
    assert linear_r.status_code == 200
    matches = linear_r.json()
    assert len(matches) == result_count
    if result_count > 0:
        match = matches[0]
        assert match['shift'] == expected_shift
        assert match['reverse_complemented'] == expected_reverse_complemented


@readonly_db
def test_get_cloning_strategy_pcr_product(sequences_client):
    c = sequences_client['client']
    r = c.get(
        f"/sequences/{sequences_client['pcr_product_id']}/cloning_strategy",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data['sequences']) == 2
    assert len(data['sources']) == 2
    assert len(data['primers']) == 2


@readonly_db
def test_get_sequence_children_template_to_product(sequences_client):
    c = sequences_client['client']
    r = c.get(
        f"/sequences/{sequences_client['pcr_template_id']}/children",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    ids = [item['id'] for item in r.json()]
    assert ids == [sequences_client['pcr_product_id']]


@readonly_db
def test_get_sequence_lines_returns_lines_for_sequence(sequences_client):
    c = sequences_client['client']
    headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    r = c.get(f"/sequences/{sequences_client['pcr_template_id']}/lines", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]['uid'] == 'line-for-seq-filter'
    assert {item['sequence']['id'] for item in body[0]['sequences_in_line']} == {sequences_client['pcr_template_id']}


@readonly_db
def test_get_sequence_lines_non_member_forbidden(sequences_client):
    c = sequences_client['client']
    r = c.get(
        f"/sequences/{sequences_client['pcr_template_id']}/lines",
        headers=workspace_headers(sequences_client['token_owner_w2'], sequences_client['w1']),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_get_sequence_lines_workspace_mismatch_404(sequences_client):
    c = sequences_client['client']
    r = c.get(
        f"/sequences/{sequences_client['seq_w2_id']}/lines",
        headers=workspace_headers(sequences_client['token_owner_both'], sequences_client['w1']),
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'BaseSequence not found'


@readonly_db
def test_get_sequence_primers_pcr_template_and_product(sequences_client):
    """Template sequence is PCR input (template-side primers); product sequence lists output-side primers."""
    c = sequences_client['client']
    h = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    t_r = c.get(f"/sequences/{sequences_client['pcr_template_id']}/primers", headers=h)
    assert t_r.status_code == 200
    t_data = t_r.json()
    assert len(t_data['templates']) == 2
    assert t_data['products'] == []

    p_r = c.get(f"/sequences/{sequences_client['pcr_product_id']}/primers", headers=h)
    assert p_r.status_code == 200
    p_data = p_r.json()
    assert len(p_data['products']) == 2
    assert p_data['templates'] == []


def test_post_sequencing_files_owner_ok(sequences_client):
    """Owner can upload sequencing files; GET lists them."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    sid = sequences_client['seq_w1_id']
    up = post_sequencing_file_upload(c, sid, tok, wid, 'run.ab1', b'ABIFDATA')
    assert up.status_code == 200
    data = up.json()
    assert len(data) == 1
    assert data[0]['original_name'] == 'run.ab1'
    assert set(data[0]) == {'id', 'original_name'}

    listed = c.get(
        f"/sequences/{sid}/sequencing_files",
        headers=workspace_headers(tok, wid),
    )
    assert listed.status_code == 200
    listed_body = listed.json()
    assert len(listed_body) == 1
    assert listed_body == data


@readonly_db
def test_post_sequencing_files_viewer_forbidden(sequences_client):
    """Viewer cannot upload sequencing files."""
    c = sequences_client['client']
    r = post_sequencing_file_upload(
        c,
        sequences_client['seq_w1_id'],
        sequences_client['token_viewer_w1'],
        sequences_client['w1'],
        'nope.ab1',
        b'x',
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_post_sequencing_files_non_member_forbidden(sequences_client):
    """Non-member cannot upload to another workspace sequence."""
    c = sequences_client['client']
    r = post_sequencing_file_upload(
        c,
        sequences_client['seq_w1_id'],
        sequences_client['token_owner_w2'],
        sequences_client['w1'],
        'nope.ab1',
        b'x',
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_post_sequencing_files_workspace_mismatch_404(sequences_client):
    """W2 sequence id with W1 header returns 404 on upload."""
    c = sequences_client['client']
    r = post_sequencing_file_upload(
        c,
        sequences_client['seq_w2_id'],
        sequences_client['token_owner_both'],
        sequences_client['w1'],
        'x.ab1',
        b'x',
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'BaseSequence not found'


def test_get_sequence_sequencing_files_viewer_ok(sequences_client):
    """Viewer can list sequencing files after owner uploads."""
    c = sequences_client['client']
    owner = sequences_client['token_owner_w1']
    viewer = sequences_client['token_viewer_w1']
    wid = sequences_client['w1']
    sid = sequences_client['seq_w1_id']
    up = post_sequencing_file_upload(
        c,
        sid,
        owner,
        wid,
        'viewer-list.ab1',
        b'AB1',
    )
    assert up.status_code == 200

    listed = c.get(
        f"/sequences/{sid}/sequencing_files",
        headers=workspace_headers(viewer, wid),
    )
    assert listed.status_code == 200
    assert listed.json() == up.json()


@readonly_db
def test_get_sequence_sequencing_files_non_member_forbidden(sequences_client):
    """Non-member cannot list sequencing files for another workspace."""
    c = sequences_client['client']
    listed = c.get(
        f"/sequences/{sequences_client['seq_w1_id']}/sequencing_files",
        headers=workspace_headers(
            sequences_client['token_owner_w2'],
            sequences_client['w1'],
        ),
    )
    assert listed.status_code == 403
    assert 'Not allowed' in listed.json()['detail']


def test_delete_sequencing_file_owner_204(sequences_client):
    """Owner can delete a sequencing file (204)."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    sid = sequences_client['seq_w1_id']
    up = post_sequencing_file_upload(c, sid, tok, wid, 'del.ab1', b'DEL')
    assert up.status_code == 200
    file_id = up.json()[0]['id']

    r = c.delete(
        f"/sequences/{sid}/sequencing_files/{file_id}",
        headers=workspace_headers(tok, wid),
    )
    assert r.status_code == 204


def test_delete_sequencing_file_viewer_forbidden(sequences_client):
    """Viewer cannot delete sequencing files."""
    c = sequences_client['client']
    owner = sequences_client['token_owner_w1']
    viewer = sequences_client['token_viewer_w1']
    wid = sequences_client['w1']
    sid = sequences_client['seq_w1_id']
    up = post_sequencing_file_upload(c, sid, owner, wid, 'v-del.ab1', b'V')
    assert up.status_code == 200
    file_id = up.json()[0]['id']

    r = c.delete(
        f"/sequences/{sid}/sequencing_files/{file_id}",
        headers=workspace_headers(viewer, wid),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


def test_delete_sequencing_file_wrong_sequence_404(sequences_client):
    """File belongs to W1 sequence; DELETE under W2 path returns 404."""
    c = sequences_client['client']
    tok_w1 = sequences_client['token_owner_w1']
    both = sequences_client['token_owner_both']
    w1 = sequences_client['w1']
    w2 = sequences_client['w2']
    sid1 = sequences_client['seq_w1_id']
    sid2 = sequences_client['seq_w2_id']
    up = post_sequencing_file_upload(c, sid1, tok_w1, w1, 'wrongseq.ab1', b'W')
    assert up.status_code == 200
    file_id = up.json()[0]['id']

    r = c.delete(
        f"/sequences/{sid2}/sequencing_files/{file_id}",
        headers=workspace_headers(both, w2),
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'Sequencing file not found'


def test_download_sequencing_file_ok(sequences_client):
    c = sequences_client['client']
    payload = b'DOWNLOAD-BYTES-123'
    up = post_sequencing_file_upload(
        c,
        sequences_client['seq_w1_id'],
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        'dl.ab1',
        payload,
    )
    assert up.status_code == 200
    file_id = up.json()[0]['id']
    r = c.get(
        f"/sequencing_files/{file_id}/download",
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 200
    assert r.content == payload


@readonly_db
def test_download_sequencing_file_unknown_id_404(sequences_client):
    c = sequences_client['client']
    r = c.get(
        '/sequencing_files/999999999/download',
        headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
    )
    assert r.status_code == 404
    assert r.json()['detail'] == 'Sequencing file not found'


def test_download_sequencing_file_zz_forbidden_cross_workspace(sequences_client):
    """User without W1 access cannot download a file uploaded under W1.

    Previous note: Runs after other download tests: a 403 download in the same TestClient session
    can leave state that breaks a following successful download in some setups.
    """
    c = sequences_client['client']
    tok = sequences_client['token_owner_w2']
    uploaded = post_sequencing_file_upload(
        c,
        sequences_client['seq_w1_id'],
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        'test.ab1',
        b'ABIF',
    )
    assert uploaded.status_code == 200
    file_id = uploaded.json()[0]['id']

    download = c.get(
        f"/sequencing_files/{file_id}/download",
        headers=workspace_headers(tok, sequences_client['w1']),
    )
    assert download.status_code == 403
    assert 'Not allowed' in download.json()['detail']


@readonly_db
def test_get_sequences_invalid_workspace_id_header_422(sequences_client):
    """Non-integer X-Workspace-Id on GET /sequences yields 422."""
    assert_get_invalid_workspace_id_422(
        sequences_client['client'],
        '/sequences',
        sequences_client['token_owner_w1'],
        invalid='bad',
    )


@readonly_db
def test_get_sequences_non_member_workspace_w3_forbidden_403(sequences_client):
    """Member of W1 only cannot use workspace W3 header."""
    assert_get_non_member_workspace_403(
        sequences_client['client'],
        '/sequences',
        sequences_client['token_owner_w1'],
        sequences_client['w3'],
    )


@readonly_db
def test_get_sequences_unauthenticated_401(sequences_client):
    """GET /sequences without Authorization is rejected."""
    assert_get_unauthenticated_401(
        sequences_client['client'],
        '/sequences',
        sequences_client['w1'],
    )


def test_download_sequencing_file_no_workspace_header_422(sequences_client):
    """Sequencing download requires X-Workspace-Id (422 if missing)."""
    c = sequences_client['client']
    uploaded = post_sequencing_file_upload(
        c,
        sequences_client['seq_w1_id'],
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        'f.ab1',
        b'ABIF',
    )
    assert uploaded.status_code == 200
    file_id = uploaded.json()[0]['id']

    tok_w1 = sequences_client['token_owner_w1']
    download = c.get(
        f"/sequencing_files/{file_id}/download",
        headers=bearer_headers(tok_w1),
    )
    assert download.status_code == 422
    assert download.json()['detail']


def test_download_sequencing_file_wrong_workspace_404(sequences_client):
    """W1 file id with W2 header: 404 (sequence not in selected workspace)."""
    c = sequences_client['client']
    uploaded = post_sequencing_file_upload(
        c,
        sequences_client['seq_w1_id'],
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        'w.ab1',
        b'ABIF',
    )
    assert uploaded.status_code == 200
    file_id = uploaded.json()[0]['id']

    download = c.get(
        f"/sequencing_files/{file_id}/download",
        headers=workspace_headers(
            sequences_client['token_owner_both'],
            sequences_client['w2'],
        ),
    )
    assert download.status_code == 404
    assert download.json()['detail'] == 'BaseSequence not found'


@readonly_db
def test_patch_sequence_cross_workspace_header_404(sequences_client):
    """PATCH W2 sequence id with W1 header returns 404."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_both']
    response = c.patch(
        f"/sequences/{sequences_client['seq_w2_id']}",
        headers=workspace_headers(tok, sequences_client['w1']),
        json={'name': 'should-not-apply'},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'BaseSequence not found'


def test_post_cloning_strategy_from_example(sequences_client):
    c = sequences_client['client']
    body = cs_pcr.model_dump(mode='json')
    r = c.post(
        '/sequences',
        headers=workspace_headers(
            sequences_client['token_owner_w1'],
            sequences_client['w1'],
            extra={'Content-Type': 'application/json'},
        ),
        json=body,
    )
    assert r.status_code == 200
    out = r.json()
    assert 'id' in out
    assert isinstance(out['mappings'], list)


def _get_pcr_cs_ws1(sequences_client):
    return (
        sequences_client['client'].get(
            f"/sequences/{sequences_client['pcr_product_id']}/cloning_strategy",
            headers=workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1']),
        )
    ).json()


def _post_strategy(sequences_client, body, *, workspace='w1'):
    return sequences_client['client'].post(
        '/sequences',
        headers=workspace_headers(
            sequences_client[f'token_owner_{workspace}'],
            sequences_client[workspace],
            extra={'Content-Type': 'application/json'},
        ),
        json=body,
    )


def test_post_cloning_strategy_foreign_and_missing_primer_id_indistinguishable(sequences_client):
    """Foreign-workspace and nonexistent primer ids give the same 409, never 200/500."""
    foreign = _get_pcr_cs_ws1(sequences_client)
    # Post the existing cs to another workspace
    r_foreign = _post_strategy(sequences_client, foreign, workspace='w2')
    missing = copy.deepcopy(foreign)
    missing['primers'][0]['database_id'] = 10**9
    r_missing = _post_strategy(sequences_client, missing, workspace='w1')

    assert r_foreign.status_code == r_missing.status_code == 409

    foreign_mismatches = r_foreign.json()['detail']['primer_database_id_mismatches']
    assert len(foreign_mismatches) == 2
    assert all(m['kind'] == 'not_found' for m in foreign_mismatches)

    missing_mismatches = r_missing.json()['detail']['primer_database_id_mismatches']
    assert len(missing_mismatches) == 1
    assert all(m['kind'] == 'not_found' for m in missing_mismatches)
    assert missing_mismatches[0]['provided_database_id'] == 10**9


def test_post_cloning_strategy_primer_sequence_mismatch(sequences_client):
    """A primer database_id that exists in the workspace but with a different sequence is rejected."""
    body = _get_pcr_cs_ws1(sequences_client)
    # Swap the database ids of the two primers, so each points to the other's sequence
    assert len(body['primers']) == 2
    body['primers'][0]['database_id'], body['primers'][1]['database_id'] = (
        body['primers'][1]['database_id'],
        body['primers'][0]['database_id'],
    )
    r = _post_strategy(sequences_client, body)
    assert r.status_code == 409

    mismatches = r.json()['detail']['primer_database_id_mismatches']
    assert len(mismatches) == 2
    assert all(m['kind'] == 'sequence_mismatch' for m in mismatches)
    assert r.json()['detail']['sequence_database_id_mismatches'] == []


def _set_product_database_id(body, product_id, new_database_id):
    product_source = next(s for s in body['sources'] if s['database_id'] == product_id)
    product_source['database_id'] = new_database_id


def test_post_cloning_strategy_sequence_database_id_mismatch(sequences_client):
    """A database_id pointing at content with a different SEGUID cannot be used to forge provenance."""
    body = _get_pcr_cs_ws1(sequences_client)
    # seq_w1 exists in the workspace, but its content is not the pcr product
    _set_product_database_id(body, sequences_client['pcr_product_id'], sequences_client['seq_w1_id'])
    r = _post_strategy(sequences_client, body)
    assert r.status_code == 409

    mismatches = r.json()['detail']['sequence_database_id_mismatches']
    assert len(mismatches) == 1
    assert mismatches[0]['kind'] == 'seguid_mismatch'
    assert mismatches[0]['provided_database_id'] == sequences_client['seq_w1_id']
    assert r.json()['detail']['primer_database_id_mismatches'] == []


def test_post_cloning_strategy_foreign_and_missing_sequence_id_indistinguishable(sequences_client):
    """Foreign-workspace and nonexistent sequence ids give the same 409, never 200/500."""
    foreign = _get_pcr_cs_ws1(sequences_client)
    # seq_w2 lives in w2, but we post to w1
    _set_product_database_id(foreign, sequences_client['pcr_product_id'], sequences_client['seq_w2_id'])
    r_foreign = _post_strategy(sequences_client, foreign, workspace='w1')

    missing = _get_pcr_cs_ws1(sequences_client)
    _set_product_database_id(missing, sequences_client['pcr_product_id'], 10**9)
    r_missing = _post_strategy(sequences_client, missing, workspace='w1')

    assert r_foreign.status_code == r_missing.status_code == 409

    foreign_mismatches = r_foreign.json()['detail']['sequence_database_id_mismatches']
    assert len(foreign_mismatches) == 1
    assert foreign_mismatches[0]['kind'] == 'not_found'
    assert foreign_mismatches[0]['provided_database_id'] == sequences_client['seq_w2_id']

    missing_mismatches = r_missing.json()['detail']['sequence_database_id_mismatches']
    assert len(missing_mismatches) == 1
    assert missing_mismatches[0]['kind'] == 'not_found'
    assert missing_mismatches[0]['provided_database_id'] == 10**9


def _count_workspace_rows(sequences_client, workspace_id):
    with Session(sequences_client['engine']) as session:
        n_sequences = session.scalar(
            select(func.count()).select_from(BaseSequence).where(BaseSequence.workspace_id == workspace_id)
        )
        n_primers = session.scalar(select(func.count()).select_from(Primer).where(Primer.workspace_id == workspace_id))
    return n_sequences, n_primers


def test_post_cloning_strategy_valid_database_ids_link_existing(sequences_client):
    """Correct database_ids are accepted and no new rows are created."""
    body = _get_pcr_cs_ws1(sequences_client)
    counts_before = _count_workspace_rows(sequences_client, sequences_client['w1'])
    r = _post_strategy(sequences_client, body, workspace='w1')
    assert r.status_code == 200, r.text
    assert r.json()['id'] == sequences_client['pcr_product_id']
    assert _count_workspace_rows(sequences_client, sequences_client['w1']) == counts_before


def test_post_cloning_strategy_without_database_ids_creates_repeated_rows(sequences_client):
    """Entities without a database_id are not looked up by content, so duplicates can be created."""
    body = cs_pcr.model_dump(mode='json')
    n_sequences, n_primers = _count_workspace_rows(sequences_client, sequences_client['w1'])
    r = _post_strategy(sequences_client, body, workspace='w1')
    assert r.status_code == 200, r.text
    assert r.json()['id'] != sequences_client['pcr_product_id']
    mapped_ids = {m['databaseId'] for m in r.json()['mappings']}
    assert not mapped_ids & {sequences_client['primer1_id'], sequences_client['primer2_id']}
    new_n_sequences, new_n_primers = _count_workspace_rows(sequences_client, sequences_client['w1'])
    assert new_n_sequences > n_sequences
    assert new_n_primers == n_primers + 2


def test_post_cloning_strategy_invalid_strategy_400(sequences_client):
    body = _get_pcr_cs_ws1(sequences_client)
    body['sources'] = []
    r = _post_strategy(sequences_client, body)
    assert r.status_code == 400


def test_cloning_strategy_to_db_foreign_primer_404(sequences_client):
    """A primer from another workspace is not resolved, even for a user who can access both."""
    body = _get_pcr_cs_ws1(sequences_client)
    # Only the primers should be foreign: sequences are treated as new
    for source in body['sources']:
        source['database_id'] = None
    strategy = opencloning_models.CloningStrategy.model_validate(body)
    with Session(sequences_client['engine']) as session:
        with pytest.raises(HTTPException) as exc:
            cloning_strategy_to_db(
                strategy, session, ctx=_write_ctx(sequences_client['w2'], sequences_client['owner_w1_id'])
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == 'Primer not found'


def test_search_rotation_errors():
    with pytest.raises(ValueError):
        _search_rotation(Dseq('ATGC'), Dseq('ATG'))
    with pytest.raises(ValueError):
        _search_rotation(Dseq('ATGC'), Dseq('ATGC', circular=True))
    with pytest.raises(ValueError):
        _search_rotation(Dseq('ATGC', circular=True), Dseq('ATGC'))
    with pytest.raises(ValueError):
        _search_rotation(Dseq('ATGCA', circular=True), Dseq('ATGC', circular=True))
    with pytest.raises(ValueError):
        _search_rotation(Dseq('ATGCT', circular=True), Dseq('ATGCA', circular=True))


def test_post_cloning_strategy_sets_created_by(sequences_client):
    """Sequences (and any primers) created from a cloning strategy carry the creator."""
    c = sequences_client['client']
    headers = workspace_headers(
        sequences_client['token_owner_w1'],
        sequences_client['w1'],
        extra={'Content-Type': 'application/json'},
    )
    body = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json')).model_dump(mode='json')
    r = c.post('/sequences', headers=headers, json=body)
    assert r.status_code == 200, r.text
    root_id = r.json()['id']

    list_headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    r2 = c.get(f"/sequences/{root_id}", headers=list_headers)
    assert r2.status_code == 200
    seq_body = r2.json()
    assert seq_body['created_by'] == {
        'id': sequences_client['owner_w1_id'],
        'display_name': 'Owner W1',
    }
    assert seq_body['created_at'] is not None


@readonly_db
def test_get_sequence_returns_created_at_and_created_by_for_seeded(sequences_client):
    """Seeded sequences (no creator) still expose created_at and a null created_by."""
    c = sequences_client['client']
    headers = workspace_headers(sequences_client['token_owner_w1'], sequences_client['w1'])
    r = c.get(f"/sequences/{sequences_client['seq_w1_id']}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body['created_at'] is not None
    assert body['created_by'] == {'display_name': 'Owner W1', 'id': 1}


def test_get_sequences_filter_by_created_by(sequences_client):
    """GET /sequences?created_by=... filters by creator display_name substring."""
    c = sequences_client['client']
    wid = sequences_client['w1']
    headers_owner = workspace_headers(
        sequences_client['token_owner_w1'],
        wid,
        extra={'Content-Type': 'application/json'},
    )
    headers_both = workspace_headers(
        sequences_client['token_owner_both'],
        wid,
        extra={'Content-Type': 'application/json'},
    )

    body_owner = opencloning_models.CloningStrategy.model_validate(cs_pcr.model_dump(mode='json')).model_dump(
        mode='json'
    )
    r = c.post('/sequences', headers=headers_owner, json=body_owner)
    assert r.status_code == 200, r.text
    owner_root_id = r.json()['id']

    body_both = opencloning_models.CloningStrategy.model_validate(cs_gateway_BP.model_dump(mode='json')).model_dump(
        mode='json'
    )
    r = c.post('/sequences', headers=headers_both, json=body_both)
    assert r.status_code == 200, r.text
    both_root_id = r.json()['id']

    list_headers = workspace_headers(sequences_client['token_owner_w1'], wid)
    r = c.get('/sequences?created_by=Owner W1', headers=list_headers)
    assert r.status_code == 200
    owner_w1_ids = {it['id'] for it in r.json()['items']}
    assert owner_root_id in owner_w1_ids
    assert both_root_id not in owner_w1_ids

    r = c.get('/sequences?created_by=owner', headers=list_headers)
    assert r.status_code == 200
    owner_ids = {it['id'] for it in r.json()['items']}
    assert owner_root_id in owner_ids
    assert both_root_id in owner_ids

    r = c.get('/sequences?created_by=nobody', headers=list_headers)
    assert r.status_code == 200
    assert r.json()['items'] == []


def test_post_sequences_bulk_sets_created_by(sequences_client):
    """Bulk-uploaded sequences are attributed to the requesting user."""
    c = sequences_client['client']
    wid = sequences_client['w1']
    headers_owner = workspace_headers(sequences_client['token_owner_w1'], wid)

    seq_record = Dseqrecord('atgcacgtagctagctagctagctgactgactg', name='bulk-attributed')
    file_content = seq_record.format('genbank')
    files = {'files': ('bulk_attr.gb', file_content, 'application/octet-stream')}
    r = c.post('/sequences/bulk', headers=headers_owner, files=files)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    assert items[0]['created_by'] == {
        'id': sequences_client['owner_w1_id'],
        'display_name': 'Owner W1',
    }
    assert items[0]['created_at'] is not None


def test_post_sequences_bulk_integrity_error_returns_409(sequences_client, monkeypatch):
    """IntegrityError during commit (race condition) in bulk submission returns 409."""
    from sqlalchemy.exc import IntegrityError

    c = sequences_client['client']
    h_token = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    payload = [
        ('race.gb', Dseqrecord('ATGCATGCAAA', name='race_seq').format('genbank').encode('utf-8')),
    ]

    original_commit = Session.commit
    call_count = [0]

    def commit_raising_once(self):
        call_count[0] += 1
        if call_count[0] == 1:
            raise IntegrityError('mock', {}, Exception())
        return original_commit(self)

    monkeypatch.setattr(Session, 'commit', commit_raising_once)

    r = _post_sequences_bulk(c, h_token, wid, payload, strict=True)
    assert r.status_code == 409


def test_post_sequencing_files_too_large(sequences_client):
    """Sequencing files above the configured limit are rejected with 413 and nothing is stored."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    sid = sequences_client['seq_w1_id']
    small_limit_config = get_config().model_copy(update={'max_sequencing_file_size_mb': 1})
    with patch.object(app_config, 'config', small_limit_config):
        up = post_sequencing_file_upload(c, sid, tok, wid, 'big.ab1', b'A' * (1024 * 1024 + 1))
    assert up.status_code == 413
    listed = c.get(f"/sequences/{sid}/sequencing_files", headers=workspace_headers(tok, wid))
    assert listed.json() == []


def test_validate_upload_sequences_too_large(sequences_client):
    """Sequence files above MAX_SEQUENCE_FILE_SIZE_MB are rejected with 413."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    with patch.object(sequences_router.settings, 'MAX_SEQUENCE_FILE_SIZE_MB', 1):
        r = c.post(
            '/sequences/validate-upload',
            headers=workspace_headers(tok, wid),
            files={'files': ('big.fasta', b'>a\n' + b'A' * (1024 * 1024 + 1), 'text/plain')},
        )
    assert r.status_code == 413


def test_post_cloning_strategy_long_primer(sequences_client):
    """POST /sequences rejects primers above the maximum length."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    wid = sequences_client['w1']
    r = c.post(
        '/sequences',
        headers=workspace_headers(tok, wid),
        json={'sources': [], 'sequences': [], 'primers': [{'id': 1, 'name': 'p', 'sequence': 'A' * 1001}]},
    )
    assert r.status_code == 422
