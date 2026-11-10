"""Workspace listing endpoint tests."""

import pytest
from sqlalchemy.orm import Session

from .helpers import (
    attach_standard_tokens,
    bearer_headers,
    seed_standard_users,
)


@pytest.fixture
def workspaces_client(request):
    if request.node.get_closest_marker('readonly_db'):
        return request.getfixturevalue('_workspaces_client_readonly')
    engine, client, _ = request.getfixturevalue('engine_client_config_write')
    return _seed_workspaces_context(engine, client)


@pytest.fixture(scope='module')
def _workspaces_client_readonly(engine_client_config_readonly):
    engine, client, _ = engine_client_config_readonly
    return _seed_workspaces_context(engine, client)


readonly_db = pytest.mark.readonly_db


def _seed_workspaces_context(engine, client):
    with Session(engine) as session:
        ctx = seed_standard_users(session)
        session.commit()

    attach_standard_tokens(ctx, client)
    ctx['token'] = ctx['token_owner_w1_viewer_w2']
    return ctx


@readonly_db
def test_get_workspaces_lists_only_user_accessible(workspaces_client):
    """List workspaces returns only this user's memberships and roles."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.get('/workspaces', headers=bearer_headers(tok))
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    assert data[0]['name'] == 'Workspace One'
    assert data[0]['role'] == 'owner'
    assert data[1]['name'] == 'Workspace Two'
    assert data[1]['role'] == 'viewer'


@readonly_db
def test_get_workspace_by_id_member_ok(workspaces_client):
    """Member can GET workspace by id from fixture (not hardcoded)."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    wid = workspaces_client['w1']
    response = c.get(
        f"/workspaces/{wid}",
        headers=bearer_headers(tok),
    )
    assert response.status_code == 200
    body = response.json()
    assert body['id'] == wid
    assert body['name'] == 'Workspace One'
    assert body['role'] == 'owner'


@readonly_db
def test_get_workspace_by_id_not_found(workspaces_client):
    """GET unknown workspace id returns 404."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.get(
        '/workspaces/999999',
        headers=bearer_headers(tok),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Workspace not found'


@readonly_db
def test_get_workspace_by_id_forbidden_non_member(workspaces_client):
    """User with no access to a workspace gets 403 when fetching it by id."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.get(
        f"/workspaces/{workspaces_client['w3']}",
        headers=bearer_headers(tok),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_create_workspace_forbidden_non_admin(workspaces_client):
    """Non-instance-admin users cannot POST /workspaces."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.post(
        '/workspaces',
        headers=bearer_headers(tok),
        json={'name': 'Should Not Work'},
    )
    assert response.status_code == 403
    assert response.json()['detail'] == 'Only instance admins can create workspaces'


def test_create_workspace_creates_owner_membership(workspaces_client):
    """Instance admin POST /workspaces creates workspace and becomes owner."""
    c = workspaces_client['client']
    tok = workspaces_client['token_instance_admin']
    response = c.post(
        '/workspaces',
        headers=bearer_headers(tok),
        json={'name': 'My Created Workspace'},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['id'] > 0
    assert body['name'] == 'My Created Workspace'
    assert body['role'] == 'owner'

    list_response = c.get(
        '/workspaces',
        headers=bearer_headers(tok),
    )
    assert list_response.status_code == 200
    names = {workspace['name'] for workspace in list_response.json()}
    assert names == {'My Created Workspace'}


def test_patch_workspace_owner_can_rename(workspaces_client):
    """Workspace owner can PATCH the workspace name."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.patch(
        f"/workspaces/{workspaces_client['w1']}",
        headers=bearer_headers(tok),
        json={'name': 'Workspace One Renamed'},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['id'] == workspaces_client['w1']
    assert body['name'] == 'Workspace One Renamed'
    assert body['role'] == 'owner'

    get_response = c.get(
        f"/workspaces/{workspaces_client['w1']}",
        headers=bearer_headers(tok),
    )
    assert get_response.status_code == 200
    assert get_response.json()['name'] == 'Workspace One Renamed'


@readonly_db
def test_patch_workspace_forbidden_for_viewer(workspaces_client):
    """Workspace viewer cannot rename the workspace."""
    c = workspaces_client['client']
    tok = workspaces_client['token_viewer_w1']
    response = c.patch(
        f"/workspaces/{workspaces_client['w1']}",
        headers=bearer_headers(tok),
        json={'name': 'Should Not Work'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_patch_workspace_not_found(workspaces_client):
    """PATCH unknown workspace id returns 404."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.patch(
        '/workspaces/999999',
        headers=bearer_headers(tok),
        json={'name': 'Missing'},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Workspace not found'


@readonly_db
def test_patch_workspace_forbidden_for_non_member(workspaces_client):
    """User who is not a member cannot PATCH another workspace."""
    c = workspaces_client['client']
    tok = workspaces_client['token_owner_w2']
    response = c.patch(
        f"/workspaces/{workspaces_client['w1']}",
        headers=bearer_headers(tok),
        json={'name': 'Should Not Work'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_workspaces_unauthenticated_401(workspaces_client):
    """Listing workspaces without a bearer token is rejected."""
    c = workspaces_client['client']
    response = c.get('/workspaces')
    assert response.status_code == 401
    assert response.json()['detail'] == 'Could not validate credentials'


@readonly_db
def test_get_workspace_by_id_unauthenticated_401(workspaces_client):
    """Fetching a workspace by id without a bearer token is rejected."""
    c = workspaces_client['client']
    response = c.get(f"/workspaces/{workspaces_client['w1']}")
    assert response.status_code == 401
    assert response.json()['detail'] == 'Could not validate credentials'


@readonly_db
def test_create_workspace_empty_name_422(workspaces_client):
    """Workspace name must be non-empty (Pydantic min_length=1)."""
    c = workspaces_client['client']
    tok = workspaces_client['token_instance_admin']
    response = c.post(
        '/workspaces',
        headers=bearer_headers(tok),
        json={'name': ''},
    )
    assert response.status_code == 422
    assert response.json()['detail']


@readonly_db
def test_patch_workspace_empty_name_422(workspaces_client):
    """Workspace rename rejects an empty name."""
    c = workspaces_client['client']
    tok = workspaces_client['token']
    response = c.patch(
        f"/workspaces/{workspaces_client['w1']}",
        headers=bearer_headers(tok),
        json={'name': ''},
    )
    assert response.status_code == 422
    assert response.json()['detail']


def _users_path(workspace_id: int) -> str:
    return f'/workspaces/{workspace_id}/users'


def _user_path(workspace_id: int, user_id: int) -> str:
    return f'/workspaces/{workspace_id}/users/{user_id}'


@readonly_db
def test_get_workspace_users_owner_lists_members(workspaces_client):
    """Workspace owner can list all members with roles."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    response = c.get(_users_path(wid), headers=bearer_headers(tok))
    assert response.status_code == 200

    by_id = {user['id']: user for user in response.json()}
    assert len(by_id) == 5
    assert by_id[workspaces_client['owner_w1_id']]['role'] == 'owner'
    assert by_id[workspaces_client['viewer_w1_id']]['role'] == 'viewer'
    assert by_id[workspaces_client['owner_both_id']]['role'] == 'owner'
    assert by_id[workspaces_client['owner_w1_viewer_w2_id']]['role'] == 'owner'
    assert by_id[workspaces_client['editor_w1_id']]['role'] == 'editor'


@readonly_db
def test_get_workspace_users_forbidden_for_editor(workspaces_client):
    """Workspace editor cannot list members."""
    c = workspaces_client['client']
    response = c.get(
        _users_path(workspaces_client['w1']),
        headers=bearer_headers(workspaces_client['token_editor_w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_workspace_users_forbidden_for_non_member(workspaces_client):
    """Non-member cannot list workspace users."""
    c = workspaces_client['client']
    response = c.get(
        _users_path(workspaces_client['w1']),
        headers=bearer_headers(workspaces_client['token_owner_w2']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_get_workspace_users_not_found(workspaces_client):
    """GET users for unknown workspace id returns 404."""
    c = workspaces_client['client']
    response = c.get(
        _users_path(999999),
        headers=bearer_headers(workspaces_client['token_owner_w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Workspace not found'


@readonly_db
def test_get_workspace_users_unauthenticated_401(workspaces_client):
    """Listing workspace users without a bearer token is rejected."""
    c = workspaces_client['client']
    response = c.get(_users_path(workspaces_client['w1']))
    assert response.status_code == 401
    assert response.json()['detail'] == 'Could not validate credentials'


def test_post_workspace_user_adds_new_member(workspaces_client):
    """Owner can add an existing user to the workspace."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    response = c.post(
        _users_path(wid),
        headers=bearer_headers(tok),
        json={'email': workspaces_client['instance_admin_email'], 'role': 'viewer'},
    )
    assert response.status_code == 201
    body = response.json()
    assert body['id'] == workspaces_client['instance_admin_id']
    assert body['role'] == 'viewer'

    list_response = c.get(_users_path(wid), headers=bearer_headers(tok))
    assert list_response.status_code == 200
    assert workspaces_client['instance_admin_id'] in {user['id'] for user in list_response.json()}


@readonly_db
def test_post_workspace_user_unknown_email_404(workspaces_client):
    """POST with unknown email returns 404."""
    c = workspaces_client['client']
    response = c.post(
        _users_path(workspaces_client['w1']),
        headers=bearer_headers(workspaces_client['token_owner_w1']),
        json={'email': 'nobody@example.com', 'role': 'viewer'},
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'User not found'


@readonly_db
def test_post_workspace_user_idempotent_same_role(workspaces_client):
    """POST for an existing member with the same role returns 200."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    payload = {'email': workspaces_client['viewer_w1_email'], 'role': 'viewer'}
    response = c.post(_users_path(wid), headers=bearer_headers(tok), json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body['id'] == workspaces_client['viewer_w1_id']
    assert body['role'] == 'viewer'


@readonly_db
def test_post_workspace_user_forbidden_for_editor(workspaces_client):
    """Workspace editor cannot add or update members."""
    c = workspaces_client['client']
    response = c.post(
        _users_path(workspaces_client['w1']),
        headers=bearer_headers(workspaces_client['token_editor_w1']),
        json={'email': workspaces_client['instance_admin_email'], 'role': 'viewer'},
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_post_workspace_user_invalid_role_422(workspaces_client):
    """POST rejects an invalid role value."""
    c = workspaces_client['client']
    response = c.post(
        _users_path(workspaces_client['w1']),
        headers=bearer_headers(workspaces_client['token_owner_w1']),
        json={'email': workspaces_client['instance_admin_email'], 'role': 'superuser'},
    )
    assert response.status_code == 422
    assert response.json()['detail']


def test_post_workspace_user_updates_role(workspaces_client):
    """Owner can change an existing member's role."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    response = c.post(
        _users_path(wid),
        headers=bearer_headers(tok),
        json={'email': workspaces_client['viewer_w1_email'], 'role': 'editor'},
    )
    assert response.status_code == 200
    assert response.json()['role'] == 'editor'

    list_response = c.get(_users_path(wid), headers=bearer_headers(tok))
    by_id = {user['id']: user for user in list_response.json()}
    assert by_id[workspaces_client['viewer_w1_id']]['role'] == 'editor'


def test_post_workspace_user_demotes_one_of_many_owners(workspaces_client):
    """Owner can demote another owner when other owners remain."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    response = c.post(
        _users_path(wid),
        headers=bearer_headers(tok),
        json={'email': workspaces_client['owner_both_email'], 'role': 'viewer'},
    )
    assert response.status_code == 200
    assert response.json()['role'] == 'viewer'


def test_post_workspace_user_last_owner_guard(workspaces_client):
    """Sole owner cannot demote themselves; can after promoting another owner."""
    c = workspaces_client['client']
    admin_tok = workspaces_client['token_instance_admin']
    create_response = c.post(
        '/workspaces',
        headers=bearer_headers(admin_tok),
        json={'name': 'Sole Owner Workspace'},
    )
    assert create_response.status_code == 200
    wid = create_response.json()['id']

    demote_response = c.post(
        _users_path(wid),
        headers=bearer_headers(admin_tok),
        json={'email': workspaces_client['instance_admin_email'], 'role': 'viewer'},
    )
    assert demote_response.status_code == 409
    assert demote_response.json()['detail'] == 'Workspace must have at least one owner'

    promote_response = c.post(
        _users_path(wid),
        headers=bearer_headers(admin_tok),
        json={'email': workspaces_client['viewer_w1_email'], 'role': 'owner'},
    )
    assert promote_response.status_code == 201
    assert promote_response.json()['role'] == 'owner'

    demote_response = c.post(
        _users_path(wid),
        headers=bearer_headers(admin_tok),
        json={'email': workspaces_client['instance_admin_email'], 'role': 'viewer'},
    )
    assert demote_response.status_code == 200
    assert demote_response.json()['role'] == 'viewer'


def test_post_workspace_user_integrity_error_returns_409(workspaces_client, monkeypatch):
    """IntegrityError during commit (race after membership check) returns 409."""
    from sqlalchemy.exc import IntegrityError

    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    original_commit = Session.commit
    call_count = [0]

    def commit_raising_once(self):
        call_count[0] += 1
        if call_count[0] == 1:
            raise IntegrityError('mock', {}, Exception())
        return original_commit(self)

    monkeypatch.setattr(Session, 'commit', commit_raising_once)

    response = c.post(
        _users_path(wid),
        headers=bearer_headers(tok),
        json={'email': workspaces_client['instance_admin_email'], 'role': 'viewer'},
    )
    assert response.status_code == 409
    assert response.json()['detail'] == 'User is already a member of this workspace'


def test_delete_workspace_user_removes_member(workspaces_client):
    """Owner can remove a non-owner member from the workspace."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    tok = workspaces_client['token_owner_w1']
    user_id = workspaces_client['viewer_w1_id']

    response = c.delete(_user_path(wid, user_id), headers=bearer_headers(tok))
    assert response.status_code == 200
    assert response.json()['deleted'] == user_id

    list_response = c.get(_users_path(wid), headers=bearer_headers(tok))
    assert user_id not in {user['id'] for user in list_response.json()}


@readonly_db
def test_delete_workspace_user_not_a_member_404(workspaces_client):
    """DELETE for a user who is not a workspace member returns 404."""
    c = workspaces_client['client']
    response = c.delete(
        _user_path(workspaces_client['w1'], workspaces_client['instance_admin_id']),
        headers=bearer_headers(workspaces_client['token_owner_w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'User is not a member of this workspace'


@readonly_db
def test_delete_workspace_user_forbidden_for_editor(workspaces_client):
    """Workspace editor cannot remove members."""
    c = workspaces_client['client']
    response = c.delete(
        _user_path(workspaces_client['w1'], workspaces_client['viewer_w1_id']),
        headers=bearer_headers(workspaces_client['token_editor_w1']),
    )
    assert response.status_code == 403
    assert 'Not allowed' in response.json()['detail']


@readonly_db
def test_delete_workspace_user_workspace_not_found(workspaces_client):
    """DELETE for unknown workspace id returns 404."""
    c = workspaces_client['client']
    response = c.delete(
        _user_path(999999, workspaces_client['viewer_w1_id']),
        headers=bearer_headers(workspaces_client['token_owner_w1']),
    )
    assert response.status_code == 404
    assert response.json()['detail'] == 'Workspace not found'


@readonly_db
def test_delete_workspace_user_unauthenticated_401(workspaces_client):
    """Removing a workspace member without a bearer token is rejected."""
    c = workspaces_client['client']
    response = c.delete(
        _user_path(workspaces_client['w1'], workspaces_client['viewer_w1_id']),
    )
    assert response.status_code == 401
    assert response.json()['detail'] == 'Could not validate credentials'


@readonly_db
def test_delete_workspace_user_cannot_remove_self(workspaces_client):
    """Owner cannot remove themselves; another owner must do it."""
    c = workspaces_client['client']
    wid = workspaces_client['w1']
    owner_id = workspaces_client['owner_w1_id']
    response = c.delete(
        _user_path(wid, owner_id),
        headers=bearer_headers(workspaces_client['token_owner_w1']),
    )
    assert response.status_code == 403
    assert response.json()['detail'] == 'Cannot remove yourself from the workspace'


def test_delete_workspace_user_removed_by_another_owner(workspaces_client):
    """Another owner can remove a member after a second owner is added."""
    c = workspaces_client['client']
    admin_tok = workspaces_client['token_instance_admin']
    create_response = c.post(
        '/workspaces',
        headers=bearer_headers(admin_tok),
        json={'name': 'Sole Owner Delete Workspace'},
    )
    assert create_response.status_code == 200
    wid = create_response.json()['id']
    admin_id = workspaces_client['instance_admin_id']

    self_remove = c.delete(_user_path(wid, admin_id), headers=bearer_headers(admin_tok))
    assert self_remove.status_code == 403
    assert self_remove.json()['detail'] == 'Cannot remove yourself from the workspace'

    promote_response = c.post(
        _users_path(wid),
        headers=bearer_headers(admin_tok),
        json={'email': workspaces_client['viewer_w1_email'], 'role': 'owner'},
    )
    assert promote_response.status_code == 201

    remove_response = c.delete(
        _user_path(wid, admin_id),
        headers=bearer_headers(workspaces_client['token_viewer_w1']),
    )
    assert remove_response.status_code == 200
    assert remove_response.json()['deleted'] == admin_id
