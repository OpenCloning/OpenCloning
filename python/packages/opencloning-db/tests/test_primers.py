"""Primers routes: workspace scoping and membership."""

import pytest
from sqlalchemy.orm import Session

from opencloning_db.context import WriteContext
from opencloning_db.models import AssemblyFragment, Primer, Sequence, SequenceType, Source, SourceType, Tag, User

from .helpers import (
    assert_get_invalid_workspace_id_422,
    assert_get_missing_workspace_header_422,
    assert_get_non_member_workspace_403,
    assert_get_unauthenticated_401,
    assert_post_unauthenticated_401,
    attach_standard_tokens,
    seed_standard_users,
    workspace_headers,
)


@pytest.fixture
def primers_client(request):
    """Seed read-only or write DB based on ``readonly_db`` marker."""
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_primers_client_readonly')
    engine, client, _ = request.getfixturevalue('engine_client_config_write')
    return attach_standard_tokens(_seed_primers_context(engine), client)


@pytest.fixture(scope='module')
def _primers_client_readonly(engine_client_config_readonly):
    engine, client, _ = engine_client_config_readonly
    return attach_standard_tokens(_seed_primers_context(engine), client)


readonly_db = pytest.mark.readonly_db


def _seed_primers_context(engine):
    with Session(engine) as session:
        ctx = seed_standard_users(session)

        w1_ctx = WriteContext(user=User(id=ctx['owner_w1_id'], email='unused@test'), workspace_id=ctx['w1'])
        w2_ctx = WriteContext(user=User(id=ctx['owner_w2_id'], email='unused@test'), workspace_id=ctx['w2'])

        primer = Primer.from_create(name='seed_primer', sequence='ATGC', ctx=w1_ctx)
        primer_uid = Primer.from_create(name='uid_primer', sequence='CCGG', uid='UID-PRIMER-1', ctx=w1_ctx)
        primer_tagged = Primer.from_create(name='tagged_primer', sequence='TTAA', ctx=w1_ctx)
        primer_w2 = Primer.from_create(name='w2_primer', sequence='GCGC', ctx=w2_ctx)
        primer_w2_b = Primer.from_create(name='w2_primer_b', sequence='ATAT', ctx=w2_ctx)
        tag_w1 = Tag(name='primer-tag-w1', workspace_id=ctx['w1'])
        tag_w2 = Tag(name='primer-tag-w2', workspace_id=ctx['w2'])
        primer_tagged.tags.append(tag_w1)
        template_seq = Sequence.from_create(
            name='template-seq',
            file_content='template_seq.gb',
            seguid='SEGUID-TEMPLATE-SEQ',
            sequence_type=SequenceType.allele,
            ctx=w1_ctx,
        )
        product_seq = Sequence.from_create(
            name='product-seq',
            file_content='product_seq.gb',
            seguid='SEGUID-PRODUCT-SEQ',
            sequence_type=SequenceType.pcr_product,
            ctx=w1_ctx,
        )
        template_seq_w2 = Sequence.from_create(
            name='template-seq-w2',
            file_content='template_seq_w2.gb',
            seguid='SEGUID-TEMPLATE-SEQ-W2',
            sequence_type=SequenceType.allele,
            ctx=w2_ctx,
        )
        product_seq_w2 = Sequence.from_create(
            name='product-seq-w2',
            file_content='product_seq_w2.gb',
            seguid='SEGUID-PRODUCT-SEQ-W2',
            sequence_type=SequenceType.pcr_product,
            ctx=w2_ctx,
        )
        session.add_all(
            [
                primer,
                primer_uid,
                primer_tagged,
                primer_w2,
                primer_w2_b,
                tag_w1,
                tag_w2,
                template_seq,
                product_seq,
                template_seq_w2,
                product_seq_w2,
            ]
        )
        session.flush()
        source = Source(
            type=SourceType.PCRSource,
            output_sequence=product_seq,
            input=[
                AssemblyFragment(
                    type='assembly_fragment',
                    input_entity=primer,
                    left_location='1..20',
                    right_location=None,
                    reverse_complemented=False,
                ),
                AssemblyFragment(
                    type='assembly_fragment',
                    input_entity=template_seq,
                    left_location='1..20',
                    right_location='200..220',
                    reverse_complemented=False,
                ),
                AssemblyFragment(
                    type='assembly_fragment',
                    input_entity=primer_uid,
                    left_location=None,
                    right_location='1..20',
                    reverse_complemented=True,
                ),
            ],
            extra_fields={},
        )
        source_w2 = Source(
            type=SourceType.PCRSource,
            output_sequence=product_seq_w2,
            input=[
                AssemblyFragment(
                    type='assembly_fragment',
                    input_entity=primer_w2,
                    left_location='1..20',
                    right_location=None,
                    reverse_complemented=False,
                ),
                AssemblyFragment(
                    type='assembly_fragment',
                    input_entity=template_seq_w2,
                    left_location='1..200',
                    right_location='1..200',
                    reverse_complemented=False,
                ),
                AssemblyFragment(
                    type='assembly_fragment',
                    input_entity=primer_w2_b,
                    left_location=None,
                    right_location='181..200',
                    reverse_complemented=True,
                ),
            ],
            extra_fields={},
        )
        session.add_all([source, source_w2])
        session.commit()

        ctx.update(
            {
                'primer_id': primer.id,
                'primer_uid_id': primer_uid.id,
                'primer_tagged_id': primer_tagged.id,
                'primer_w2_id': primer_w2.id,
                'tag_w1_id': tag_w1.id,
                'tag_w2_id': tag_w2.id,
                'template_seq_id': template_seq.id,
                'product_seq_id': product_seq.id,
                'template_seq_w2_id': template_seq_w2.id,
                'product_seq_w2_id': product_seq_w2.id,
            }
        )
    return ctx


_VALID_PRIMER_JSON = {
    'name': 'new',
    'sequence': 'GGCC',
}


@readonly_db
def test_get_primers_requires_workspace_id(primers_client):
    """GET /primers without X-Workspace-Id fails validation (422)."""
    assert_get_missing_workspace_header_422(
        primers_client['client'],
        '/primers',
        primers_client['token_owner_w1'],
    )


@readonly_db
def test_get_primers_lists_scoped_primers(primers_client):
    """Listed primers belong only to the selected workspace."""
    c = primers_client['client']
    wid = primers_client['w1']
    r = c.get('/primers', headers=workspace_headers(primers_client['token_owner_w1'], wid))
    assert r.status_code == 200
    data = r.json()
    ids = [it['id'] for it in data['items']]
    assert set(ids) == {
        primers_client['primer_id'],
        primers_client['primer_uid_id'],
        primers_client['primer_tagged_id'],
    }
    assert ids == sorted(ids, reverse=True)


@readonly_db
def test_get_primers_filter_by_tag(primers_client):
    c = primers_client['client']
    r = c.get(
        f"/primers?tags={primers_client['tag_w1_id']}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    assert ids == {primers_client['primer_tagged_id']}


@readonly_db
def test_get_primers_filter_by_name(primers_client):
    c = primers_client['client']
    r = c.get('/primers?name=SEED', headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']))
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    assert ids == {primers_client['primer_id']}


@readonly_db
def test_get_primers_filter_by_uid_substring(primers_client):
    c = primers_client['client']
    r = c.get('/primers?uid=primer', headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']))
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    assert ids == {primers_client['primer_uid_id']}


@readonly_db
def test_get_primers_filter_has_uid_true(primers_client):
    c = primers_client['client']
    r = c.get(
        '/primers?has_uid=true', headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    )
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    assert ids == {primers_client['primer_uid_id']}


@readonly_db
def test_get_primers_forbidden_other_workspace(primers_client):
    """Non-member cannot list primers using another workspace id."""
    c = primers_client['client']
    # owner_w2 tries to list primers in workspace w1
    r = c.get(
        '/primers',
        headers=workspace_headers(
            primers_client['token_owner_w2'],
            primers_client['w1'],
        ),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_get_primer_forbidden_cross_workspace(primers_client):
    """User not in W1 cannot GET a W1 primer with W1 header."""
    c = primers_client['client']
    pid = primers_client['primer_id']
    r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(
            primers_client['token_owner_w2'],
            primers_client['w1'],
        ),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_get_primer_ok(primers_client):
    """Member can fetch a primer by id in their workspace."""
    c = primers_client['client']
    pid = primers_client['primer_id']
    r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(
            primers_client['token_owner_w1'],
            primers_client['w1'],
        ),
    )
    assert r.status_code == 200
    assert r.json()['name'] == 'seed_primer'


@readonly_db
def test_get_primer_sequences_ok(primers_client):
    c = primers_client['client']
    r = c.get(
        f"/primers/{primers_client['primer_id']}/sequences",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert r.status_code == 200
    body = r.json()
    template_ids = {item['id'] for item in body['templates']}
    product_ids = {item['id'] for item in body['products']}
    assert template_ids == {primers_client['template_seq_id']}
    assert product_ids == {primers_client['product_seq_id']}


@readonly_db
def test_get_primer_selected_workspace_mismatch_returns_404(primers_client):
    """Primer in W1 with header W2 returns 404."""
    c = primers_client['client']
    pid = primers_client['primer_id']
    r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(
            primers_client['token_owner_both'],
            primers_client['w2'],
        ),
    )
    assert r.status_code == 404
    assert 'not found' in r.json()['detail'].lower()


@readonly_db
def test_post_primer_viewer_forbidden(primers_client):
    """Viewer cannot POST a primer."""
    c = primers_client['client']
    wid = primers_client['w1']
    r = c.post(
        '/primers',
        headers=workspace_headers(primers_client['token_viewer_w1'], wid),
        json=_VALID_PRIMER_JSON,
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


def test_post_primer_editor_ok(primers_client):
    """Owner/editor can create a primer in the workspace."""
    c = primers_client['client']
    wid = primers_client['w1']
    r = c.post(
        '/primers',
        headers=workspace_headers(primers_client['token_owner_w1'], wid),
        json=_VALID_PRIMER_JSON,
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'id'}
    assert body['id'] > 0


def test_patch_primer_updates_name_only(primers_client):
    """PATCH with only name updates the primer."""
    c = primers_client['client']
    pid = primers_client['primer_uid_id']
    r = c.patch(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
        json={'name': 'primer_renamed'},
    )
    assert r.status_code == 200
    # uid is unchanged when submitted is None
    assert r.json()['name'] == 'primer_renamed'
    assert r.json()['uid'] == 'UID-PRIMER-1'
    get_r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert get_r.status_code == 200
    assert get_r.json()['name'] == 'primer_renamed'
    assert get_r.json()['uid'] == 'UID-PRIMER-1'


def test_patch_primer_updates_uid_only(primers_client):
    """PATCH with only uid sets uid on a primer that had none."""
    c = primers_client['client']
    pid = primers_client['primer_id']
    r = c.patch(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
        json={'uid': 'PATCHED-UID-ONLY'},
    )
    assert r.status_code == 200
    body = r.json()
    assert body['uid'] == 'PATCHED-UID-ONLY'
    assert body['name'] == 'seed_primer'
    get_r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert get_r.status_code == 200
    assert get_r.json()['uid'] == 'PATCHED-UID-ONLY'


def test_patch_primer_uid_conflict_returns_409(primers_client):
    """PATCH uid to one already used by another primer (case-insensitive) returns 409."""
    c = primers_client['client']
    pid = primers_client['primer_id']
    r = c.patch(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
        json={'uid': 'uid-primer-1'},
    )
    assert r.status_code == 409
    assert 'already exists' in r.json()['detail']
    get_r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert get_r.status_code == 200
    assert get_r.json().get('uid') is None


@pytest.mark.parametrize('clear_payload', [{'uid': ''}, {'uid': '   '}])
def test_patch_primer_clears_uid(primers_client, clear_payload):
    """Explicit empty / whitespace / null uid in PATCH clears stored uid."""
    c = primers_client['client']
    pid = primers_client['primer_uid_id']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    r = c.patch(f"/primers/{pid}", headers=headers, json=clear_payload)
    assert r.status_code == 200
    assert r.json()['uid'] is None
    get_r = c.get(f"/primers/{pid}", headers=headers)
    assert get_r.status_code == 200
    assert get_r.json().get('uid') is None


@readonly_db
def test_unauthenticated_401(primers_client):
    """GET /primers without Authorization is rejected."""
    assert_get_unauthenticated_401(
        primers_client['client'],
        '/primers',
        primers_client['w1'],
    )


@readonly_db
def test_get_primers_invalid_workspace_header_422(primers_client):
    """Non-integer X-Workspace-Id yields 422."""
    assert_get_invalid_workspace_id_422(
        primers_client['client'],
        '/primers',
        primers_client['token_owner_w1'],
        invalid='x',
    )


@readonly_db
def test_get_primers_non_member_workspace_w3_forbidden_403(primers_client):
    """User with no membership in W3 cannot pass W3 as workspace header."""
    assert_get_non_member_workspace_403(
        primers_client['client'],
        '/primers',
        primers_client['token_owner_w1'],
        primers_client['w3'],
    )


@readonly_db
def test_post_primer_unauthenticated_401(primers_client):
    """POST /primers without Authorization is rejected."""
    assert_post_unauthenticated_401(
        primers_client['client'],
        '/primers',
        primers_client['w1'],
        json=_VALID_PRIMER_JSON,
    )


@readonly_db
def test_post_primer_invalid_json_422(primers_client):
    """Malformed JSON body yields 422."""
    c = primers_client['client']
    r = c.post(
        '/primers',
        headers=workspace_headers(
            primers_client['token_owner_w1'],
            primers_client['w1'],
            extra={'Content-Type': 'application/json'},
        ),
        content=b'not valid json{',
    )
    assert r.status_code == 422
    assert r.json()['detail']


@readonly_db
def test_post_primer_empty_sequence_rejected_422(primers_client):
    """Empty primer sequence fails request validation (422)."""
    c = primers_client['client']
    body = {**_VALID_PRIMER_JSON, 'name': 'empty-seq', 'sequence': ''}
    r = c.post(
        '/primers',
        headers=workspace_headers(
            primers_client['token_owner_w1'],
            primers_client['w1'],
        ),
        json=body,
    )
    assert r.status_code == 422
    assert r.json()['detail']


@readonly_db
def test_post_primer_wrong_sequence_rejected(primers_client):
    """One-base sequence passes linkml validation but is rejected by the ORM on create."""
    c = primers_client['client']
    body = {'name': 'one-base', 'sequence': 'A'}

    resp = c.post(
        '/primers',
        headers=workspace_headers(
            primers_client['token_owner_w1'],
            primers_client['w1'],
        ),
        json=body,
    )

    assert resp.status_code == 422

    body = {'name': 'one-base', 'sequence': 'ANAAAAAAAG'}
    resp = c.post(
        '/primers',
        headers=workspace_headers(
            primers_client['token_owner_w1'],
            primers_client['w1'],
        ),
        json=body,
    )
    assert resp.status_code == 422


@readonly_db
def test_post_primer_repeated_uid_returns_409(primers_client):
    """POSTing a primer with a repeated UID (case-insensitive) returns 409."""
    c = primers_client['client']
    body = {**_VALID_PRIMER_JSON, 'uid': 'uid-primer-1'}
    r = c.post(
        '/primers',
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
        json=body,
    )
    assert r.status_code == 409
    assert 'already exists' in r.json()['detail']


@readonly_db
def test_validate_upload_returns_primer_refs_with_flags(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_viewer_w1'], primers_client['w1'])
    payload = [
        {'name': ' seed_primer ', 'sequence': 'atgc', 'uid': ' uid-primer-1 '},
        {'name': 'dup_name', 'sequence': 'GGGG', 'uid': 'X-1'},
        {'name': ' DUP_NAME ', 'sequence': 'gggg', 'uid': ' x-1 '},
        {'name': 'fresh', 'sequence': 'TATA', 'uid': None},
    ]

    r = c.post('/primers/validate-upload', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 4

    assert rows[0]['name_exists'] is True
    assert rows[0]['sequence_exists'] is True
    assert rows[0]['uid_exists'] is True
    assert rows[0]['sequence_invalid'] is False
    assert rows[0]['name_duplicated'] is False
    assert rows[0]['sequence_duplicated'] is False
    assert rows[0]['uid_duplicated'] is False

    assert rows[1]['name_exists'] is False
    assert rows[1]['sequence_exists'] is False
    assert rows[1]['uid_exists'] is False
    assert rows[1]['sequence_invalid'] is False
    assert rows[1]['name_duplicated'] is True
    assert rows[1]['sequence_duplicated'] is True
    assert rows[1]['uid_duplicated'] is True

    assert rows[2]['name_exists'] is False
    assert rows[2]['sequence_exists'] is False
    assert rows[2]['uid_exists'] is False
    assert rows[2]['sequence_invalid'] is False
    assert rows[2]['name_duplicated'] is True
    assert rows[2]['sequence_duplicated'] is True
    assert rows[2]['uid_duplicated'] is True

    assert rows[3]['name_exists'] is False
    assert rows[3]['sequence_exists'] is False
    assert rows[3]['uid_exists'] is False
    assert rows[3]['sequence_invalid'] is False
    assert rows[3]['name_duplicated'] is False
    assert rows[3]['sequence_duplicated'] is False
    assert rows[3]['uid_duplicated'] is False


@readonly_db
def test_validate_upload_flags_invalid_sequence(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_viewer_w1'], primers_client['w1'])
    payload = [
        {'name': 'bad_char', 'sequence': 'AXTT', 'uid': None},
        {'name': 'too_short', 'sequence': 'AT', 'uid': None},
        {'name': 'ok_seq', 'sequence': 'ATG', 'uid': None},
    ]

    r = c.post('/primers/validate-upload', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert rows[0]['sequence_invalid'] is True
    assert rows[1]['sequence_invalid'] is True
    assert rows[2]['sequence_invalid'] is False


def test_post_primers_bulk_success_returns_primer_refs(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [
        {'name': 'bulk_new_1', 'sequence': 'AACC', 'uid': 'BULK-UID-1'},
        {'name': 'bulk_new_2', 'sequence': 'GGTT', 'uid': None},
    ]

    r = c.post('/primers/bulk', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    expected_keys = {'id', 'name', 'sequence', 'uid', 'tags', 'created_at', 'created_by'}
    assert set(rows[0]) == expected_keys
    assert set(rows[1]) == expected_keys
    assert rows[0]['id'] > 0
    assert rows[1]['id'] > 0
    assert rows[0]['name'] == 'bulk_new_1'
    assert rows[0]['sequence'] == 'AACC'
    assert rows[0]['uid'] == 'BULK-UID-1'
    assert rows[1]['name'] == 'bulk_new_2'
    assert rows[1]['sequence'] == 'GGTT'
    assert rows[1]['uid'] is None


def test_post_primers_bulk_applies_tags(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    tag_id = primers_client['tag_w1_id']
    payload = [
        {'name': 'bulk_tagged_1', 'sequence': 'AACC', 'uid': None},
        {'name': 'bulk_tagged_2', 'sequence': 'GGTT', 'uid': None},
    ]

    r = c.post('/primers/bulk', headers=headers, params=[('tags', str(tag_id))], json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    for row in rows:
        assert {t['id'] for t in row['tags']} == {tag_id}
        tags_r = c.get(f"/input_entities/{row['id']}/tags", headers=headers)
        assert tags_r.status_code == 200
        assert {t['id'] for t in tags_r.json()} == {tag_id}


@readonly_db
def test_post_primers_bulk_unknown_tag_404(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [{'name': 'bulk_no_tag_1', 'sequence': 'AACC', 'uid': None}]

    r = c.post('/primers/bulk', headers=headers, params=[('tags', '999999')], json=payload)
    assert r.status_code == 404
    assert r.json()['detail'] == 'Tag not found'

    list_r = c.get('/primers?name=bulk_no_tag_1', headers=headers)
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 0


@readonly_db
def test_post_primers_bulk_cross_workspace_tag_403(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [{'name': 'bulk_wrong_tag_1', 'sequence': 'AACC', 'uid': None}]

    r = c.post(
        '/primers/bulk',
        headers=headers,
        params=[('tags', str(primers_client['tag_w2_id']))],
        json=payload,
    )
    assert r.status_code == 403

    list_r = c.get('/primers?name=bulk_wrong_tag_1', headers=headers)
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 0


def test_post_primers_bulk_conflict_returns_409_and_is_atomic(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [
        {'name': 'seed_primer', 'sequence': 'AACC', 'uid': 'UNUSED-NEW-UID'},
        {'name': 'would_be_created', 'sequence': 'GGTT', 'uid': 'BULK-ATOMIC-1'},
    ]

    r = c.post('/primers/bulk', headers=headers, json=payload)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['name_exists'] is True
    assert rows[1]['name_exists'] is False
    assert rows[0]['name_duplicated'] is False
    assert rows[1]['name_duplicated'] is False

    list_r = c.get('/primers?name=would_be_created', headers=headers)
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 0


def test_post_primers_bulk_invalid_sequence_returns_409_and_is_atomic(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [
        {'name': 'invalid_seq', 'sequence': 'AT', 'uid': 'BULK-BAD-1'},
        {'name': 'would_not_be_created', 'sequence': 'GGTT', 'uid': 'BULK-BAD-2'},
    ]

    r = c.post('/primers/bulk', headers=headers, json=payload)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]['sequence_invalid'] is True
    assert rows[1]['sequence_invalid'] is False

    list_r = c.get('/primers?name=would_not_be_created', headers=headers)
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 0


def test_post_primers_bulk_non_strict_allows_name_and_sequence_conflicts(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [
        {'name': 'seed_primer', 'sequence': 'AACC', 'uid': 'NON-STRICT-UID-1'},
        {'name': 'fresh_non_strict', 'sequence': 'ATGC', 'uid': 'NON-STRICT-UID-2'},
        {'name': 'same_name', 'sequence': 'GGGGG', 'uid': 'NON-STRICT-UID-3'},
        {'name': 'same_name', 'sequence': 'GGGGG', 'uid': 'NON-STRICT-UID-4'},
    ]

    r = c.post('/primers/bulk?strict=false', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 4
    assert rows[0]['name'] == 'seed_primer'
    assert rows[1]['sequence'] == 'ATGC'
    assert rows[2]['name'] == 'same_name'
    assert rows[3]['name'] == 'same_name'

    list_r = c.get('/primers?uid=NON-STRICT-UID', headers=headers)
    assert list_r.status_code == 200
    assert len(list_r.json()['items']) == 4


def test_delete_primer_owner_ok(primers_client):
    """Owner can delete a primer that is not used as input to any source."""
    c = primers_client['client']
    pid = primers_client['primer_tagged_id']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])

    r = c.delete(f"/primers/{pid}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {'deleted': pid, 'data': None}

    assert c.get(f"/primers/{pid}", headers=headers).status_code == 404


@readonly_db
def test_delete_primer_rejects_when_used_as_input(primers_client):
    """Primers used as inputs to a source cannot be deleted (409)."""
    c = primers_client['client']
    r = c.delete(
        f"/primers/{primers_client['primer_id']}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert r.status_code == 409
    assert 'Cannot delete primer in use.' in r.json()['detail']


@readonly_db
def test_delete_primer_viewer_forbidden(primers_client):
    """Viewers cannot delete primers."""
    c = primers_client['client']
    r = c.delete(
        f"/primers/{primers_client['primer_tagged_id']}",
        headers=workspace_headers(primers_client['token_viewer_w1'], primers_client['w1']),
    )
    assert r.status_code == 403
    assert 'Not allowed' in r.json()['detail']


@readonly_db
def test_delete_primer_workspace_mismatch_404(primers_client):
    """W2 primer id with W1 header returns 404."""
    c = primers_client['client']
    r = c.delete(
        f"/primers/{primers_client['primer_w2_id']}",
        headers=workspace_headers(primers_client['token_owner_both'], primers_client['w1']),
    )
    assert r.status_code == 404
    assert 'not found' in r.json()['detail'].lower()


def test_post_primers_bulk_non_strict_still_rejects_uid_and_invalid_sequence(primers_client):
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    ok_payload = [{'name': 'non_strict_ok', 'sequence': 'GGTT', 'uid': 'NON-STRICT-OK'}]
    for wrong_payload in [
        [{'name': 'non_strict_bad_uid', 'sequence': 'AAAAAAAAAAA', 'uid': 'uid-primer-1'}],  # Existing UID
        [{'name': 'non_strict_bad_seq', 'sequence': 'AX', 'uid': 'NON-STRICT'}],  # Invalid sequence
        [{'name': 'non_strict_duplicated_UID', 'sequence': 'AAA', 'uid': 'NON-STRICT-OK'}],  # Duplicated name
    ]:
        payload = ok_payload + wrong_payload
        r = c.post('/primers/bulk?strict=false', headers=headers, json=payload)
        assert r.status_code == 409
        list_r = c.get('/primers?name=non_strict', headers=headers)
        assert list_r.status_code == 200
        assert len(list_r.json()['items']) == 0


def test_post_primer_sets_created_by(primers_client):
    """POST /primers attributes creation to the requesting user."""
    c = primers_client['client']
    wid = primers_client['w1']
    r = c.post(
        '/primers',
        headers=workspace_headers(primers_client['token_owner_w1'], wid),
        json={'name': 'creator_check_primer', 'sequence': 'GGCC'},
    )
    assert r.status_code == 200, r.text
    primer_id = r.json()['id']

    r2 = c.get(f"/primers/{primer_id}", headers=workspace_headers(primers_client['token_owner_w1'], wid))
    assert r2.status_code == 200
    body = r2.json()
    assert body['created_by'] == {
        'id': primers_client['owner_w1_id'],
        'display_name': 'Owner W1',
    }
    assert body['created_at'] is not None


def test_post_primers_bulk_sets_created_by(primers_client):
    """POST /primers/bulk attributes creation to the requesting user."""
    c = primers_client['client']
    wid = primers_client['w1']
    r = c.post(
        '/primers/bulk',
        headers=workspace_headers(primers_client['token_owner_w1'], wid),
        json=[
            {'name': 'bulk_owner_a', 'sequence': 'AACC'},
            {'name': 'bulk_owner_b', 'sequence': 'GGTT'},
        ],
    )
    assert r.status_code == 200, r.text
    for row in r.json():
        assert row['created_by'] == {
            'id': primers_client['owner_w1_id'],
            'display_name': 'Owner W1',
        }
        assert row['created_at'] is not None


@readonly_db
def test_get_primer_returns_created_at_and_created_by(primers_client):
    """Seeded primers (no creator) still expose the new fields."""
    c = primers_client['client']
    pid = primers_client['primer_id']
    r = c.get(
        f"/primers/{pid}",
        headers=workspace_headers(primers_client['token_owner_w1'], primers_client['w1']),
    )
    assert r.status_code == 200
    body = r.json()
    assert 'created_at' in body and body['created_at'] is not None
    assert body['created_by'] == {'display_name': 'Owner W1', 'id': 1}


def test_get_primers_filter_by_created_by(primers_client):
    """GET /primers?created_by=... matches display_name substring case-insensitively."""
    c = primers_client['client']
    wid = primers_client['w1']
    headers_owner = workspace_headers(primers_client['token_owner_w1'], wid)
    headers_owner2 = workspace_headers(primers_client['token_owner_both'], wid)

    r = c.post('/primers', headers=headers_owner, json={'name': 'by_owner_w1', 'sequence': 'AAAA'})
    assert r.status_code == 200
    by_owner_id = r.json()['id']

    r = c.post('/primers', headers=headers_owner2, json={'name': 'by_owner_both', 'sequence': 'TTTT'})
    assert r.status_code == 200
    by_both_id = r.json()['id']

    r = c.get('/primers?created_by=Owner W1', headers=headers_owner)
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    all_owner1_ids = {
        by_owner_id,
        primers_client['primer_tagged_id'],
        primers_client['primer_uid_id'],
        primers_client['primer_id'],
    }
    assert ids == all_owner1_ids

    r = c.get('/primers?created_by=owner', headers=headers_owner)
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    assert ids == all_owner1_ids | {by_both_id}

    r = c.get('/primers?created_by=nobody', headers=headers_owner)
    assert r.status_code == 200
    assert r.json()['items'] == []


@readonly_db
def test_validate_upload_whitespace_uid_not_flagged_as_existing(primers_client):
    """Whitespace-only UID is normalised to None by _normalize_uid, so uid_exists is False."""
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [{'name': 'ws_uid_primer', 'sequence': 'AACCGG', 'uid': '   '}]

    r = c.post('/primers/validate-upload', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]['uid_exists'] is False
    assert rows[0]['uid_duplicated'] is False


def test_post_primers_bulk_integrity_error_returns_409(primers_client, monkeypatch):
    """IntegrityError during commit (race condition) returns 409 with validation rows."""
    from sqlalchemy.exc import IntegrityError

    c = primers_client['client']
    headers = workspace_headers(primers_client['token_owner_w1'], primers_client['w1'])
    payload = [{'name': 'race_primer', 'sequence': 'AACCGG', 'uid': 'RACE-UID-1'}]

    original_commit = Session.commit
    call_count = [0]

    def commit_raising_once(self):
        call_count[0] += 1
        if call_count[0] == 1:
            raise IntegrityError('mock', {}, Exception())
        return original_commit(self)

    monkeypatch.setattr(Session, 'commit', commit_raising_once)

    r = c.post('/primers/bulk', headers=headers, json=payload)
    assert r.status_code == 409
    rows = r.json()
    assert len(rows) == 1


def test_post_primer_too_long(primers_client):
    """Primers above 1000 bp are rejected."""
    c = primers_client['client']
    wid = primers_client['w1']
    headers = workspace_headers(primers_client['token_owner_w1'], wid)
    r = c.post('/primers', headers=headers, json={'name': 'long', 'sequence': 'A' * 1001})
    assert r.status_code == 422
    r = c.post('/primers', headers=headers, json={'name': 'ok', 'sequence': 'A' * 1000})
    assert r.status_code == 200


def test_validate_upload_primer_too_long(primers_client):
    """Bulk validation flags primers above 1000 bp as invalid."""
    c = primers_client['client']
    headers = workspace_headers(primers_client['token_viewer_w1'], primers_client['w1'])
    r = c.post('/primers/validate-upload', headers=headers, json=[{'name': 'long', 'sequence': 'A' * 1001}])
    assert r.status_code == 200
    assert r.json()[0]['sequence_invalid'] is True
