"""Request IDs, CORS exposure and auth logging on the DB / combined apps.

These tests do not need a database: authentication fails before any query is made.
"""

import asyncio
import io
import json
import logging
from collections.abc import Generator
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from opencloning.observability.context import RequestContext, reset_request_context, set_request_context
from opencloning.observability.logging_config import OpenCloningJsonFormatter, RequestContextFilter
from opencloning.observability.middleware import RequestContextMiddleware

import opencloning_db.deps as deps
from opencloning_db.api import create_app as create_db_app
from opencloning_db.combined import create_app
from opencloning_db.config import Config, OidcConfig, _peek_config
from opencloning_db.db import reset_runtime_state
from opencloning_db.models import WorkspaceRole
from opencloning_db.workspace_auth import assert_workspace_access

ORIGIN = 'http://localhost:3000'

_TEST_CONFIG = Config(
    # Never connected to: requests in this module fail authentication before any query
    database_url='postgresql+psycopg://user:password@localhost:1/unused',
    oidc_config=OidcConfig(issuer_url='https://example.idp.accounts.dev', authorized_parties=[ORIGIN], test_mode=True),
)


@pytest.fixture
def log_output():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(OpenCloningJsonFormatter())
    handler.addFilter(RequestContextFilter())
    root = logging.getLogger()
    previous_level = root.level
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    httpx_logger = logging.getLogger('httpx2')
    previous_httpx_level = httpx_logger.level
    httpx_logger.setLevel(logging.WARNING)

    class Output:
        @property
        def text(self) -> str:
            return stream.getvalue()

        def by_message(self, message: str) -> list[dict]:
            records = [json.loads(line) for line in self.text.splitlines()]
            return [r for r in records if r['message'] == message]

    yield Output()
    root.removeHandler(handler)
    root.setLevel(previous_level)
    httpx_logger.setLevel(previous_httpx_level)


@pytest.fixture
def combined_client() -> Generator[TestClient, None, None]:
    previous_config = _peek_config()
    reset_runtime_state(_TEST_CONFIG)
    yield TestClient(RequestContextMiddleware(create_app(db_app=create_db_app())))
    reset_runtime_state(previous_config)


def _assert_readable_by_browser(response) -> str:
    assert response.headers['access-control-allow-origin'] == ORIGIN
    assert 'x-request-id' in response.headers['access-control-expose-headers'].lower()
    return response.headers['x-request-id']


def test_cloning_401_is_readable_by_browser(combined_client, log_output):
    response = combined_client.get('/cloning/version', headers={'Origin': ORIGIN})

    assert response.status_code == 401
    request_id = _assert_readable_by_browser(response)
    [auth_failed] = log_output.by_message('auth_failed')
    assert auth_failed['reason'] == 'missing_header'
    assert auth_failed['level'] == 'warning'
    assert auth_failed['request_id'] == request_id
    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == request_id
    assert completed['status'] == 401


def test_cloning_preflight_still_allowed(combined_client):
    response = combined_client.options(
        '/cloning/version',
        headers={
            'Origin': ORIGIN,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization',
        },
    )
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == ORIGIN


def test_invalid_token_is_logged_without_token_content(combined_client, log_output):
    response = combined_client.get(
        '/cloning/version', headers={'Origin': ORIGIN, 'Authorization': 'Bearer s3cr3t-token-value'}
    )

    assert response.status_code == 401
    request_id = _assert_readable_by_browser(response)
    [auth_failed] = log_output.by_message('auth_failed')
    assert auth_failed['reason'] == 'invalid_token'
    assert auth_failed['error_type'] == 'InvalidTokenError'
    assert auth_failed['detail'] == 'Invalid test token'
    assert auth_failed['request_id'] == request_id
    assert 's3cr3t-token-value' not in log_output.text


def test_bad_scheme_is_logged(combined_client, log_output):
    response = combined_client.get('/cloning/version', headers={'Authorization': 'Basic abc'})
    assert response.status_code == 401
    [auth_failed] = log_output.by_message('auth_failed')
    assert auth_failed['reason'] == 'bad_scheme'


def test_db_401_has_request_id_and_route_template(combined_client, log_output):
    response = combined_client.get('/db/workspaces/12', headers={'Origin': ORIGIN})

    assert response.status_code == 401
    request_id = _assert_readable_by_browser(response)
    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == request_id
    assert completed['route'] == '/db/workspaces/{workspace_id}'
    [auth_failed] = log_output.by_message('auth_failed')
    assert auth_failed['reason'] == 'missing_header'
    assert auth_failed['request_id'] == request_id


@pytest.mark.parametrize(
    'authorization, reason',
    [
        ('Basic abc', 'bad_scheme'),
        ('Bearer', 'bad_scheme'),
        ('Bearer s3cr3t-token-value', 'invalid_token'),
    ],
)
def test_db_auth_failures_are_logged(combined_client, log_output, authorization, reason):
    # Same auth events as /cloning: the /db dependency goes through parse_bearer_token too
    response = combined_client.get('/db/workspaces/12', headers={'Authorization': authorization})

    assert response.status_code == 401
    assert response.json()['detail'].startswith('Could not validate credentials')
    [auth_failed] = log_output.by_message('auth_failed')
    assert auth_failed['reason'] == reason
    assert auth_failed['request_id'] == response.headers['x-request-id']
    assert 's3cr3t-token-value' not in log_output.text


def test_not_found_has_request_id(combined_client, log_output):
    response = combined_client.get('/nothing-here')
    assert response.status_code == 404
    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == response.headers['x-request-id']


def test_authenticated_request_logs_user_id(combined_client, log_output, monkeypatch):
    # Happy path through the real middleware and auth wrapper; only the user lookup is stubbed (no database)
    monkeypatch.setattr(deps, 'resolve_oidc_user', lambda session, config, identity: SimpleNamespace(id=1))
    response = combined_client.get(
        '/cloning/version', headers={'Authorization': 'Bearer test:user_2abc|jane@example.com|Jane Doe'}
    )

    assert response.status_code == 200
    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == response.headers['x-request-id']
    assert completed['user_id'] == 'user_2abc'
    assert completed['route'] == '/cloning/version'
    assert completed['status'] == 200
    assert completed['level'] == 'info'
    assert not log_output.by_message('auth_failed')
    # Only the subject is logged: no email, no name
    assert 'jane@example.com' not in log_output.text
    assert 'Jane Doe' not in log_output.text


def test_successful_auth_binds_subject(monkeypatch):
    user = SimpleNamespace(id=1)
    monkeypatch.setattr(deps, 'resolve_oidc_user', lambda session, config, identity: user)
    ctx = RequestContext(request_id='rid')
    token = set_request_context(ctx)
    try:
        result = asyncio.run(
            deps.resolve_user_from_token('test:user_2abc|Jane Doe', session=None, config=_TEST_CONFIG)
        )
    finally:
        reset_request_context(token)
    assert result is user
    assert ctx.user_id == 'user_2abc'


@pytest.mark.parametrize(
    'membership, reason',
    [
        (None, 'not_member'),
        (SimpleNamespace(role=WorkspaceRole.viewer), 'insufficient_role'),
    ],
)
def test_access_denied_is_logged(log_output, membership, reason):
    session = SimpleNamespace(scalar=lambda query: membership)
    with pytest.raises(HTTPException) as exc_info:
        assert_workspace_access(session, 1, 7, WorkspaceRole.editor)
    assert exc_info.value.status_code == 403
    [denied] = log_output.by_message('access_denied')
    assert denied == denied | {
        'level': 'warning',
        'reason': reason,
        'workspace_id': 7,
        'required_role': 'editor',
    }
