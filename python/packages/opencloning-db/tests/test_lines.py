"""Lines routes: workspace scoping and membership."""

import pytest
from sqlalchemy.orm import Session

from opencloning_db.models import Line, Sequence, SequenceInLine, SequenceType, Tag, TemplateSequence

from .helpers import (
    assert_get_invalid_workspace_id_422,
    assert_get_missing_workspace_header_422,
    assert_get_non_member_workspace_403,
    assert_get_unauthenticated_401,
    assert_patch_unauthenticated_401,
    assert_post_unauthenticated_401,
    attach_standard_tokens,
    seed_standard_users,
    workspace_headers,
)


@pytest.fixture
def lines_client(request):
    """Seed read-only or write DB based on ``readonly_db`` marker."""
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_lines_client_readonly')
    engine, client, _ = request.getfixturevalue('engine_client_config_write')
    return attach_standard_tokens(_seed_lines_context(engine), client)


@pytest.fixture(scope='module')
def _lines_client_readonly(engine_client_config_readonly):
    engine, client, _ = engine_client_config_readonly
    return attach_standard_tokens(_seed_lines_context(engine), client)


readonly_db = pytest.mark.readonly_db


def _seed_lines_context(engine):
    with Session(engine) as session:
        ctx = seed_standard_users(session)

        allele_w1 = Sequence(
            workspace_id=ctx['w1'],
            name='allele-w1',
            file_content='allele_w1.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-ALLELE-W1',
            created_by_id=ctx['owner_w1_id'],
        )
        plasmid_w1 = Sequence(
            workspace_id=ctx['w1'],
            name='plasmid-w1',
            file_content='plasmid_w1.gb',
            sequence_type=SequenceType.plasmid,
            seguid='SEGUID-PLASMID-W1',
            created_by_id=ctx['owner_w1_id'],
        )
        allele_w1_aux = Sequence(
            workspace_id=ctx['w1'],
            name='allele-aux',
            file_content='allele_aux.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-ALLELE-AUX',
            created_by_id=ctx['owner_w1_id'],
        )
        allele_w1_duplicate_name = Sequence(
            workspace_id=ctx['w1'],
            name='allele-w1',
            file_content='allele_w1_dup.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-ALLELE-W1-DUP',
            created_by_id=ctx['owner_w1_id'],
        )
        template_allele_w1 = TemplateSequence(
            workspace_id=ctx['w1'],
            name='template-allele-w1',
            sequence_type=SequenceType.allele,
            created_by_id=ctx['owner_w1_id'],
        )
        allele_w2 = Sequence(
            workspace_id=ctx['w2'],
            name='allele-w2',
            file_content='allele_w2.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-ALLELE-W2',
            created_by_id=ctx['owner_w2_id'],
        )
        plasmid_w2 = Sequence(
            workspace_id=ctx['w2'],
            name='plasmid-w2',
            file_content='plasmid_w2.gb',
            sequence_type=SequenceType.plasmid,
            seguid='SEGUID-PLASMID-W2',
            created_by_id=ctx['owner_w2_id'],
        )
        # Sequences for filter coverage (multi-token genotype/plasmid paths).
        allele_filter = Sequence(
            workspace_id=ctx['w1'],
            name='alpha beta',
            file_content='allele_filter.gb',
            sequence_type=SequenceType.allele,
            seguid='SEGUID-ALLELE-FILTER',
            created_by_id=ctx['owner_w1_id'],
        )
        plasmid_filter = Sequence(
            workspace_id=ctx['w1'],
            name='gamma delta',
            file_content='plasmid_filter.gb',
            sequence_type=SequenceType.plasmid,
            seguid='SEGUID-PLASMID-FILTER',
            created_by_id=ctx['owner_w1_id'],
        )
        session.add_all(
            [
                allele_w1,
                plasmid_w1,
                allele_w1_aux,
                allele_w1_duplicate_name,
                template_allele_w1,
                allele_w2,
                plasmid_w2,
                allele_filter,
                plasmid_filter,
            ]
        )
        session.flush()

        line_w1 = Line(workspace_id=ctx['w1'], uid='L-W1', created_by_id=ctx['owner_w1_id'])
        line_w2 = Line(workspace_id=ctx['w2'], uid='L-W2', created_by_id=ctx['owner_w2_id'])
        line_filter = Line(workspace_id=ctx['w1'], uid='L-FILTER', created_by_id=ctx['owner_w1_id'])
        line_filter.sequences_in_line = [
            SequenceInLine(sequence=allele_filter),
            SequenceInLine(sequence=plasmid_filter),
        ]
        line_parent_to_be_added = Line(
            workspace_id=ctx['w1'], uid='L-PARENT-TO-BE-ADDED', created_by_id=ctx['owner_w1_id']
        )
        line_seeded_parented = Line(workspace_id=ctx['w1'], uid='L-SEEDED-PARENTED', created_by_id=ctx['owner_w1_id'])
        line_seeded_parented.parents = [line_w1]
        line_seeded_parented.sequences_in_line = [
            SequenceInLine(sequence=allele_w1),
            SequenceInLine(sequence=plasmid_w1),
        ]
        line_tagged = Line(workspace_id=ctx['w1'], uid='L-TAGGED', created_by_id=ctx['owner_w1_id'])
        tag_filter = Tag(name='line-filter-tag', workspace_id=ctx['w1'])
        tag_w2 = Tag(name='line-tag-w2', workspace_id=ctx['w2'])
        line_tagged.tags.append(tag_filter)
        session.add_all(
            [
                line_w1,
                line_w2,
                line_filter,
                line_parent_to_be_added,
                line_seeded_parented,
                line_tagged,
                tag_filter,
                tag_w2,
            ]
        )
        session.commit()

        ctx.update(
            {
                'line_w1_id': line_w1.id,
                'line_filter_id': line_filter.id,
                'line_with_parent_to_be_added': line_parent_to_be_added.id,
                'line_seeded_parented_id': line_seeded_parented.id,
                'line_tagged_id': line_tagged.id,
                'tag_filter_id': tag_filter.id,
                'tag_w2_id': tag_w2.id,
                'allele_w1_id': allele_w1.id,
                'allele_w1_aux_id': allele_w1_aux.id,
                'template_allele_w1_id': template_allele_w1.id,
                'plasmid_w1_id': plasmid_w1.id,
                'allele_w2_id': allele_w2.id,
                'plasmid_w2_id': plasmid_w2.id,
            }
        )
    return ctx


@readonly_db
def test_get_lines_requires_workspace_id(lines_client):
    """GET /lines without X-Workspace-Id fails validation (422)."""
    assert_get_missing_workspace_header_422(
        lines_client['client'],
        '/lines',
        lines_client['token_owner_w1'],
    )


@readonly_db
def test_get_lines_scoped_to_workspace(lines_client):
    """Pagination returns only lines in the selected workspace."""
    c = lines_client['client']
    token = lines_client['token_owner_w1']
    w1 = lines_client['w1']
    response = c.get('/lines', headers=workspace_headers(token, w1))
    assert response.status_code == 200
    items = response.json()['items']
    ids = [item['id'] for item in items]
    assert set(ids) == {
        lines_client['line_w1_id'],
        lines_client['line_filter_id'],
        lines_client['line_with_parent_to_be_added'],
        lines_client['line_seeded_parented_id'],
        lines_client['line_tagged_id'],
    }
    assert ids == sorted(ids, reverse=True)


@readonly_db
def test_get_lines_filter_by_tag(lines_client):
    c = lines_client['client']
    response = c.get(
        f"/lines?tags={lines_client['tag_filter_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()['items']}
    assert ids == {lines_client['line_tagged_id']}


@readonly_db
def test_get_lines_filter_by_genotype_tokens(lines_client):
    c = lines_client['client']
    response = c.get(
        '/lines?genotype=alpha%20BETA',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()['items']}
    assert ids == {lines_client['line_filter_id']}


@readonly_db
def test_get_lines_filter_by_plasmid_tokens(lines_client):
    c = lines_client['client']
    response = c.get(
        '/lines?plasmid=gamma%20delta',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()['items']}
    assert ids == {lines_client['line_filter_id']}


@readonly_db
def test_get_lines_filter_by_uid(lines_client):
    c = lines_client['client']
    response = c.get(
        '/lines?uid=FILTER',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()['items']}
    assert ids == {lines_client['line_filter_id']}


@readonly_db
def test_get_lines_filter_by_uid_and_plasmid(lines_client):
    c = lines_client['client']
    response = c.get(
        '/lines?uid=FILTER&plasmid=gamma%20delta',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()['items']}
    assert ids == {lines_client['line_filter_id']}


@readonly_db
def test_get_lines_forbidden_for_non_member(lines_client):
    """Non-member cannot list lines with another workspace header."""
    c = lines_client['client']
    token = lines_client['token_owner_w2']
    response = c.get('/lines', headers=workspace_headers(token, lines_client['w1']))
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_line_forbidden_cross_workspace(lines_client):
    """User not in W1 cannot GET a W1 line with W1 header."""
    c = lines_client['client']
    token = lines_client['token_owner_w2']
    response = c.get(f"/lines/{lines_client['line_w1_id']}", headers=workspace_headers(token, lines_client['w1']))
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_line_selected_workspace_mismatch_returns_404(lines_client):
    """Line in W1 with header W2 returns 404."""
    c = lines_client['client']
    token = lines_client['token_owner_both']
    response = c.get(f"/lines/{lines_client['line_w1_id']}", headers=workspace_headers(token, lines_client['w2']))
    assert response.status_code == 404
    assert response.json()['detail'] == 'Line not found'


@readonly_db
def test_get_line_ok(lines_client):
    c = lines_client['client']
    response = c.get(
        f"/lines/{lines_client['line_filter_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    body = response.json()
    assert body['uid'] == 'L-FILTER'
    names = {item['sequence']['name'] for item in body['sequences_in_line']}
    assert names == {'alpha beta', 'gamma delta'}


@readonly_db
def test_get_line_seeded_parent_ids_ok(lines_client):
    c = lines_client['client']
    response = c.get(
        f"/lines/{lines_client['line_seeded_parented_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    assert response.json()['parent_ids'] == [lines_client['line_w1_id']]


@readonly_db
def test_get_line_children_ok(lines_client):
    c = lines_client['client']
    response = c.get(
        f"/lines/{lines_client['line_w1_id']}/children",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()}
    assert ids == {lines_client['line_seeded_parented_id']}


@readonly_db
def test_get_line_children_empty_ok(lines_client):
    c = lines_client['client']
    response = c.get(
        f"/lines/{lines_client['line_with_parent_to_be_added']}/children",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    assert response.json() == []


@readonly_db
def test_post_line_viewer_forbidden(lines_client):
    """Viewer cannot create a line."""
    c = lines_client['client']
    token = lines_client['token_viewer_w1']
    response = c.post(
        '/lines',
        headers=workspace_headers(token, lines_client['w1']),
        json={
            'uid': 'L-NEW-VIEWER',
            'allele_ids': [],
            'plasmid_ids': [],
            'parent_ids': [],
        },
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_post_line_owner_ok(lines_client):
    """Owner can create a line with sequences from the same workspace."""
    c = lines_client['client']
    token = lines_client['token_owner_w1']
    response = c.post(
        '/lines',
        headers=workspace_headers(token, lines_client['w1']),
        json={
            'uid': 'L-NEW-OWNER',
            'allele_ids': [lines_client['allele_w1_id']],
            'plasmid_ids': [lines_client['plasmid_w1_id']],
            'parent_ids': [],
        },
    )
    assert response.status_code == 200
    assert response.json()['uid'] == 'L-NEW-OWNER'


def test_post_line_accepts_template_sequence_id(lines_client):
    """Line creation accepts a template sequence id through the existing allele_ids field."""
    c = lines_client['client']
    token = lines_client['token_owner_w1']
    response = c.post(
        '/lines',
        headers=workspace_headers(token, lines_client['w1']),
        json={
            'uid': 'L-NEW-TEMPLATE',
            'allele_ids': [lines_client['template_allele_w1_id']],
            'plasmid_ids': [],
            'parent_ids': [],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body['uid'] == 'L-NEW-TEMPLATE'
    assert [item['sequence']['type'] for item in body['sequences_in_line']] == ['template_sequence']
    assert [item['sequence']['sequence_type'] for item in body['sequences_in_line']] == ['allele']


def test_post_line_duplicate_uid_409(lines_client):
    """POST with an existing line UID (case-insensitive) returns 409."""

    c = lines_client['client']
    response = c.post(
        '/lines',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={
            'uid': 'l-w1',
            'allele_ids': [lines_client['allele_w1_id']],
            'plasmid_ids': [lines_client['plasmid_w1_id']],
            'parent_ids': [],
        },
    )
    assert response.status_code == 409
    assert 'already exists' in response.json()['detail']


def test_post_line_with_parent_ids_ok(lines_client):
    c = lines_client['client']
    response = c.post(
        '/lines',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={
            'uid': 'L-WITH-PARENT',
            'allele_ids': [lines_client['allele_w1_id']],
            'plasmid_ids': [lines_client['plasmid_w1_id']],
            'parent_ids': [lines_client['line_w1_id']],
        },
    )
    assert response.status_code == 200
    assert response.json()['parent_ids'] == [lines_client['line_w1_id']]


@readonly_db
def test_patch_line_viewer_forbidden(lines_client):
    """Viewer cannot PATCH line fields."""
    c = lines_client['client']
    token = lines_client['token_viewer_w1']
    response = c.patch(
        f"/lines/{lines_client['line_w1_id']}",
        headers=workspace_headers(token, lines_client['w1']),
        json={'parent_ids': []},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_lines_invalid_workspace_header_422(lines_client):
    """Non-integer X-Workspace-Id yields 422."""
    assert_get_invalid_workspace_id_422(
        lines_client['client'],
        '/lines',
        lines_client['token_owner_w1'],
        invalid='zzz',
    )


@readonly_db
def test_get_lines_non_member_workspace_w3_forbidden_403(lines_client):
    """User with no access to W3 cannot use W3 header on GET /lines."""
    assert_get_non_member_workspace_403(
        lines_client['client'],
        '/lines',
        lines_client['token_owner_w1'],
        lines_client['w3'],
    )


@readonly_db
def test_get_lines_unauthenticated_401(lines_client):
    """GET /lines without Authorization is rejected."""
    assert_get_unauthenticated_401(
        lines_client['client'],
        '/lines',
        lines_client['w1'],
    )


@readonly_db
def test_post_line_with_allele_from_other_workspace_returns_404(lines_client):
    """Reject W2 allele id when creating a line under W1 (404)."""
    c = lines_client['client']
    tok = lines_client['token_owner_both']
    response = c.post(
        '/lines',
        headers=workspace_headers(tok, lines_client['w1']),
        json={
            'uid': 'L-CROSS-ALLELE',
            'allele_ids': [lines_client['allele_w2_id']],
            'plasmid_ids': [lines_client['plasmid_w1_id']],
            'parent_ids': [],
        },
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'BaseSequence not found'


def test_patch_line_other_workspace_plasmid_404(lines_client):
    """PATCH cannot attach a plasmid that lives in another workspace."""
    c = lines_client['client']
    owner = lines_client['token_owner_w1']
    w1 = lines_client['w1']
    create = c.post(
        '/lines',
        headers=workspace_headers(owner, w1),
        json={
            'uid': 'L-PATCH-PLAS',
            'allele_ids': [lines_client['allele_w1_id']],
            'plasmid_ids': [lines_client['plasmid_w1_id']],
            'parent_ids': [],
        },
    )
    assert create.status_code == 200
    line_id = create.json()['id']

    both = lines_client['token_owner_both']
    response = c.patch(
        f"/lines/{line_id}",
        headers=workspace_headers(both, w1),
        json={'plasmid_ids': [lines_client['plasmid_w2_id']]},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'BaseSequence not found'


def test_patch_line_alleles_success(lines_client):
    c = lines_client['client']
    response = c.patch(
        f"/lines/{lines_client['line_filter_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={'allele_ids': [lines_client['allele_w1_aux_id']]},
    )
    assert response.status_code == 200
    allele_names = {
        item['sequence']['name']
        for item in response.json()['sequences_in_line']
        if item['sequence']['sequence_type'] == 'allele'
    }
    assert allele_names == {'allele-aux'}


def test_patch_line_plasmids_success(lines_client):
    c = lines_client['client']
    response = c.patch(
        f"/lines/{lines_client['line_filter_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={'plasmid_ids': [lines_client['plasmid_w1_id']]},
    )
    assert response.status_code == 200
    plasmid_names = {
        item['sequence']['name']
        for item in response.json()['sequences_in_line']
        if item['sequence']['sequence_type'] == 'plasmid'
    }
    assert plasmid_names == {'plasmid-w1'}


def test_patch_line_parent_ids_success(lines_client):
    c = lines_client['client']
    response = c.patch(
        f"/lines/{lines_client['line_with_parent_to_be_added']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={'parent_ids': [lines_client['line_w1_id']]},
    )
    assert response.status_code == 200
    assert response.json()['parent_ids'] == [lines_client['line_w1_id']]


def test_patch_line_uid_success(lines_client):
    c = lines_client['client']
    response = c.patch(
        f"/lines/{lines_client['line_w1_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={'uid': 'L-W1-RENAMED'},
    )
    assert response.status_code == 200
    assert response.json()['uid'] == 'L-W1-RENAMED'

    response = c.get(
        f"/lines/{lines_client['line_w1_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    assert response.json()['uid'] == 'L-W1-RENAMED'


def test_patch_line_uid_duplicate_409(lines_client):
    """PATCH uid to one already used by another line (case-insensitive) returns 409."""
    c = lines_client['client']
    response = c.patch(
        f"/lines/{lines_client['line_w1_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
        json={'uid': 'l-filter'},
    )
    assert response.status_code == 409
    assert 'already exists' in response.json()['detail']


@readonly_db
def test_post_line_unauthenticated_401(lines_client):
    """POST /lines without Authorization is rejected."""
    assert_post_unauthenticated_401(
        lines_client['client'],
        '/lines',
        lines_client['w1'],
        json={
            'uid': 'L-NO-AUTH',
            'allele_ids': [],
            'plasmid_ids': [],
            'parent_ids': [],
        },
    )


@readonly_db
def test_patch_line_unauthenticated_401(lines_client):
    """PATCH /lines without Authorization is rejected."""
    assert_patch_unauthenticated_401(
        lines_client['client'],
        f"/lines/{lines_client['line_w1_id']}",
        lines_client['w1'],
        json={'parent_ids': []},
    )


@readonly_db
def test_patch_line_self_parent_returns_400(lines_client):
    """A line cannot list itself as its own parent."""
    c = lines_client['client']
    tok = lines_client['token_owner_w1']
    lid = lines_client['line_w1_id']
    response = c.patch(
        f"/lines/{lid}",
        headers=workspace_headers(tok, lines_client['w1']),
        json={'parent_ids': [lid]},
    )
    assert response.status_code == 400
    assert 'cannot be its own parent' in response.json()['detail']


@readonly_db
def test_delete_line_with_children_returns_409(lines_client):
    c = lines_client['client']
    response = c.delete(
        f"/lines/{lines_client['line_w1_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 409
    assert 'has children' in response.json()['detail']


def test_delete_line_without_children_deletes(lines_client):
    c = lines_client['client']
    line_id = lines_client['line_seeded_parented_id']
    response = c.delete(
        f"/lines/{line_id}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    assert response.json() == {'deleted': line_id, 'data': None}

    get_response = c.get(
        f"/lines/{line_id}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert get_response.status_code == 404


def test_delete_line_does_not_exist_returns_404(lines_client):
    c = lines_client['client']
    response = c.delete(
        '/lines/999999',
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Line not found'


def test_post_line_sets_created_by(lines_client):
    """POST /lines attributes creation to the requesting user."""
    c = lines_client['client']
    wid = lines_client['w1']
    response = c.post(
        '/lines',
        headers=workspace_headers(lines_client['token_owner_w1'], wid),
        json={'uid': 'L-CREATED-BY', 'allele_ids': [lines_client['allele_w1_aux_id']]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['created_by'] == {
        'id': lines_client['owner_w1_id'],
        'display_name': 'Owner W1',
    }
    assert body['created_at'] is not None


@readonly_db
def test_get_line_returns_created_at_for_seeded(lines_client):
    """Seeded lines expose created_at and a null created_by."""
    c = lines_client['client']
    response = c.get(
        f"/lines/{lines_client['line_w1_id']}",
        headers=workspace_headers(lines_client['token_owner_w1'], lines_client['w1']),
    )
    assert response.status_code == 200
    body = response.json()
    assert body['created_at'] is not None
    assert body['created_by'] == {'id': lines_client['owner_w1_id'], 'display_name': 'Owner W1'}


def test_get_lines_filter_by_created_by(lines_client):
    """GET /lines?created_by=... filters by creator display_name substring."""
    c = lines_client['client']
    wid = lines_client['w1']
    headers_owner = workspace_headers(lines_client['token_owner_w1'], wid)
    headers_both = workspace_headers(lines_client['token_owner_both'], wid)

    r = c.post(
        '/lines',
        headers=headers_owner,
        json={'uid': 'L-BY-OWNER-W1', 'allele_ids': [lines_client['allele_w1_aux_id']]},
    )
    assert r.status_code == 200, r.text
    line_owner_id = r.json()['id']

    r = c.post(
        '/lines',
        headers=headers_both,
        json={'uid': 'L-BY-OWNER-BOTH'},
    )
    assert r.status_code == 200, r.text
    line_both_id = r.json()['id']

    r = c.get('/lines?created_by=Owner W1', headers=headers_owner)
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    all_owner1_ids = {
        line_owner_id,
        lines_client['line_w1_id'],
        lines_client['line_with_parent_to_be_added'],
        lines_client['line_filter_id'],
        lines_client['line_seeded_parented_id'],
        lines_client['line_tagged_id'],
    }
    assert ids == all_owner1_ids

    r = c.get('/lines?created_by=owner', headers=headers_owner)
    assert r.status_code == 200
    ids = {it['id'] for it in r.json()['items']}
    assert ids == all_owner1_ids | {line_both_id}

    r = c.get('/lines?created_by=nobody', headers=headers_owner)
    assert r.status_code == 200
    assert r.json()['items'] == []


@readonly_db
def test_validate_upload_lines_bulk(lines_client):
    """Validate-upload: sequence flags, UID flags, parent UIDs, and max-two parent_uids (422)."""
    c = lines_client['client']
    owner_headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    viewer_headers = workspace_headers(lines_client['token_viewer_w1'], lines_client['w1'])
    payload = [
        {
            'uid': 'l-w1',
            'genotype': ['allele-w1'],
            'plasmids': ['plasmid-w1'],
            'parent_uids': [],
        },
        {
            'uid': 'L-BULK-DUP',
            'genotype': ['allele-w1'],
            'plasmids': [],
            'parent_uids': [],
        },
        {
            'uid': ' L-BULK-DUP ',
            'genotype': [],
            'plasmids': [],
            'parent_uids': [],
        },
        {
            'uid': 'L-BULK-FRESH',
            'genotype': ['missing-allele'],
            'plasmids': ['plasmid-w1'],
            'parent_uids': [],
        },
        {
            'uid': 'L-BULK-WRONG-TYPE',
            'genotype': ['plasmid-w1'],
            'plasmids': [],
            'parent_uids': [],
        },
        {
            'uid': 'L-BULK-PARENT-OK',
            'genotype': [],
            'plasmids': [],
            'parent_uids': ['l-w1'],
        },
        {
            'uid': 'L-BULK-PARENT-BAD',
            'genotype': [],
            'plasmids': [],
            'parent_uids': ['missing-parent'],
        },
        {
            'uid': 'L-BULK-PARENT-DUP',
            'genotype': [],
            'plasmids': [],
            'parent_uids': ['l-w1', 'l-w1'],
        },
    ]

    r = c.post('/lines/validate-upload', headers=viewer_headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 8

    assert rows[0]['uid_exists'] is True
    assert rows[0]['uid_duplicated'] is False
    assert rows[0]['genotype_flags'][0]['ambiguous'] is True
    assert rows[0]['genotype_flags'][0]['sequence_id'] is None
    assert rows[0]['plasmid_flags'][0]['sequence_id'] == lines_client['plasmid_w1_id']

    assert rows[1]['uid_duplicated'] is True
    assert rows[2]['uid_duplicated'] is True

    assert rows[3]['genotype_flags'][0]['not_found'] is True
    assert rows[3]['plasmid_flags'][0]['sequence_id'] == lines_client['plasmid_w1_id']

    assert rows[4]['genotype_flags'][0]['not_found'] is True

    assert rows[5]['parent_flags'][0]['line_id'] == lines_client['line_w1_id']

    assert rows[6]['parent_flags'][0]['line_id'] is None

    assert len(rows[7]['parent_flags']) == 1
    assert rows[7]['parent_flags'][0]['line_id'] == lines_client['line_w1_id']

    assert c.get(f"/lines/{lines_client['line_w1_id']}", headers=owner_headers).status_code == 200

    too_many = [
        {
            'uid': 'L-BULK-TOO-MANY-PARENTS',
            'genotype': [],
            'plasmids': [],
            'parent_uids': ['L-W1', 'L-W2', 'L-FILTER'],
        },
    ]
    assert c.post('/lines/validate-upload', headers=viewer_headers, json=too_many).status_code == 422


def test_post_lines_bulk_success_including_parents_and_template(lines_client):
    """One bulk create: sequences + template allele, single parent, duplicate parent UIDs deduped."""
    c = lines_client['client']
    headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    payload = [
        {
            'uid': 'L-BULK-M1',
            'genotype': ['allele-aux'],
            'plasmids': ['plasmid-w1'],
            'parent_uids': [],
        },
        {
            'uid': 'L-BULK-M2',
            'genotype': ['template-allele-w1'],
            'plasmids': [],
            'parent_uids': [],
        },
        {
            'uid': 'L-BULK-M3',
            'genotype': ['allele-aux'],
            'plasmids': [],
            'parent_uids': ['L-W1'],
        },
        {
            'uid': 'L-BULK-M4',
            'genotype': ['allele-aux'],
            'plasmids': [],
            'parent_uids': ['L-W1', 'L-W1'],
        },
    ]

    r = c.post('/lines/bulk', headers=headers, json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 4
    expected_keys = {'id', 'uid', 'sequences_in_line', 'parent_ids', 'tags', 'created_at', 'created_by'}
    assert set(rows[0]) == expected_keys

    assert rows[0]['uid'] == 'L-BULK-M1'
    assert len(rows[0]['sequences_in_line']) == 2

    assert rows[1]['uid'] == 'L-BULK-M2'
    assert len(rows[1]['sequences_in_line']) == 1
    assert rows[1]['sequences_in_line'][0]['sequence']['type'] == 'template_sequence'

    assert rows[2]['uid'] == 'L-BULK-M3'
    assert rows[2]['parent_ids'] == [lines_client['line_w1_id']]
    children_r = c.get(f"/lines/{lines_client['line_w1_id']}/children", headers=headers)
    assert children_r.status_code == 200
    assert rows[2]['id'] in {child['id'] for child in children_r.json()}

    assert rows[3]['uid'] == 'L-BULK-M4'
    assert rows[3]['parent_ids'] == [lines_client['line_w1_id']]


def test_post_lines_bulk_409_variants(lines_client):
    """Bulk rejects whole batch: existing line uid, duplicate new uids, ambiguous genotype, missing parent."""
    c = lines_client['client']
    headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    h = headers
    aux = lines_client['allele_w1_aux_id']

    r = c.post(
        '/lines/bulk',
        headers=h,
        json=[
            {'uid': 'L-W1', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []},
            {'uid': 'L-BULK-NOT-CREATED', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []},
        ],
    )
    assert r.status_code == 409
    assert r.json()[0]['uid_exists'] is True
    assert r.json()[1]['uid_exists'] is False
    assert (
        c.post(
            '/lines',
            headers=h,
            json={'uid': 'L-BULK-NOT-CREATED', 'allele_ids': [aux], 'plasmid_ids': [], 'parent_ids': []},
        ).status_code
        == 200
    )

    r = c.post(
        '/lines/bulk',
        headers=h,
        json=[
            {'uid': 'L-BULK-UID-DUP', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []},
            {'uid': 'l-bulk-uid-dup', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []},
        ],
    )
    assert r.status_code == 409
    assert r.json()[0]['uid_duplicated'] is True
    assert (
        c.post(
            '/lines',
            headers=h,
            json={'uid': 'L-BULK-UID-DUP', 'allele_ids': [aux], 'plasmid_ids': [], 'parent_ids': []},
        ).status_code
        == 200
    )

    r = c.post(
        '/lines/bulk',
        headers=h,
        json=[{'uid': 'L-BULK-AMBIG', 'genotype': ['allele-w1'], 'plasmids': [], 'parent_uids': []}],
    )
    assert r.status_code == 409
    assert r.json()[0]['genotype_flags'][0]['ambiguous'] is True
    assert (
        c.post(
            '/lines', headers=h, json={'uid': 'L-BULK-AMBIG', 'allele_ids': [aux], 'plasmid_ids': [], 'parent_ids': []}
        ).status_code
        == 200
    )

    r = c.post(
        '/lines/bulk',
        headers=h,
        json=[
            {
                'uid': 'L-BULK-NO-PARENT',
                'genotype': ['allele-aux'],
                'plasmids': [],
                'parent_uids': ['no-such-parent'],
            },
        ],
    )
    assert r.status_code == 409
    assert r.json()[0]['parent_flags'][0]['line_id'] is None


def test_post_lines_bulk_viewer_forbidden(lines_client):
    c = lines_client['client']
    owner_headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    viewer_headers = workspace_headers(lines_client['token_viewer_w1'], lines_client['w1'])
    payload = [{'uid': 'L-BULK-VIEWER', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []}]

    validate_r = c.post('/lines/validate-upload', headers=viewer_headers, json=payload)
    assert validate_r.status_code == 200

    bulk_r = c.post('/lines/bulk', headers=viewer_headers, json=payload)
    assert bulk_r.status_code == 403
    assert 'Not allowed' in bulk_r.json()['detail']

    create_r = c.post(
        '/lines',
        headers=owner_headers,
        json={
            'uid': 'L-BULK-VIEWER',
            'allele_ids': [lines_client['allele_w1_aux_id']],
            'plasmid_ids': [],
            'parent_ids': [],
        },
    )
    assert create_r.status_code == 200


def test_post_lines_bulk_sequence_type_mismatch(lines_client):
    c = lines_client['client']
    headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    payload = [{'uid': 'L-BULK-MISMATCH', 'genotype': [], 'plasmids': ['alpha beta'], 'parent_uids': []}]

    r = c.post('/lines/bulk', headers=headers, json=payload)
    assert r.status_code == 409
    data = r.json()
    assert data[0]['plasmid_flags'][0]['not_found'] is True

    payload2 = [{'uid': 'L-BULK-MISMATCH', 'genotype': ['plasmid-w1'], 'plasmids': [], 'parent_uids': []}]
    r = c.post('/lines/bulk', headers=headers, json=payload2)
    assert r.status_code == 409
    data = r.json()
    assert data[0]['genotype_flags'][0]['not_found'] is True

    payload3 = [{'uid': 'L-BULK-OK', 'genotype': ['alpha beta'], 'plasmids': ['plasmid-w1'], 'parent_uids': []}]
    r = c.post('/lines/bulk', headers=headers, json=payload3)
    assert r.status_code == 200


def test_post_lines_bulk_applies_tags(lines_client):
    c = lines_client['client']
    headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    tag_id = lines_client['tag_filter_id']
    payload = [
        {'uid': 'L-BULK-TAG-1', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []},
        {'uid': 'L-BULK-TAG-2', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []},
    ]

    r = c.post('/lines/bulk', headers=headers, params=[('tags', str(tag_id))], json=payload)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    for row in rows:
        assert {t['id'] for t in row['tags']} == {tag_id}
        tags_r = c.get(f"/lines/{row['id']}/tags", headers=headers)
        assert tags_r.status_code == 200
        assert {t['id'] for t in tags_r.json()} == {tag_id}


def test_post_lines_bulk_unknown_tag_404(lines_client):
    c = lines_client['client']
    headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    payload = [{'uid': 'L-BULK-NO-TAG', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []}]

    r = c.post('/lines/bulk', headers=headers, params=[('tags', '999999')], json=payload)
    assert r.status_code == 404
    assert r.json()['detail'] == 'Tag not found'

    create_r = c.post(
        '/lines',
        headers=headers,
        json={
            'uid': 'L-BULK-NO-TAG',
            'allele_ids': [lines_client['allele_w1_aux_id']],
            'plasmid_ids': [],
            'parent_ids': [],
        },
    )
    assert create_r.status_code == 200


def test_post_lines_bulk_cross_workspace_tag_403(lines_client):
    c = lines_client['client']
    headers = workspace_headers(lines_client['token_owner_w1'], lines_client['w1'])
    payload = [{'uid': 'L-BULK-WRONG-TAG', 'genotype': ['allele-aux'], 'plasmids': [], 'parent_uids': []}]

    r = c.post(
        '/lines/bulk',
        headers=headers,
        params=[('tags', str(lines_client['tag_w2_id']))],
        json=payload,
    )
    assert r.status_code == 403

    create_r = c.post(
        '/lines',
        headers=headers,
        json={
            'uid': 'L-BULK-WRONG-TAG',
            'allele_ids': [lines_client['allele_w1_aux_id']],
            'plasmid_ids': [],
            'parent_ids': [],
        },
    )
    assert create_r.status_code == 200
