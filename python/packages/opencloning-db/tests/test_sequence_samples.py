"""Sequence samples routes: workspace scoping and membership."""

import pytest
from sqlalchemy.orm import Session

from opencloning_db.context import WriteContext
from opencloning_db.models import Sequence, SequenceSample, SequenceType, TemplateSequence, User

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
            created_by_id=ctx['owner_w1_id'],
        )
        sample_w2 = SequenceSample(
            uid='S-W2',
            sequence_id=seq_w2.id,
            uid_workspace_id=ctx['w2'],
            created_by_id=ctx['owner_w2_id'],
        )
        session.add_all([sample_w1, sample_w2])
        # Second sequence and template sequence of W1, to reassign samples to
        seq_w1_actual = Sequence(
            workspace_id=ctx['w1'],
            name='seq-w1-actual',
            file_content='seq_w1_actual.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-SEQ-W1-ACTUAL',
            created_by_id=ctx['owner_w1_id'],
        )
        w1_ctx = WriteContext(user=session.get(User, ctx['owner_w1_id']), workspace_id=ctx['w1'])
        template_w1 = TemplateSequence.from_create(name='template-w1', sequence_type=SequenceType.allele, ctx=w1_ctx)
        session.add_all([seq_w1_actual, template_w1])
        session.commit()

        ctx.update(
            {
                'seq_w1_id': seq_w1.id,
                'seq_w2_id': seq_w2.id,
                'sample_w1_uid': sample_w1.uid,
                'seq_w1_actual_id': seq_w1_actual.id,
                'template_w1_id': template_w1.id,
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
    assert data['total'] == 1
    item = data['items'][0]
    assert item['uid'] == seq_samples_client['sample_w1_uid']
    assert item['sequence']['id'] == seq_samples_client['seq_w1_id']
    assert item['sequencing_files'] == []
    assert item['location'] is None
    assert item['created_by']['id'] == seq_samples_client['owner_w1_id']


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
    data = response.json()['items']
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
        json={'location': 'fridge'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_patch_sequence_sample_owner_ok(seq_samples_client):
    """Owner can rename a sample and set / clear its location (case-insensitive lookup)."""
    c = seq_samples_client['client']
    headers = workspace_headers(seq_samples_client['token_owner_w1'], seq_samples_client['w1'])
    stored_uid = seq_samples_client['sample_w1_uid']
    response = c.patch(f"/sequence_samples/{stored_uid.swapcase()}", headers=headers, json={'location': ' box 1 '})
    assert response.status_code == 200
    assert response.json() == {
        'id': response.json()['id'],
        'uid': stored_uid,
        'sequence_id': seq_samples_client['seq_w1_id'],
        'location': 'box 1',
    }

    # null leaves the location unchanged (e.g. a client dumping a model with its defaults)
    response = c.patch(f"/sequence_samples/{stored_uid}", headers=headers, json={'location': None})
    assert response.status_code == 200
    assert response.json()['location'] == 'box 1'

    # Renaming keeps the location, changing only the case is allowed
    response = c.patch(f"/sequence_samples/{stored_uid}", headers=headers, json={'uid': stored_uid.lower()})
    assert response.status_code == 200
    assert response.json()['uid'] == stored_uid.lower()
    assert response.json()['location'] == 'box 1'

    response = c.patch(f"/sequence_samples/{stored_uid}", headers=headers, json={'uid': 'renamed', 'location': ''})
    assert response.status_code == 200
    assert response.json()['uid'] == 'renamed'
    assert response.json()['location'] is None
    assert c.get(f"/sequence_samples/{stored_uid}", headers=headers).status_code == 404


def test_patch_sequence_sample_rename_conflict_409(seq_samples_client):
    c = seq_samples_client['client']
    headers = workspace_headers(seq_samples_client['token_owner_w1'], seq_samples_client['w1'])
    r = c.post(
        '/sequence_samples', headers=headers, json={'uid': 'other', 'sequence_id': seq_samples_client['seq_w1_id']}
    )
    assert r.status_code == 200
    response = c.patch(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}", headers=headers, json={'uid': 'OTHER'}
    )
    assert response.status_code == 409


@readonly_db
def test_patch_sequence_sample_cannot_change_sequence(seq_samples_client):
    """The sequence is changed with the reassign endpoint, not with PATCH."""
    c = seq_samples_client['client']
    response = c.patch(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}",
        headers=workspace_headers(seq_samples_client['token_owner_w1'], seq_samples_client['w1']),
        json={'sequence_id': seq_samples_client['seq_w1_id']},
    )
    assert response.status_code == 422


@readonly_db
def test_reassign_sequence_sample_cross_workspace_sequence_rejected(
    seq_samples_client,
):
    """Reassign sample to W2 sequence under W1 header: 403 (not 404)."""
    c = seq_samples_client['client']
    tok = seq_samples_client['token_owner_w1']
    response = c.post(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}/reassign",
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


def _upload(client, headers, uid, *names):
    return client.post(
        f'/sequence_samples/{uid}/sequencing_files',
        headers=headers,
        files=[('files', (name, b'ABIF', 'application/octet-stream')) for name in names],
    )


def test_reassign_sequence_sample_moves_files(seq_samples_client):
    c = seq_samples_client['client']
    headers = workspace_headers(seq_samples_client['token_owner_w1'], seq_samples_client['w1'])
    uid = seq_samples_client['sample_w1_uid']
    planned, actual = seq_samples_client['seq_w1_id'], seq_samples_client['seq_w1_actual_id']
    assert _upload(c, headers, uid, 'a.ab1', 'b.ab1').status_code == 200

    r = c.post(f'/sequence_samples/{uid}/reassign', headers=headers, json={'sequence_id': actual})
    assert r.status_code == 200, r.text
    assert r.json()['sequence_id'] == actual

    # The files follow the sample
    assert c.get(f'/sequences/{planned}/sequencing_files', headers=headers).json() == []
    files = c.get(f'/sequences/{actual}/sequencing_files', headers=headers).json()
    assert [(f['sample_uid'], f['original_name']) for f in files] == [(uid, 'a.ab1'), (uid, 'b.ab1')]

    # Reassigning to the same sequence fails
    r = c.post(f'/sequence_samples/{uid}/reassign', headers=headers, json={'sequence_id': actual})
    assert r.status_code == 400

    # Samples with files cannot point to template sequences
    r = c.post(
        f'/sequence_samples/{uid}/reassign',
        headers=headers,
        json={'sequence_id': seq_samples_client['template_w1_id']},
    )
    assert r.status_code == 400

    # The sequence the sample was moved from can be deleted
    assert c.delete(f'/sequences/{planned}', headers=headers).status_code == 200
    assert c.get(f'/sequence_samples/{uid}', headers=headers).status_code == 200


@readonly_db
def test_reassign_sequence_sample_viewer_forbidden(seq_samples_client):
    c = seq_samples_client['client']
    r = c.post(
        f"/sequence_samples/{seq_samples_client['sample_w1_uid']}/reassign",
        headers=workspace_headers(seq_samples_client['token_viewer_w1'], seq_samples_client['w1']),
        json={'sequence_id': seq_samples_client['seq_w1_actual_id']},
    )
    assert r.status_code == 403


def test_sample_sequencing_files(seq_samples_client):
    c = seq_samples_client['client']
    headers = workspace_headers(seq_samples_client['token_owner_w1'], seq_samples_client['w1'])
    uid = seq_samples_client['sample_w1_uid']

    r = _upload(c, headers, uid, 'a.ab1')
    assert r.status_code == 200
    file_id = r.json()[0]['id']
    assert c.get(f'/sequence_samples/{uid}/sequencing_files', headers=headers).json() == r.json()

    # Same name twice, in the sample or in the request
    assert _upload(c, headers, uid, 'a.ab1').status_code == 409
    assert _upload(c, headers, uid, 'b.ab1', 'b.ab1').status_code == 409

    # Listed with the sample
    items = c.get('/sequence_samples', headers=headers).json()['items']
    assert [f['original_name'] for f in items[0]['sequencing_files']] == ['a.ab1']

    # Samples of template sequences cannot have files
    c.post(
        '/sequence_samples',
        headers=headers,
        json={'uid': 'template-sample', 'sequence_id': seq_samples_client['template_w1_id']},
    )
    assert _upload(c, headers, 'template-sample', 'c.ab1').status_code == 404

    # Delete
    assert c.delete(f'/sequencing_files/{file_id}', headers=headers).status_code == 204
    assert c.get(f'/sequencing_files/{file_id}/download', headers=headers).status_code == 404


def test_sequence_samples_filters(seq_samples_client):
    c = seq_samples_client['client']
    headers = workspace_headers(seq_samples_client['token_owner_w1'], seq_samples_client['w1'])
    c.post(
        '/sequence_samples',
        headers=headers,
        json={'uid': 'S-ACTUAL', 'sequence_id': seq_samples_client['seq_w1_actual_id'], 'location': 'Freezer A'},
    )

    def uids(**params):
        r = c.get('/sequence_samples', headers=headers, params=params)
        assert r.status_code == 200, r.text
        return [item['uid'] for item in r.json()['items']]

    assert uids() == ['S-ACTUAL', 'S-W1']
    assert uids(location='freezer') == ['S-ACTUAL']
    assert uids(name='actual') == ['S-ACTUAL']
    assert uids(sequence_id=seq_samples_client['seq_w1_id']) == ['S-W1']
    assert uids(sequence_types='plasmid') == []
    assert uids(created_by='nobody') == []
