"""OIDC bearer auth, test-token parsing, legacy email linking, and mocked JWKS."""

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest
import respx
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from jwt.algorithms import RSAAlgorithm
from jwt.exceptions import InvalidTokenError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import opencloning_db.db as db_module
from opencloning_db.auth.oidc import _identity_from_test_token, reset_oidc_clients, verify_oidc_bearer_token
from opencloning_db.config import Config, OidcConfig
from opencloning_db.models import User, Workspace, WorkspaceMembership, WorkspaceRole

from .helpers import TEST_AUTH_PROVIDER, bearer_headers, make_test_bearer_token

readonly_db = pytest.mark.readonly_db

MOCK_ISSUER = 'https://oidc-mock.example'
MOCK_JWKS_URI = f'{MOCK_ISSUER}/jwks'
MOCK_KID = 'test-rsa-key'
MOCK_AZP = 'http://localhost:3002'
MOCK_AUTH_PROVIDER = 'oidc:oidc-mock.example'


@dataclass(frozen=True)
class MockRsaKeyPair:
    private_key: RSAPrivateKey
    jwk_dict: dict


@pytest.fixture(scope='session')
def mock_rsa_key_pair() -> MockRsaKeyPair:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    jwk_dict = json.loads(RSAAlgorithm.to_jwk(public_key))
    jwk_dict.update({'kid': MOCK_KID, 'use': 'sig', 'alg': 'RS256'})
    return MockRsaKeyPair(private_key=private_key, jwk_dict=jwk_dict)


def sign_rs256_token(private_key: RSAPrivateKey, payload: dict, *, kid: str | None = MOCK_KID) -> str:
    headers = {'kid': kid} if kid is not None else None
    return jwt.encode(payload, private_key, algorithm='RS256', headers=headers)


def mock_oidc_http(jwk_dict: dict):
    """Mock discovery + JWKS endpoints; return the JWKS route (for call counts)."""
    discovery_url = f'{MOCK_ISSUER}/.well-known/openid-configuration'
    respx.get(discovery_url).respond(200, json={'issuer': MOCK_ISSUER, 'jwks_uri': MOCK_JWKS_URI})
    return respx.get(MOCK_JWKS_URI).respond(200, json={'keys': [jwk_dict]})


def jwks_oidc_config() -> OidcConfig:
    return OidcConfig(
        issuer_url=MOCK_ISSUER,
        authorized_parties=[MOCK_AZP],
        test_mode=False,
    )


def run_verify(token: str, oidc_config: OidcConfig):
    config = Config(
        database_url='postgresql+psycopg://unused/unused',
        oidc_config=oidc_config,
    )
    return asyncio.run(verify_oidc_bearer_token(token, config))


def valid_jwt_payload(**overrides) -> dict:
    payload = {
        'iss': MOCK_ISSUER,
        'sub': 'user_123',
        'exp': int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        'azp': MOCK_AZP,
        'email': 'alice@example.com',
        'name': 'Alice',
    }
    payload.update(overrides)
    return payload


@pytest.fixture(autouse=True)
def _reset_oidc_cache():
    reset_oidc_clients()
    yield
    reset_oidc_clients()


@pytest.fixture
def allow_mock_issuer(monkeypatch):
    import opencloning.http_client as http_client_module

    monkeypatch.setattr(
        http_client_module,
        'allowed_external_urls',
        [*http_client_module.allowed_external_urls, MOCK_ISSUER],
    )


@pytest.fixture
def oidc_config() -> OidcConfig:
    return OidcConfig(
        issuer_url='https://test.example',
        authorized_parties=['http://localhost:3002'],
        test_mode=True,
    )


@pytest.fixture
def oidc_client(request):
    fixture_name = (
        'engine_client_config_readonly'
        if request.node.get_closest_marker('readonly_db')
        else 'engine_client_config_write'
    )
    _, client, _ = request.getfixturevalue(fixture_name)
    return client


def test_test_token_two_part_parses_subject_and_display_name(oidc_config):
    identity = _identity_from_test_token('test:idp_user_abc|Alice', oidc_config)
    assert identity.subject == 'idp_user_abc'
    assert identity.display_name == 'Alice'
    assert identity.email is None
    assert identity.provider == 'oidc:test.example'


def test_test_token_three_part_parses_email(oidc_config):
    identity = _identity_from_test_token(
        'test:idp_user_abc|alice@example.com|Alice Example',
        oidc_config,
    )
    assert identity.subject == 'idp_user_abc'
    assert identity.email == 'alice@example.com'
    assert identity.display_name == 'Alice Example'


def test_test_token_invalid_part_count_raises(oidc_config):
    with pytest.raises(InvalidTokenError, match='Invalid test token format'):
        _identity_from_test_token('test:only-subject', oidc_config)


def test_test_token_missing_display_name_raises(oidc_config):
    with pytest.raises(InvalidTokenError, match='Invalid test token display_name'):
        _identity_from_test_token('test:subject|', oidc_config)


def test_test_token_missing_subject_raises(oidc_config):
    with pytest.raises(InvalidTokenError, match='Invalid test token subject'):
        _identity_from_test_token('test:|Alice', oidc_config)


def test_valid_test_token_returns_me(oidc_client):
    subject = f'user-{uuid4().hex}'
    token = make_test_bearer_token(subject, f'User {subject[:8]}')
    response = oidc_client.get('/auth/me', headers=bearer_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert body['email'] is None
    assert body['display_name'] == f'User {subject[:8]}'
    assert body['is_instance_admin'] is False


def test_jit_user_gets_default_workspace(oidc_client):
    subject = f'user-{uuid4().hex}'
    token = make_test_bearer_token(subject, f'User {subject[:8]}')
    me_response = oidc_client.get('/auth/me', headers=bearer_headers(token))
    assert me_response.status_code == 200

    workspaces_response = oidc_client.get('/workspaces', headers=bearer_headers(token))
    assert workspaces_response.status_code == 200
    workspaces = workspaces_response.json()
    assert len(workspaces) == 1
    assert workspaces[0]['role'] == 'owner'


def test_jit_user_email_is_normalized(oidc_client):
    subject = f'user-{uuid4().hex}'
    token = make_test_bearer_token(subject, 'Mixed Case', email=f'  Mixed.{subject}@Example.COM ')
    response = oidc_client.get('/auth/me', headers=bearer_headers(token))
    assert response.status_code == 200
    assert response.json()['email'] == f'mixed.{subject}@example.com'


def test_repeat_login_reuses_same_user(oidc_client):
    subject = f'user-{uuid4().hex}'
    token = make_test_bearer_token(subject, f'User {subject[:8]}')
    first = oidc_client.get('/auth/me', headers=bearer_headers(token))
    second = oidc_client.get('/auth/me', headers=bearer_headers(token))
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()['id'] == second.json()['id']


def test_legacy_email_links_existing_user_without_new_workspace(oidc_client, postgres_test_engine_write):
    email = f'legacy-{uuid4().hex}@example.com'
    subject = f'user-{uuid4().hex}'
    with Session(postgres_test_engine_write) as session:
        legacy = User(
            email=email,
            display_name='Legacy User',
        )
        workspace = Workspace(name='Legacy Workspace')
        session.add_all([legacy, workspace])
        session.flush()
        session.add(
            WorkspaceMembership(
                user_id=legacy.id,
                workspace_id=workspace.id,
                role=WorkspaceRole.owner,
            )
        )
        session.commit()
        legacy_id = legacy.id
        workspace_id = workspace.id

    token = make_test_bearer_token(subject, 'Legacy User', email=email)
    me_response = oidc_client.get('/auth/me', headers=bearer_headers(token))
    assert me_response.status_code == 200
    assert me_response.json()['id'] == legacy_id

    workspaces_response = oidc_client.get('/workspaces', headers=bearer_headers(token))
    assert workspaces_response.status_code == 200
    workspaces = workspaces_response.json()
    assert len(workspaces) == 1
    assert workspaces[0]['id'] == workspace_id
    assert workspaces[0]['name'] == 'Legacy Workspace'

    with Session(postgres_test_engine_write) as session:
        user = session.get(User, legacy_id)
        assert user is not None
        assert user.auth_provider == TEST_AUTH_PROVIDER
        assert user.external_subject == subject
        assert user.display_name == 'Legacy User'
        assert user.email == email
        workspace_count = session.scalar(select(func.count()).select_from(Workspace))
        assert workspace_count == 1


@pytest.mark.parametrize('token', ['not-a-valid-token', 'Bearer-only', ''])
def test_invalid_tokens_return_401(oidc_client, token):
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    response = oidc_client.get('/auth/me', headers=headers)
    assert response.status_code == 401


@respx.mock
def test_jwks_valid_rs256_token_returns_identity(mock_rsa_key_pair, allow_mock_issuer):
    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload())

    identity = run_verify(token, jwks_oidc_config())

    assert identity.provider == MOCK_AUTH_PROVIDER
    assert identity.subject == 'user_123'
    assert identity.email == 'alice@example.com'
    assert identity.display_name == 'Alice'


@respx.mock
def test_jwks_rejects_invalid_azp(mock_rsa_key_pair, allow_mock_issuer):
    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    token = sign_rs256_token(
        mock_rsa_key_pair.private_key,
        valid_jwt_payload(azp='http://evil.example'),
    )

    with pytest.raises(InvalidTokenError, match='Invalid azp claim'):
        run_verify(token, jwks_oidc_config())


@respx.mock
def test_jwks_rejects_expired_token(mock_rsa_key_pair, allow_mock_issuer):
    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    expired = int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
    token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload(exp=expired))

    with pytest.raises(InvalidTokenError):
        run_verify(token, jwks_oidc_config())


@respx.mock
def test_jwks_rejects_missing_kid(mock_rsa_key_pair, allow_mock_issuer):
    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload(), kid=None)

    with pytest.raises(InvalidTokenError, match='missing kid'):
        run_verify(token, jwks_oidc_config())


@respx.mock
def test_jwks_rejects_unknown_kid(mock_rsa_key_pair, allow_mock_issuer):
    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload(), kid='unknown')

    with pytest.raises(InvalidTokenError, match='Unable to find signing key'):
        run_verify(token, jwks_oidc_config())


def make_second_key_pair(kid: str) -> MockRsaKeyPair:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk_dict = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk_dict.update({'kid': kid, 'use': 'sig', 'alg': 'RS256'})
    return MockRsaKeyPair(private_key=private_key, jwk_dict=jwk_dict)


@respx.mock
def test_jwks_refetched_after_key_rotation(mock_rsa_key_pair, allow_mock_issuer, monkeypatch):
    import opencloning_db.auth.oidc as oidc_module

    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    old_token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload())
    run_verify(old_token, jwks_oidc_config())  # populates the cache with the old JWKS

    monkeypatch.setattr(oidc_module, 'JWKS_MIN_REFRESH_SECONDS', 0)  # as if >60 s have passed
    new_pair = make_second_key_pair('rotated-key')
    jwks_route = respx.get(MOCK_JWKS_URI).respond(200, json={'keys': [new_pair.jwk_dict]})
    new_token = sign_rs256_token(new_pair.private_key, valid_jwt_payload(), kid='rotated-key')

    identity = run_verify(new_token, jwks_oidc_config())

    assert identity.subject == 'user_123'
    assert jwks_route.call_count == 2  # initial fetch + one refetch on the unknown kid


@respx.mock
def test_jwks_refetch_for_unknown_kid_is_throttled(mock_rsa_key_pair, allow_mock_issuer):
    jwks_route = mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload(), kid='unknown')

    for _ in range(3):
        with pytest.raises(InvalidTokenError, match='Unable to find signing key'):
            run_verify(token, jwks_oidc_config())

    # the first fetch is fresh, so unknown kids within the throttle window never refetch
    assert jwks_route.call_count == 1


@respx.mock
def test_jwks_failed_refetch_is_throttled(mock_rsa_key_pair, allow_mock_issuer):
    import opencloning_db.auth.oidc as oidc_module

    jwks_route = mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    run_verify(sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload()), jwks_oidc_config())
    assert jwks_route.call_count == 1

    # Age the cached JWKS past the throttle window, then make the JWKS endpoint fail
    fetched_at, jwks = oidc_module._jwks_cache[MOCK_JWKS_URI]
    oidc_module._jwks_cache[MOCK_JWKS_URI] = (fetched_at - 120, jwks)
    jwks_route.respond(500)
    unknown_kid_token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload(), kid='unknown')

    for _ in range(3):
        with pytest.raises(InvalidTokenError):
            run_verify(unknown_kid_token, jwks_oidc_config())

    # only the first unknown-kid request retried the failing endpoint
    assert jwks_route.call_count == 2


@respx.mock
def test_jwks_is_cached_between_verifications(mock_rsa_key_pair, allow_mock_issuer):
    jwks_route = mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    token = sign_rs256_token(mock_rsa_key_pair.private_key, valid_jwt_payload())

    run_verify(token, jwks_oidc_config())
    run_verify(token, jwks_oidc_config())

    assert jwks_route.call_count == 1


@respx.mock
def test_jwks_token_returns_me(
    oidc_client,
    postgres_test_config_write,
    mock_rsa_key_pair,
    allow_mock_issuer,
):
    mock_oidc_http(mock_rsa_key_pair.jwk_dict)
    jwks_config = postgres_test_config_write.model_copy(
        update={
            'oidc_config': postgres_test_config_write.oidc_config.model_copy(
                update={'issuer_url': MOCK_ISSUER, 'test_mode': False},
            ),
        },
    )
    db_module.reset_runtime_state(jwks_config)

    subject = f'user-{uuid4().hex}'
    token = sign_rs256_token(
        mock_rsa_key_pair.private_key,
        valid_jwt_payload(sub=subject, name=f'User {subject[:8]}'),
    )
    response = oidc_client.get('/auth/me', headers=bearer_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert body['display_name'] == f'User {subject[:8]}'
    assert body['email'] == 'alice@example.com'
    assert body['is_instance_admin'] is False

    with Session(db_module.get_engine(jwks_config)) as session:
        user = session.scalar(
            select(User).where(
                User.auth_provider == MOCK_AUTH_PROVIDER,
                User.external_subject == subject,
            )
        )
        assert user is not None
