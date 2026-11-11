"""Shared test utilities for workspace resource fixtures."""

TEST_AUTH_PROVIDER = 'oidc:test.example'

_STANDARD_EMAILS = {
    'owner_w1': 'owner-w1@test.com',
    'owner_w2': 'owner-w2@test.com',
    'viewer_w1': 'viewer-w1@test.com',
    'owner_both': 'owner-both@test.com',
    'owner_w1_viewer_w2': 'owner-w1-viewer-w2@test.com',
    'instance_admin': 'instance-admin@test.com',
    'editor_w1': 'editor-w1@test.com',
}

_STANDARD_SUBJECTS = {
    'owner_w1': 'owner-w1',
    'owner_w2': 'owner-w2',
    'viewer_w1': 'viewer-w1',
    'owner_both': 'owner-both',
    'owner_w1_viewer_w2': 'owner-w1-viewer-w2',
    'instance_admin': 'instance-admin',
    'editor_w1': 'editor-w1',
}

_STANDARD_DISPLAY_NAMES = {
    'owner_w1': 'Owner W1',
    'owner_w2': 'Owner W2',
    'viewer_w1': 'Viewer W1',
    'owner_both': 'Owner Both',
    'owner_w1_viewer_w2': 'Owner W1 Viewer W2',
    'instance_admin': 'Instance Admin',
    'editor_w1': 'Editor W1',
}


def make_test_bearer_token(subject: str, display_name: str, email: str | None = None) -> str:
    if email:
        return f'test:{subject}|{email}|{display_name}'
    return f'test:{subject}|{display_name}'


def bearer_headers(token: str) -> dict[str, str]:
    """Return ``Authorization: Bearer`` header only."""
    return {'Authorization': f"Bearer {token}"}


def workspace_headers(
    token: str,
    workspace_id: int | str,
    extra: dict[str, str] | None = None,
) -> dict[str, str]:
    """Bearer plus ``X-Workspace-Id`` (coerced to str).

    *extra* merges additional headers (e.g. ``Content-Type`` for JSON bodies).
    """
    h = {
        **bearer_headers(token),
        'X-Workspace-Id': str(workspace_id),
    }
    if extra:
        h.update(extra)
    return h


def post_sequencing_file_upload(
    client,
    seq_id: int,
    token: str,
    workspace_id: int | str,
    filename: str,
    body: bytes,
):
    """POST multipart upload to ``/sequences/{id}/sequencing_files``."""
    return client.post(
        f"/sequences/{seq_id}/sequencing_files",
        headers=workspace_headers(token, workspace_id),
        files={'files': (filename, body, 'application/octet-stream')},
    )


def assert_get_missing_workspace_header_422(client, path: str, token: str) -> None:
    """GET with bearer only (no X-Workspace-Id) returns 422."""
    r = client.get(path, headers=bearer_headers(token))
    assert r.status_code == 422, r.text


def assert_get_invalid_workspace_id_422(
    client,
    path: str,
    token: str,
    invalid: str = 'bad',
) -> None:
    """GET with non-coercible X-Workspace-Id returns 422."""
    r = client.get(
        path,
        headers={**bearer_headers(token), 'X-Workspace-Id': invalid},
    )
    assert r.status_code == 422, r.text


def assert_get_non_member_workspace_403(
    client,
    path: str,
    token: str,
    workspace_id: int | str,
) -> None:
    """GET with bearer and workspace id user cannot access returns 403."""
    r = client.get(path, headers=workspace_headers(token, workspace_id))
    assert r.status_code == 403, r.text


def assert_get_unauthenticated_401(
    client,
    path: str,
    workspace_id: int | str,
) -> None:
    """GET with X-Workspace-Id only (no bearer) returns 401."""
    r = client.get(path, headers={'X-Workspace-Id': str(workspace_id)})
    assert r.status_code == 401, r.text


def assert_post_unauthenticated_401(
    client,
    path: str,
    workspace_id: int | str,
    *,
    json,
) -> None:
    """POST with X-Workspace-Id only (no bearer) returns 401."""
    r = client.post(
        path,
        headers={'X-Workspace-Id': str(workspace_id)},
        json=json,
    )
    assert r.status_code == 401, r.text


def assert_patch_unauthenticated_401(
    client,
    path: str,
    workspace_id: int | str,
    *,
    json,
) -> None:
    """PATCH with X-Workspace-Id only (no bearer) returns 401."""
    r = client.patch(
        path,
        headers={'X-Workspace-Id': str(workspace_id)},
        json=json,
    )
    assert r.status_code == 401, r.text


def seed_standard_users(session) -> dict:
    """Seed the standard users / workspaces topology and return a context dict.

    Membership topology:
        owner_w1            — owner of W1 only
        owner_w2            — owner of W2 only
        viewer_w1           — viewer of W1 only
        owner_both          — owner of both W1 and W2
        owner_w1_viewer_w2  — owner of W1, viewer of W2

    W3 exists but has no standard memberships (for forbidden-access tests).

    The session is flushed but **not** committed; callers should add their
    own resource rows and commit once.
    """
    from opencloning_db.models import User, Workspace, WorkspaceMembership, WorkspaceRole

    owner_w1 = User(
        email=_STANDARD_EMAILS['owner_w1'],
        display_name=_STANDARD_DISPLAY_NAMES['owner_w1'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['owner_w1'],
    )
    owner_w2 = User(
        email=_STANDARD_EMAILS['owner_w2'],
        display_name=_STANDARD_DISPLAY_NAMES['owner_w2'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['owner_w2'],
    )
    viewer_w1 = User(
        email=_STANDARD_EMAILS['viewer_w1'],
        display_name=_STANDARD_DISPLAY_NAMES['viewer_w1'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['viewer_w1'],
    )
    owner_both = User(
        email=_STANDARD_EMAILS['owner_both'],
        display_name=_STANDARD_DISPLAY_NAMES['owner_both'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['owner_both'],
    )
    owner_w1_viewer_w2 = User(
        email=_STANDARD_EMAILS['owner_w1_viewer_w2'],
        display_name=_STANDARD_DISPLAY_NAMES['owner_w1_viewer_w2'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['owner_w1_viewer_w2'],
    )
    instance_admin = User(
        email=_STANDARD_EMAILS['instance_admin'],
        display_name=_STANDARD_DISPLAY_NAMES['instance_admin'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['instance_admin'],
        is_instance_admin=True,
    )
    editor_w1 = User(
        email=_STANDARD_EMAILS['editor_w1'],
        display_name=_STANDARD_DISPLAY_NAMES['editor_w1'],
        auth_provider=TEST_AUTH_PROVIDER,
        external_subject=_STANDARD_SUBJECTS['editor_w1'],
    )
    w1 = Workspace(name='Workspace One')
    w2 = Workspace(name='Workspace Two')
    w3 = Workspace(name='Workspace Three')
    session.add_all(
        [owner_w1, owner_w2, viewer_w1, owner_both, owner_w1_viewer_w2, instance_admin, w1, w2, w3, editor_w1]
    )
    session.flush()

    session.add_all(
        [
            WorkspaceMembership(
                user_id=owner_w1.id,
                workspace_id=w1.id,
                role=WorkspaceRole.owner,
            ),
            WorkspaceMembership(
                user_id=editor_w1.id,
                workspace_id=w1.id,
                role=WorkspaceRole.editor,
            ),
            WorkspaceMembership(
                user_id=owner_w2.id,
                workspace_id=w2.id,
                role=WorkspaceRole.owner,
            ),
            WorkspaceMembership(
                user_id=viewer_w1.id,
                workspace_id=w1.id,
                role=WorkspaceRole.viewer,
            ),
            WorkspaceMembership(
                user_id=owner_both.id,
                workspace_id=w1.id,
                role=WorkspaceRole.owner,
            ),
            WorkspaceMembership(
                user_id=owner_both.id,
                workspace_id=w2.id,
                role=WorkspaceRole.owner,
            ),
            WorkspaceMembership(
                user_id=owner_w1_viewer_w2.id,
                workspace_id=w1.id,
                role=WorkspaceRole.owner,
            ),
            WorkspaceMembership(
                user_id=owner_w1_viewer_w2.id,
                workspace_id=w2.id,
                role=WorkspaceRole.viewer,
            ),
        ]
    )

    return {
        'w1': w1.id,
        'w2': w2.id,
        'w3': w3.id,
        'owner_w1_id': owner_w1.id,
        'owner_w1_email': _STANDARD_EMAILS['owner_w1'],
        'owner_w1_subject': _STANDARD_SUBJECTS['owner_w1'],
        'owner_w2_id': owner_w2.id,
        'owner_w2_email': _STANDARD_EMAILS['owner_w2'],
        'owner_w2_subject': _STANDARD_SUBJECTS['owner_w2'],
        'viewer_w1_id': viewer_w1.id,
        'viewer_w1_email': _STANDARD_EMAILS['viewer_w1'],
        'viewer_w1_subject': _STANDARD_SUBJECTS['viewer_w1'],
        'owner_both_id': owner_both.id,
        'owner_both_email': _STANDARD_EMAILS['owner_both'],
        'owner_both_subject': _STANDARD_SUBJECTS['owner_both'],
        'owner_w1_viewer_w2_id': owner_w1_viewer_w2.id,
        'owner_w1_viewer_w2_email': _STANDARD_EMAILS['owner_w1_viewer_w2'],
        'owner_w1_viewer_w2_subject': _STANDARD_SUBJECTS['owner_w1_viewer_w2'],
        'instance_admin_id': instance_admin.id,
        'instance_admin_email': _STANDARD_EMAILS['instance_admin'],
        'instance_admin_subject': _STANDARD_SUBJECTS['instance_admin'],
        'editor_w1_id': editor_w1.id,
        'editor_w1_email': _STANDARD_EMAILS['editor_w1'],
        'editor_w1_subject': _STANDARD_SUBJECTS['editor_w1'],
    }


def attach_standard_tokens(ctx: dict, client) -> dict:
    """Attach test bearer tokens for all standard seeded users to *ctx*.

    Also sets ``ctx["client"]``. Returns *ctx* for convenience.
    """
    ctx['client'] = client
    ctx['token_owner_w1'] = make_test_bearer_token(
        ctx['owner_w1_subject'],
        _STANDARD_DISPLAY_NAMES['owner_w1'],
        email=ctx['owner_w1_email'],
    )
    ctx['token_owner_w2'] = make_test_bearer_token(
        ctx['owner_w2_subject'],
        _STANDARD_DISPLAY_NAMES['owner_w2'],
        email=ctx['owner_w2_email'],
    )
    ctx['token_viewer_w1'] = make_test_bearer_token(
        ctx['viewer_w1_subject'],
        _STANDARD_DISPLAY_NAMES['viewer_w1'],
        email=ctx['viewer_w1_email'],
    )
    ctx['token_owner_both'] = make_test_bearer_token(
        ctx['owner_both_subject'],
        _STANDARD_DISPLAY_NAMES['owner_both'],
        email=ctx['owner_both_email'],
    )
    ctx['token_editor_w1'] = make_test_bearer_token(
        ctx['editor_w1_subject'],
        _STANDARD_DISPLAY_NAMES['editor_w1'],
        email=ctx['editor_w1_email'],
    )
    ctx['token_instance_admin'] = make_test_bearer_token(
        ctx['instance_admin_subject'],
        _STANDARD_DISPLAY_NAMES['instance_admin'],
        email=ctx['instance_admin_email'],
    )
    ctx['token_owner_w1_viewer_w2'] = make_test_bearer_token(
        ctx['owner_w1_viewer_w2_subject'],
        _STANDARD_DISPLAY_NAMES['owner_w1_viewer_w2'],
        email=ctx['owner_w1_viewer_w2_email'],
    )
    return ctx
