"""DB test lifecycle primitives.

These functions are pure library code (no Typer or click imports) so they can
be unit-tested directly against a ``Config`` pointing at a temporary
workspace.
"""

from __future__ import annotations

import json
import base64
import os
from pathlib import Path
from typing import Any

from opencloning_db.config import Config, OidcConfig, get_config, parse_bool, set_config
from opencloning_db.init_db import load_seed_data
from opencloning_db.migrations import (
    recreate_public_schema,
    truncate_application_tables,
    upgrade_head,
)

from .stubs import stubs, RecordedStub, StubRequest, StubResponse

# Canonical timestamp for recorded HTTP stubs (avoids diffs from DB server_default times).
_STUB_CREATED_AT = '2000-01-01T00:00:00Z'


def _replace_created_at_in_json(value: Any) -> Any:
    """Return a deep structure copy with every ``created_at`` key set to a fixed string.

    Walks dicts and lists only; leaves scalars unchanged except under the key
    ``created_at``. Does not mutate *value* (safe for shared stub request bodies).
    """
    if isinstance(value, dict):
        return {k: _STUB_CREATED_AT if k == 'created_at' else _replace_created_at_in_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_replace_created_at_in_json(item) for item in value]
    return value


def _dispose_engine() -> None:
    """Dispose any cached SQLAlchemy engine before reset or stub generation.

    ``opencloning_db.db`` caches a module-level engine keyed by URL; leaving
    it open risks stale connections after reseeding.
    """
    import opencloning_db.db as _db_module

    if _db_module._engine is not None:
        _db_module._engine.dispose()
        _db_module._engine = None
        _db_module._bound_database_url = None


def _require_testing_seed_enabled() -> None:
    if not parse_bool(os.getenv('OPENCLONING_TESTING', False)):
        raise RuntimeError('db seed requires OPENCLONING_TESTING=1')


def _apply_testing_oidc_config(config: Config) -> Config:
    """Match seeded users (oidc:seed.example) and accept test bearer tokens during seed/stubs."""
    testing_config = config.model_copy(
        update={
            'oidc_config': OidcConfig(
                issuer_url='https://seed.example',
                authorized_parties=[
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'http://localhost:3002',
                ],
                test_mode=True,
            ),
        }
    )
    set_config(testing_config)
    return testing_config


def migrate() -> None:
    """Apply Alembic migrations to the configured database."""
    config = get_config()
    _dispose_engine()
    upgrade_head(config.database_url)
    _dispose_engine()


def seed(*, recreate_schema: bool = False) -> None:
    """Recreate deterministic database baseline.

    This is destructive and only allowed when ``OPENCLONING_TESTING=1``.
    """
    import opencloning_db.db as _db_module

    _require_testing_seed_enabled()
    config = _apply_testing_oidc_config(get_config())
    _dispose_engine()

    database_url = config.database_url
    if recreate_schema:
        engine = _db_module.get_engine(config)
        try:
            recreate_public_schema(engine)
        finally:
            engine.dispose()
        upgrade_head(database_url)
    else:
        upgrade_head(database_url)

    engine = _db_module.get_engine(config)
    try:
        truncate_application_tables(engine)
        load_seed_data(engine)
    finally:
        engine.dispose()

    _dispose_engine()


def _sanitize_headers(headers: dict[str, str] | None) -> dict[str, str]:
    """Drop noisy values and replace auth tokens with placeholders."""
    if not headers:
        return {}

    sanitized: dict[str, str] = {}
    for key, value in headers.items():
        normalized = key.lower()
        if normalized in {'authorization'}:
            sanitized[normalized] = 'Bearer __TEST_TOKEN__'
            continue
        if normalized in {'x-workspace-id', 'content-type', 'content-disposition'}:
            sanitized[normalized] = value
    return sanitized


def create_stub(
    test_client: Any,
    stub: StubRequest,
) -> RecordedStub:
    """Perform one request through *test_client* and return a stub payload."""

    method_name = stub.method.lower()
    requester = getattr(test_client, method_name)
    request_kwargs: dict[str, Any] = {'params': stub.params, 'headers': stub.headers}
    if stub.body is not None:
        request_kwargs['json'] = stub.body
    if stub.multipart_files:
        files: list[tuple[str, tuple[str, bytes, str]]] = []
        for file_spec in stub.multipart_files:
            files.append(
                (
                    'files',
                    (
                        file_spec['filename'],
                        file_spec['content'].encode('utf-8'),
                        file_spec.get('content_type', 'application/octet-stream'),
                    ),
                )
            )
        request_kwargs['files'] = files

    response = requester(stub.endpoint, **request_kwargs)
    if response.status_code != stub.expected_status_code:
        raise ValueError(f'Expected status code {stub.expected_status_code} but got {response.status_code}')

    if stub.binary_response:
        response_body = base64.b64encode(response.content).decode('ascii')
    else:
        try:
            response_body = response.json()
        except ValueError:
            response_body = response.text

    if stub.multipart_files:
        stub.body = {
            'multipart_files': [
                {
                    'filename': file_spec['filename'],
                    'content_type': file_spec.get('content_type', 'application/octet-stream'),
                    'content': file_spec['content'],
                }
                for file_spec in stub.multipart_files
            ]
        }

    if isinstance(response_body, (dict, list)):
        response_body = _replace_created_at_in_json(response_body)

    recorded_body: Any = stub.body
    if isinstance(recorded_body, (dict, list)):
        recorded_body = _replace_created_at_in_json(recorded_body)

    return RecordedStub(
        name=stub.name,
        endpoint=stub.endpoint,
        method=stub.method,
        params=stub.params,
        body=recorded_body,
        headers=_sanitize_headers(stub.headers),
        response=StubResponse(
            body=response_body,
            status_code=response.status_code,
            headers=_sanitize_headers(dict(response.headers)),
        ),
    )


def _default_auth_headers(test_client: Any) -> dict[str, str]:
    token = os.environ.get(
        'OPENCLONING_TEST_BEARER_TOKEN',
        'test:bootstrap|bootstrap+clerk_test@example.com|Bootstrap User',
    )

    workspaces_response = test_client.get(
        'db/workspaces',
        headers={'Authorization': f'Bearer {token}'},
    )
    workspaces_response.raise_for_status()
    workspace_id = workspaces_response.json()[0]['id']

    return {
        'Authorization': f'Bearer {token}',
        'X-Workspace-Id': str(workspace_id),
    }


def write_stubs(output_dir: Path):
    """Generate and persist one predefined DB test stub JSON."""
    from fastapi.testclient import TestClient
    from opencloning_db.combined import app

    seed()

    target_dir = Path(output_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    client = TestClient(app)
    headers = _default_auth_headers(client)
    generated_payloads: dict[str, dict[str, Any]] = {}
    # Delete existing stubs
    for file in target_dir.glob('*.json'):
        file.unlink()
    for stub in stubs(str(target_dir)):

        stub.headers = headers
        output_file = target_dir / f'{stub.name}.json'
        if stub.body_from_stub:
            source_payload = generated_payloads.get(stub.body_from_stub)
            if source_payload is None:
                raise ValueError(f'Unknown body source stub "{stub.body_from_stub}" for "{stub.name}".')
            stub.body = source_payload['response']['body']

        recorded_stub = create_stub(client, stub)

        with output_file.open('w', encoding='utf-8') as handle:
            json.dump(recorded_stub.model_dump(), handle, indent=2, sort_keys=True)
            handle.write('\n')
        print('Stub written to', output_file)
        if stub.reset_db:
            seed()
