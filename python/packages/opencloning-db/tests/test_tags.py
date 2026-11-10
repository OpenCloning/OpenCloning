"""Tags routes: workspace scoping and membership."""

import pytest
from sqlalchemy.orm import Session

from opencloning_db.models import Line, Primer, Tag

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
def tags_client(request):
    """Seed read-only or write DB based on ``readonly_db`` marker."""
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_tags_client_readonly')
    engine, client, _ = request.getfixturevalue('engine_client_config_write')
    return attach_standard_tokens(_seed_tags_context(engine), client)


@pytest.fixture(scope='module')
def _tags_client_readonly(engine_client_config_readonly):
    engine, client, _ = engine_client_config_readonly
    return attach_standard_tokens(_seed_tags_context(engine), client)


readonly_db = pytest.mark.readonly_db


def _seed_tags_context(engine):
    with Session(engine) as session:
        ctx = seed_standard_users(session)

        primer_w1 = Primer(
            workspace_id=ctx['w1'],
            uid_workspace_id=ctx['w1'],
            name='primer-w1',
            sequence='ATGC',
            created_by_id=ctx['owner_w1_id'],
        )
        primer_w2 = Primer(
            workspace_id=ctx['w2'],
            uid_workspace_id=ctx['w2'],
            name='primer-w2',
            sequence='ATGC',
            created_by_id=ctx['owner_w2_id'],
        )
        line_w1 = Line(workspace_id=ctx['w1'], uid='line-w1', created_by_id=ctx['owner_w1_id'])
        line_w2 = Line(workspace_id=ctx['w2'], uid='line-w2', created_by_id=ctx['owner_w2_id'])
        tag_w1 = Tag(name='tag-w1', workspace_id=ctx['w1'])
        tag_w1_free = Tag(name='tag-w1-free', workspace_id=ctx['w1'])
        tag_w2 = Tag(name='tag-w2', workspace_id=ctx['w2'])
        # Pre-link one primer/line to the same-workspace tag for conflict/listing tests.
        primer_w1.tags.append(tag_w1)
        line_w1.tags.append(tag_w1)
        session.add_all([primer_w1, primer_w2, line_w1, line_w2, tag_w1, tag_w1_free, tag_w2])
        session.flush()
        session.commit()

        ctx.update(
            {
                'tag_w1_id': tag_w1.id,
                'tag_w1_free_id': tag_w1_free.id,
                'tag_w2_id': tag_w2.id,
                'primer_w1_id': primer_w1.id,
                'primer_w2_id': primer_w2.id,
                'line_w1_id': line_w1.id,
                'line_w2_id': line_w2.id,
            }
        )
    return ctx


@readonly_db
def test_get_tags_requires_workspace_id(tags_client):
    """GET /tags without X-Workspace-Id fails validation (422)."""
    assert_get_missing_workspace_header_422(
        tags_client['client'],
        '/tags',
        tags_client['token_owner_w1'],
    )


@readonly_db
def test_get_tags_scoped_to_workspace(tags_client):
    """Listed tags are limited to the selected workspace."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.get(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 200
    names = {item['name'] for item in response.json()}
    assert names == {'tag-w1', 'tag-w1-free'}


@readonly_db
def test_get_tags_forbidden_non_member(tags_client):
    """User who is not a member of the header workspace cannot list tags."""
    c = tags_client['client']
    tok = tags_client['token_owner_w2']
    response = c.get(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_post_tag_viewer_forbidden(tags_client):
    """Workspace viewer cannot create tags."""
    c = tags_client['client']
    tok = tags_client['token_viewer_w1']
    response = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={'name': 'viewer-new'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_post_tag_conflict_same_workspace(tags_client):
    """Duplicate tag name in the same workspace returns 409."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={'name': 'tag-w1'},
    )
    assert response.status_code == 409
    assert 'already exists' in response.json()['detail']


def test_post_tag_owner_success(tags_client):
    """Owner can create a new tag in their workspace."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={'name': 'tag-created'},
    )
    assert response.status_code == 200
    assert response.json()['name'] == 'tag-created'


@readonly_db
def test_get_tag_viewer_ok(tags_client):
    """Viewer can read a tag in a workspace they belong to."""
    c = tags_client['client']
    tok = tags_client['token_viewer_w1']
    response = c.get(
        f"/tags/{tags_client['tag_w1_id']}",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 200
    assert response.json()['name'] == 'tag-w1'


@readonly_db
def test_get_tag_forbidden_cross_workspace(tags_client):
    """User with no access to the header workspace cannot read a tag by id."""
    c = tags_client['client']
    tok = tags_client['token_owner_w2']
    response = c.get(
        f"/tags/{tags_client['tag_w1_id']}",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_tag_selected_workspace_mismatch_returns_404(tags_client):
    """Tag in another workspace than header: 404 (no existence leak)."""
    c = tags_client['client']
    tok = tags_client['token_owner_both']
    response = c.get(
        f"/tags/{tags_client['tag_w2_id']}",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Tag not found'


@readonly_db
def test_get_entity_tags_selected_workspace_mismatch_returns_404(tags_client):
    """W2 entity with W1 header: 404 for entity tags listing."""
    c = tags_client['client']
    tok = tags_client['token_owner_both']
    response = c.get(
        f"/input_entities/{tags_client['primer_w2_id']}/tags",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'InputEntity not found'


@readonly_db
def test_get_tag_entities_lists_linked_input_entities(tags_client):
    """GET /tags/{id}/input_entities returns linked sequence/primer refs."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    response = c.get(
        f"/tags/{tags_client['tag_w1_id']}/input_entities",
        headers=workspace_headers(tok, w1),
    )
    assert response.status_code == 200
    ids = {item['id'] for item in response.json()}
    assert ids == {tags_client['primer_w1_id']}


@readonly_db
def test_attach_input_entity_tag_cross_workspace_blocked(tags_client):
    """Cannot attach a tag from workspace W2 to an entity in W1."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.post(
        f"/input_entities/{tags_client['primer_w1_id']}/tags",
        headers=workspace_headers(tok, tags_client['w1']),
        json={'tag_id': tags_client['tag_w2_id']},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Tag not found'


def test_attach_input_entity_tag_ok_and_remove(tags_client):
    """Owner attaches same-workspace tag to input entity, then removes it."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    attach = c.post(
        f"/input_entities/{tags_client['primer_w1_id']}/tags",
        headers=workspace_headers(tok, w1),
        json={'tag_id': tags_client['tag_w1_free_id']},
    )
    assert attach.status_code == 200
    assert attach.json()['id'] == tags_client['tag_w1_free_id']

    remove = c.delete(
        f"/input_entities/{tags_client['primer_w1_id']}/tags/" f"{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(tok, w1),
    )
    assert remove.status_code == 200
    assert remove.json() is not None


@readonly_db
def test_attach_input_entity_tag_conflict_409(tags_client):
    """Attaching an already-linked tag to an entity returns 409."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    again = c.post(
        f"/input_entities/{tags_client['primer_w1_id']}/tags",
        headers=workspace_headers(tok, w1),
        json={'tag_id': tags_client['tag_w1_id']},
    )
    assert again.status_code == 409
    assert 'already' in again.json()['detail'].lower()


@readonly_db
def test_delete_input_entity_tag_not_found_tag_404(tags_client):
    """Removing with a non-existent tag id returns 404."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.delete(
        f"/input_entities/{tags_client['primer_w1_id']}/tags/999999",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Tag not found'


@readonly_db
def test_delete_input_entity_tag_unlinked_404(tags_client):
    """Removing a tag that is not linked to the entity returns 404."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.delete(
        f"/input_entities/{tags_client['primer_w1_id']}/tags/{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert response.status_code == 404
    assert 'not linked' in response.json()['detail'].lower()


@readonly_db
def test_attach_line_tag_cross_workspace_blocked(tags_client):
    """Cannot attach a W2 tag to a W1 line."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    response = c.post(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(tok, tags_client['w1']),
        json={'tag_id': tags_client['tag_w2_id']},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Tag not found'


def test_remove_line_tag_viewer_forbidden(tags_client):
    """Viewer cannot remove a tag from a line after owner attached it."""
    c = tags_client['client']
    owner_tok = tags_client['token_owner_w1']
    viewer_tok = tags_client['token_viewer_w1']
    w1 = tags_client['w1']
    attach = c.post(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(owner_tok, w1),
        json={'tag_id': tags_client['tag_w1_free_id']},
    )
    assert attach.status_code == 200

    remove = c.delete(
        f"/lines/{tags_client['line_w1_id']}/tags/{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(viewer_tok, w1),
    )
    assert remove.status_code == 403
    assert 'Not allowed' in remove.json()['detail']


@readonly_db
def test_get_tags_invalid_workspace_id_header_422(tags_client):
    """Non-integer X-Workspace-Id is rejected by FastAPI (422)."""
    assert_get_invalid_workspace_id_422(
        tags_client['client'],
        '/tags',
        tags_client['token_owner_w1'],
        invalid='not-an-int',
    )


@readonly_db
def test_get_tags_non_member_workspace_w3_forbidden_403(tags_client):
    """User not in W3 gets 403 when X-Workspace-Id is W3."""
    assert_get_non_member_workspace_403(
        tags_client['client'],
        '/tags',
        tags_client['token_owner_w1'],
        tags_client['w3'],
    )


@readonly_db
def test_get_tags_unauthenticated_401(tags_client):
    """GET /tags without Authorization is rejected."""
    assert_get_unauthenticated_401(
        tags_client['client'],
        '/tags',
        tags_client['w1'],
    )


@readonly_db
def test_post_tag_empty_name_422(tags_client):
    """Empty tag name is rejected (422)."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    r = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={'name': ''},
    )
    assert r.status_code == 422
    assert r.json()['detail']


@readonly_db
def test_post_tag_whitespace_only_name_422(tags_client):
    """Whitespace-only name strips to empty and fails validation (422)."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    r = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={'name': '   '},
    )
    assert r.status_code == 422
    assert r.json()['detail']


@readonly_db
def test_post_tag_missing_name_422(tags_client):
    """POST /tags without name field is rejected (422)."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    r = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={},
    )
    assert r.status_code == 422
    assert r.json()['detail']


@readonly_db
def test_attach_input_entity_tag_viewer_forbidden(tags_client):
    """Viewer cannot attach tags to an input entity."""
    c = tags_client['client']
    tok = tags_client['token_viewer_w1']
    response = c.post(
        f"/input_entities/{tags_client['primer_w1_id']}/tags",
        headers=workspace_headers(tok, tags_client['w1']),
        json={'tag_id': tags_client['tag_w1_id']},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_delete_input_entity_tag_viewer_forbidden(tags_client):
    """Viewer cannot remove a tag from an input entity."""
    c = tags_client['client']
    owner = tags_client['token_owner_w1']
    viewer = tags_client['token_viewer_w1']
    w1 = tags_client['w1']
    attach = c.post(
        f"/input_entities/{tags_client['primer_w1_id']}/tags",
        headers=workspace_headers(owner, w1),
        json={'tag_id': tags_client['tag_w1_free_id']},
    )
    assert attach.status_code == 200
    remove = c.delete(
        f"/input_entities/{tags_client['primer_w1_id']}/tags/" f"{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(viewer, w1),
    )
    assert remove.status_code == 403
    assert 'Not allowed' in remove.json()['detail']


def test_delete_input_entity_tag_non_member_forbidden(tags_client):
    """Non-member cannot DELETE tag from input entity in another workspace."""
    c = tags_client['client']
    owner = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    attach = c.post(
        f"/input_entities/{tags_client['primer_w1_id']}/tags",
        headers=workspace_headers(owner, w1),
        json={'tag_id': tags_client['tag_w1_free_id']},
    )
    assert attach.status_code == 200
    remove = c.delete(
        f"/input_entities/{tags_client['primer_w1_id']}/tags/" f"{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(tags_client['token_owner_w2'], w1),
    )
    assert remove.status_code == 403
    assert 'Not allowed' in remove.json()['detail']


@readonly_db
def test_post_line_tag_viewer_forbidden(tags_client):
    """Viewer cannot POST attach a tag to a line."""
    c = tags_client['client']
    response = c.post(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(
            tags_client['token_viewer_w1'],
            tags_client['w1'],
        ),
        json={'tag_id': tags_client['tag_w1_id']},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_post_line_tag_non_member_forbidden(tags_client):
    """Non-member cannot POST a line tag using another workspace header."""
    c = tags_client['client']
    response = c.post(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(
            tags_client['token_owner_w2'],
            tags_client['w1'],
        ),
        json={'tag_id': tags_client['tag_w1_id']},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


def test_remove_line_tag_non_member_forbidden(tags_client):
    """Non-member of header workspace cannot DELETE line tags."""
    c = tags_client['client']
    owner_tok = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    attach = c.post(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(owner_tok, w1),
        json={'tag_id': tags_client['tag_w1_free_id']},
    )
    assert attach.status_code == 200

    other_tok = tags_client['token_owner_w2']
    remove = c.delete(
        f"/lines/{tags_client['line_w1_id']}/tags/{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(other_tok, w1),
    )
    assert remove.status_code == 403
    assert 'Not allowed' in remove.json()['detail']


@readonly_db
def test_get_line_tags_success(tags_client):
    """GET /lines/{id}/tags returns tags linked to line."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    response = c.get(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(tok, w1),
    )
    assert response.status_code == 200
    names = {item['name'] for item in response.json()}
    assert names == {'tag-w1'}


def test_remove_line_tag_success(tags_client):
    """Owner can remove a linked tag from a line."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    w1 = tags_client['w1']
    attach = c.post(
        f"/lines/{tags_client['line_w1_id']}/tags",
        headers=workspace_headers(tok, w1),
        json={'tag_id': tags_client['tag_w1_free_id']},
    )
    assert attach.status_code == 200
    assert attach.json()['id'] == tags_client['tag_w1_free_id']
    remove = c.delete(
        f"/lines/{tags_client['line_w1_id']}/tags/{tags_client['tag_w1_free_id']}",
        headers=workspace_headers(tok, w1),
    )
    assert remove.status_code == 200
    assert remove.json() is not None


def test_delete_tag_success(tags_client):
    """Owner can delete a tag in their workspace."""
    c = tags_client['client']
    tok = tags_client['token_owner_w1']
    create = c.post(
        '/tags',
        headers=workspace_headers(tok, tags_client['w1']),
        json={'name': 'to-delete'},
    )
    assert create.status_code == 200
    tag_id = create.json()['id']
    delete = c.delete(
        f"/tags/{tag_id}",
        headers=workspace_headers(tok, tags_client['w1']),
    )
    assert delete.status_code == 200
    assert delete.json() is not None
