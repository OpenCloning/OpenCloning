"""Sequence samples routes: workspace scoping and membership."""

import pytest
from sqlalchemy.orm import Session

from opencloning_db.models import Sequence, SequenceSample, SequenceType

from .helpers import (
    assert_get_invalid_workspace_id_422,
    assert_get_missing_workspace_header_422,
    assert_get_non_member_workspace_403,
    assert_get_unauthenticated_401,
    attach_standard_tokens,
    seed_standard_users,
    workspace_headers,
)


@pytest.fixture
def seq_samples_client(request):
    """Seed read-only or write DB based on ``readonly_db`` marker."""
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_seq_samples_client_readonly')
    engine, client, _ = request.getfixturevalue('engine_client_config_write')
    return attach_standard_tokens(_seed_seq_samples_context(engine), client)


@pytest.fixture(scope='module')
def _seq_samples_client_readonly(engine_client_config_readonly):
    engine, client, _ = engine_client_config_readonly
    return attach_standard_tokens(_seed_seq_samples_context(engine), client)


readonly_db = pytest.mark.readonly_db


def _seed_seq_samples_context(engine):
    with Session(engine) as session:
        ctx = seed_standard_users(session)

        seq_w1 = Sequence(
            workspace_id=ctx['w1'],
            name='seq-w1',
            file_content='seq_w1.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-SEQ-W1',
            created_by_id=ctx['owner_w1_id'],
        )
        seq_w2 = Sequence(
            workspace_id=ctx['w2'],
            name='seq-w2',
            file_content='seq_w2.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-SEQ-W2',
            created_by_id=ctx['owner_w2_id'],
        )
        session.add_all([seq_w1, seq_w2])
        session.flush()

        sample_w1 = SequenceSample(
            uid='S-W1',
            sequence_id=seq_w1.id,
            uid_workspace_id=ctx['w1'],
        )
        sample_w2 = SequenceSample(
            uid='S-W2',
            sequence_id=seq_w2.id,
            uid_workspace_id=ctx['w2'],
        )
        session.add_all([sample_w1, sample_w2])
        session.commit()

        ctx.update(
            {
                'seq_w1_id': seq_w1.id,
                'seq_w2_id': seq_w2.id,
                'sample_w1_uid': sample_w1.uid,
            }
        )
    return ctx


@readonly_db
def test_get_sequence_samples_requires_workspace_id(seq_samples_client):
    """GET /sequence_samples without X-Workspace-Id fails validation (422)."""
    assert_get_missing_workspace_header_422(
        seq_samples_client['client'],
        '/sequence_samples',
        seq_samples_client['token_owner_w1'],
    )


@readonly_db
def test_get_sequence_samples_scoped_to_workspace(seq_samples_client):
    """Listed samples are restricted to the selected workspace."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    w1 = seq_samples_client['w1']
    response = c.get(
        '/sequence_samples',
        headers=workspace_headers(tok, w1),
    )
    assert response.status_code == 200
    data = response.json()
    uids = {item['uid'] for item in data}
    assert uids == {seq_samples_client['sample_w1_uid']}


@readonly_db
def test_get_sequence_samples_uid_filter_case_insensitive(seq_samples_client):
    """uid query applies case-insensitive substring filtering."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    w1 = seq_samples_client['w1']
    response = c.get(
        '/sequence_samples?uid=s-w',
        headers=workspace_headers(tok, w1),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['uid'] == seq_samples_client['sample_w1_uid']


@readonly_db
def test_get_sequence_samples_forbidden_for_non_member(seq_samples_client):
    """Non-member cannot list samples with another workspace header."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w2']
    response = c.get(
        '/sequence_samples',
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_sequence_sample(seq_samples_client):
    """GET /sequence_samples/{uid} returns sample in selected workspace (case-insensitive lookup)."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    stored_uid = seq_samples_client['sample_w1_uid']
    response = c.get(
        f"/sequence_samples/{stored_uid.swapcase()}",
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 200
    body = response.json()
    assert body['uid'] == stored_uid
    assert body['sequence_id'] == seq_samples_client['seq_w1_id']


@readonly_db
def test_get_sequence_sample_not_found_404(seq_samples_client):
    """GET /sequence_samples/{uid} returns 404 if sample not found."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.get(
        '/sequence_samples/MISSING-UID',
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Sequence sample not found'


@readonly_db
def test_post_sequence_sample_viewer_forbidden(seq_samples_client):
    """Viewer cannot create sequence samples."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_viewer_w1']
    response = c.post(
        '/sequence_samples',
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={
            'uid': 'S-NEW',
            'sequence_id': seq_samples_client['seq_w1_id'],
        },
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_post_sequence_sample_owner_ok(seq_samples_client):
    """Owner can create a sample linked to a sequence in the same workspace."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.post(
        '/sequence_samples',
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={
            'uid': 'S-NEW-OWNER',
            'sequence_id': seq_samples_client['seq_w1_id'],
        },
    )
    assert response.status_code == 200
    assert response.json()['uid'] == 'S-NEW-OWNER'


@readonly_db
def test_post_sequence_sample_wrong_workspace_sequence_rejected(
    seq_samples_client,
):
    """POST with other-workspace sequence_id and W1 header: 404."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_both']
    response = c.post(
        '/sequence_samples',
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={
            'uid': 'S-CROSS',
            'sequence_id': seq_samples_client['seq_w2_id'],
        },
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'BaseSequence not found'


@readonly_db
def test_patch_sequence_sample_viewer_forbidden(seq_samples_client):
    """Viewer cannot PATCH a sequence sample."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_viewer_w1']
    response = c.patch(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}",
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={'sequence_id': seq_samples_client['seq_w1_id']},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_patch_sequence_sample_owner_ok(seq_samples_client):
    """Owner can PATCH sample to another sequence in same workspace (case-insensitive lookup)."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    stored_uid = seq_samples_client['sample_w1_uid']
    # Move the sample to the same workspace sequence (idempotent-ish).
    response = c.patch(
        f"/sequence_samples/{stored_uid.swapcase()}",
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={'sequence_id': seq_samples_client['seq_w1_id']},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['uid'] == stored_uid
    assert body['sequence_id'] == seq_samples_client['seq_w1_id']


@readonly_db
def test_patch_sequence_sample_cross_workspace_sequence_rejected(
    seq_samples_client,
):
    """PATCH sample to W2 sequence under W1 header: 403 (not 404)."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.patch(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}",
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={'sequence_id': seq_samples_client['seq_w2_id']},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_sequence_samples_invalid_workspace_header_422(seq_samples_client):
    """Non-integer X-Workspace-Id yields 422."""
    assert_get_invalid_workspace_id_422(
        seq_samples_client['client'],
        '/sequence_samples',
        seq_samples_client['token_owner_w1'],
        invalid='nope',
    )


@readonly_db
def test_get_sequence_samples_w3_non_member_403(seq_samples_client):
    """No access to W3: 403 when listing samples with W3 header."""
    assert_get_non_member_workspace_403(
        seq_samples_client['client'],
        '/sequence_samples',
        seq_samples_client['token_owner_w1'],
        seq_samples_client['w3'],
    )


@readonly_db
def test_get_sequence_samples_unauthenticated_401(seq_samples_client):
    """GET /sequence_samples without Authorization is rejected."""
    assert_get_unauthenticated_401(
        seq_samples_client['client'],
        '/sequence_samples',
        seq_samples_client['w1'],
    )


def test_post_sequence_sample_duplicate_uid_returns_409(seq_samples_client):
    """Second sample with the same uid (case-insensitive) in the same workspace returns 409."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    h = workspace_headers(tok, seq_samples_client['w1'])
    r1 = c.post(
        '/sequence_samples',
        headers=h,
        json={'uid': 'S-DUP', 'sequence_id': seq_samples_client['seq_w1_id']},
    )
    assert r1.status_code == 200
    r2 = c.post(
        '/sequence_samples',
        headers=h,
        json={'uid': 's-dup', 'sequence_id': seq_samples_client['seq_w1_id']},
    )
    assert r2.status_code == 409
    assert 'already exists' in r2.json()['detail']


@readonly_db
def test_post_sequence_sample_invalid_sequence_id_404(seq_samples_client):
    """Nonexistent sequence_id yields 404 from workspace-scoped resolution."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.post(
        '/sequence_samples',
        headers=workspace_headers(tok, seq_samples_client['w1']),
        json={'uid': 'S-BAD-SEQ', 'sequence_id': 9_999_999},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'BaseSequence not found'


@readonly_db
def test_delete_sequence_sample_viewer_forbidden(seq_samples_client):
    """Viewer cannot DELETE a sequence sample."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_viewer_w1']
    response = c.delete(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}",
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_delete_sequence_sample_owner_ok(seq_samples_client):
    """Owner can delete a sample via case-insensitive UID lookup; GET then 404."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    w1 = seq_samples_client['w1']
    stored_uid = seq_samples_client['sample_w1_uid']
    lookup_uid = stored_uid.swapcase()
    h = workspace_headers(tok, w1)
    sample_id = c.get(f'/sequence_samples/{lookup_uid}', headers=h).json()['id']
    response = c.delete(f'/sequence_samples/{lookup_uid}', headers=h)
    assert response.status_code == 200
    assert response.json() == {
        'deleted': sample_id,
        'data': {
            'sequence_id': seq_samples_client['seq_w1_id'],
            # Delete response echoes the uid path param (not the stored casing).
            'uid': lookup_uid,
        },
    }
    get_after = c.get(f'/sequence_samples/{lookup_uid}', headers=h)
    assert get_after.status_code == 404
    assert get_after.json()['detail'] == 'Sequence sample not found'


@readonly_db
def test_delete_sequence_sample_not_found_404(seq_samples_client):
    """DELETE /sequence_samples/{uid} returns 404 if sample not found."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.delete(
        '/sequence_samples/MISSING-UID',
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Sequence sample not found'


@readonly_db
def test_delete_sequence_sample_forbidden_for_non_member(seq_samples_client):
    """Non-member cannot delete a sample with another workspace header."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w2']
    response = c.delete(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}",
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_delete_sequence_sample_other_workspace_uid_returns_404(seq_samples_client):
    """UID that exists only in another workspace is not found under this header."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.delete(
        '/sequence_samples/S-W2',
        headers=workspace_headers(tok, seq_samples_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Sequence sample not found'


@readonly_db
def test_delete_sequence_sample_unauthenticated_401(seq_samples_client):
    """DELETE /sequence_samples/{uid} without Authorization is rejected."""
    c = seq_samples_client['client']
    uid = seq_samples_client['sample_w1_uid']
    response = c.delete(
        f'/sequence_samples/{uid}',
        headers={'X-Workspace-Id': str(seq_samples_client['w1'])},
    )
    assert response.status_code == 401
