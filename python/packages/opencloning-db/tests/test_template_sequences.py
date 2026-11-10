"""Template sequence endpoints and template-specific behaviors."""

import pytest
from sqlalchemy.orm import Session

from opencloning_db.models import Tag, TemplateSequence

from .helpers import attach_standard_tokens, seed_standard_users, workspace_headers


@pytest.fixture
def template_sequences_client(request):
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_template_sequences_client_readonly')
    engine, client, _ = request.getfixturevalue('engine_client_config_write')
    seeded = attach_standard_tokens(_seed_template_sequences_context(engine), client)
    seeded['engine'] = engine
    return seeded


@pytest.fixture(scope='module')
def _template_sequences_client_readonly(engine_client_config_readonly):
    engine, client, _ = engine_client_config_readonly
    seeded = attach_standard_tokens(_seed_template_sequences_context(engine), client)
    seeded['engine'] = engine
    return seeded


readonly_db = pytest.mark.readonly_db


def _seed_template_sequences_context(engine):
    with Session(engine) as session:
        ctx = seed_standard_users(session)
        tag_w1 = Tag(name='template-tag-w1', workspace_id=ctx['w1'])
        tag_w2 = Tag(name='template-tag-w2', workspace_id=ctx['w2'])
        session.add_all([tag_w1, tag_w2])
        session.commit()
        ctx = {**ctx, 'tag_w1_id': tag_w1.id, 'tag_w2_id': tag_w2.id}

    return ctx


def test_post_template_sequence_owner_ok(template_sequences_client):
    c = template_sequences_client['client']
    response = c.post(
        '/template_sequences',
        headers=workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1']),
        json={'name': 'Template Allele', 'sequence_type': 'allele'},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['name'] == 'Template Allele'
    assert body['type'] == 'template_sequence'
    assert body['sequence_type'] == 'allele'
    assert body['seguid'] is None
    assert body['sample_uids'] == []


@readonly_db
def test_post_template_sequence_viewer_forbidden(template_sequences_client):
    c = template_sequences_client['client']
    response = c.post(
        '/template_sequences',
        headers=workspace_headers(template_sequences_client['token_viewer_w1'], template_sequences_client['w1']),
        json={'name': 'Template Allele', 'sequence_type': 'allele'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_sequence_samples_accepts_template_sequence(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    create = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Template Allele', 'sequence_type': 'allele'},
    )
    assert create.status_code == 200

    response = c.post(
        '/sequence_samples',
        headers=headers,
        json={'uid': 'S-TEMPLATE', 'sequence_id': create.json()['id']},
    )
    assert response.status_code == 200


def test_sequences_route_accepts_template_id(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    create = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Template Allele', 'sequence_type': 'allele'},
    )
    assert create.status_code == 200

    response = c.get(f"/sequences/{create.json()['id']}", headers=headers)
    assert response.status_code == 200


def test_post_template_sequence_persists_template_subtype(template_sequences_client):
    engine = template_sequences_client['engine']
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    create = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Template Allele', 'sequence_type': 'allele'},
    )
    assert create.status_code == 200

    with Session(engine) as session:
        stored = session.get(TemplateSequence, create.json()['id'])

    assert stored is not None
    assert stored.name == 'Template Allele'


def test_post_template_sequence_integrity_error_returns_409(template_sequences_client, monkeypatch):
    """IntegrityError during commit (race after name check) returns 409."""
    from sqlalchemy.exc import IntegrityError

    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])

    original_commit = Session.commit
    call_count = [0]

    def commit_raising_once(self):
        call_count[0] += 1
        if call_count[0] == 1:
            raise IntegrityError('mock', {}, Exception())
        return original_commit(self)

    monkeypatch.setattr(Session, 'commit', commit_raising_once)

    response = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Race Template', 'sequence_type': 'allele'},
    )
    assert response.status_code == 409
    assert response.json()['detail'] == "Template sequence 'Race Template' already exists in this workspace"


def test_post_template_sequence_duplicate_name_409(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    first = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Shared Template', 'sequence_type': 'allele'},
    )
    assert first.status_code == 200

    second = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Shared Template', 'sequence_type': 'plasmid'},
    )
    assert second.status_code == 409
    assert 'already exists' in second.json()['detail']


def test_post_template_sequence_duplicate_name_case_insensitive_409(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    first = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Case Template', 'sequence_type': 'allele'},
    )
    assert first.status_code == 200

    second = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'case template', 'sequence_type': 'allele'},
    )
    assert second.status_code == 409
    assert 'already exists' in second.json()['detail']


def test_patch_template_sequence_duplicate_name_409(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    first = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Rename Target', 'sequence_type': 'allele'},
    )
    assert first.status_code == 200
    other = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'Other Template', 'sequence_type': 'allele'},
    )
    assert other.status_code == 200

    patch = c.patch(
        f"/sequences/{first.json()['id']}",
        headers=headers,
        json={'name': 'other template'},
    )
    assert patch.status_code == 409
    assert 'already exists' in patch.json()['detail']


def test_post_template_sequence_same_name_different_workspace_ok(template_sequences_client):
    c = template_sequences_client['client']
    w1_headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    w2_headers = workspace_headers(template_sequences_client['token_owner_w2'], template_sequences_client['w2'])
    w1 = c.post(
        '/template_sequences',
        headers=w1_headers,
        json={'name': 'Cross Workspace', 'sequence_type': 'allele'},
    )
    assert w1.status_code == 200
    w2 = c.post(
        '/template_sequences',
        headers=w2_headers,
        json={'name': 'Cross Workspace', 'sequence_type': 'allele'},
    )
    assert w2.status_code == 200


def test_change_circularity_rejects_template_sequence(template_sequences_client):
    """Endpoints guarded by require_real_sequence return 404 for template sequences."""
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    create = c.post('/template_sequences', headers=headers, json={'name': 'name', 'sequence_type': 'allele'})
    assert create.status_code == 200
    tid = create.json()['id']

    r = c.patch(f'/sequences/{tid}/change_circularity', headers=headers)
    assert r.status_code == 404


def test_validate_upload_template_sequences_flags(template_sequences_client):
    c = template_sequences_client['client']
    owner_headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    viewer_headers = workspace_headers(template_sequences_client['token_viewer_w1'], template_sequences_client['w1'])
    seed = c.post(
        '/template_sequences',
        headers=owner_headers,
        json={'name': 'seed_template', 'sequence_type': 'allele'},
    )
    assert seed.status_code == 200

    payload = [
        {'name': 'seed_template', 'sequence_type': 'plasmid'},
        {'name': 'dup_name', 'sequence_type': 'allele'},
        {'name': ' DUP_NAME ', 'sequence_type': 'plasmid'},
        {'name': 'fresh_template', 'sequence_type': 'allele'},
    ]
    r = c.post('/template_sequences/validate-upload', headers=viewer_headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 4

    assert rows[0]['name_exists'] is True
    assert rows[0]['name_duplicated'] is False

    assert rows[1]['name_exists'] is False
    assert rows[1]['name_duplicated'] is True

    assert rows[2]['name_exists'] is False
    assert rows[2]['name_duplicated'] is True

    assert rows[3]['name_exists'] is False
    assert rows[3]['name_duplicated'] is False


def test_post_template_sequences_bulk_success(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    payload = [
        {'name': 'bulk_template_1', 'sequence_type': 'allele'},
        {'name': 'bulk_template_2', 'sequence_type': 'plasmid'},
    ]

    r = c.post('/template_sequences/bulk', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    expected_keys = {
        'id',
        'type',
        'name',
        'sequence_type',
        'tags',
        'sample_uids',
        'seguid',
        'created_at',
        'created_by',
    }
    assert set(rows[0]) == expected_keys
    assert set(rows[1]) == expected_keys
    assert rows[0]['type'] == 'template_sequence'
    assert rows[0]['name'] == 'bulk_template_1'
    assert rows[0]['sequence_type'] == 'allele'
    assert rows[1]['name'] == 'bulk_template_2'
    assert rows[1]['sequence_type'] == 'plasmid'


def test_post_template_sequences_bulk_conflict_atomic(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    seed = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'seed_template_bulk', 'sequence_type': 'allele'},
    )
    assert seed.status_code == 200

    payload = [
        {'name': 'seed_template_bulk', 'sequence_type': 'plasmid'},
        {'name': 'would_be_created_bulk', 'sequence_type': 'allele'},
    ]

    r = c.post('/template_sequences/bulk', headers=headers, json=payload)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['name_exists'] is True
    assert rows[0]['name_duplicated'] is False
    assert rows[1]['name_exists'] is False
    assert rows[1]['name_duplicated'] is False

    other = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'would_be_created_bulk', 'sequence_type': 'allele'},
    )
    assert other.status_code == 200


def test_post_template_sequences_bulk_viewer_forbidden(template_sequences_client):
    c = template_sequences_client['client']
    owner_headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    viewer_headers = workspace_headers(template_sequences_client['token_viewer_w1'], template_sequences_client['w1'])
    payload = [{'name': 'viewer_bulk_template', 'sequence_type': 'allele'}]

    validate_r = c.post('/template_sequences/validate-upload', headers=viewer_headers, json=payload)
    assert validate_r.status_code == 200

    bulk_r = c.post('/template_sequences/bulk', headers=viewer_headers, json=payload)
    assert bulk_r.status_code == 403
    assert 'Not allowed' in bulk_r.json()['detail']

    create_r = c.post('/template_sequences', headers=owner_headers, json=payload[0])
    assert create_r.status_code == 200


def test_post_template_sequences_bulk_applies_tags(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    tag_id = template_sequences_client['tag_w1_id']
    payload = [
        {'name': 'bulk_tagged_template_1', 'sequence_type': 'allele'},
        {'name': 'bulk_tagged_template_2', 'sequence_type': 'plasmid'},
    ]

    r = c.post('/template_sequences/bulk', headers=headers, params=[('tags', str(tag_id))], json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    for row in rows:
        assert {t['id'] for t in row['tags']} == {tag_id}
        tags_r = c.get(f"/input_entities/{row['id']}/tags", headers=headers)
        assert tags_r.status_code == 200
        assert {t['id'] for t in tags_r.json()} == {tag_id}


def test_post_template_sequences_bulk_unknown_tag_404(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    payload = [{'name': 'bulk_no_tag_template', 'sequence_type': 'allele'}]

    r = c.post('/template_sequences/bulk', headers=headers, params=[('tags', '999999')], json=payload)
    assert r.status_code == 404
    assert r.json()['detail'] == 'Tag not found'

    create_r = c.post('/template_sequences', headers=headers, json=payload[0])
    assert create_r.status_code == 200


def test_post_template_sequences_bulk_cross_workspace_tag_403(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    payload = [{'name': 'bulk_wrong_tag_template', 'sequence_type': 'allele'}]

    r = c.post(
        '/template_sequences/bulk',
        headers=headers,
        params=[('tags', str(template_sequences_client['tag_w2_id']))],
        json=payload,
    )
    assert r.status_code == 403

    create_r = c.post('/template_sequences', headers=headers, json=payload[0])
    assert create_r.status_code == 200


def test_post_template_sequences_bulk_duplicate_in_batch(template_sequences_client):
    c = template_sequences_client['client']
    headers = workspace_headers(template_sequences_client['token_owner_w1'], template_sequences_client['w1'])
    payload = [
        {'name': 'same_batch_name', 'sequence_type': 'allele'},
        {'name': ' SAME_batch_name ', 'sequence_type': 'plasmid'},
    ]

    r = c.post('/template_sequences/bulk', headers=headers, json=payload)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['name_duplicated'] is True
    assert rows[1]['name_duplicated'] is True

    create_r = c.post(
        '/template_sequences',
        headers=headers,
        json={'name': 'same_batch_name', 'sequence_type': 'allele'},
    )
    assert create_r.status_code == 200
