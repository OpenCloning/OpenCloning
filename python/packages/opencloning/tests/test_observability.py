"""Tests for structured logging, request IDs and generic 500 responses."""

import io
import json
import importlib
import logging
import os
import subprocess
import sys
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient

import opencloning.main as main
from opencloning._version import __version__
from opencloning.observability.context import bind_user_to_request_context
from opencloning.observability.logging_config import (
    OpenCloningJsonFormatter,
    build_logging_config,
    RequestContextFilter,
)
from opencloning.observability.middleware import RequestContextMiddleware, register_error_handlers

test_logger = logging.getLogger('opencloning.tests')


@pytest.fixture
def log_output():
    """Attach a handler configured like production (JSON formatter + filters) to the root logger."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(OpenCloningJsonFormatter())
    handler.addFilter(RequestContextFilter())
    root = logging.getLogger()
    previous_level = root.level
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    # As in production (build_logging_config): the TestClient's httpx2 logs would contain full URLs
    httpx_logger = logging.getLogger('httpx2')
    previous_httpx_level = httpx_logger.level
    httpx_logger.setLevel(logging.WARNING)

    class Output:
        @property
        def text(self) -> str:
            return stream.getvalue()

        @property
        def records(self) -> list[dict]:
            # Every line must be a single JSON object
            return [json.loads(line) for line in self.text.splitlines()]

        def by_message(self, message: str) -> list[dict]:
            return [r for r in self.records if r['message'] == message]

    yield Output()
    root.removeHandler(handler)
    root.setLevel(previous_level)
    httpx_logger.setLevel(previous_httpx_level)


def _create_test_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get('/items/{item_id}')
    async def get_item(item_id: int):
        test_logger.info('item_requested', extra={'item_id': item_id})
        return {'item_id': item_id}

    @app.get('/sync')
    def sync_route():
        # Runs in the threadpool (copied context)
        bind_user_to_request_context('user_sync')
        test_logger.info('sync_route_called')
        return {'ok': True}

    @app.get('/bound')
    async def bound_route():
        bind_user_to_request_context('user_123')
        return {'ok': True}

    @app.get('/unavailable')
    async def unavailable():
        raise HTTPException(503, 'NCBI is down, try again later')

    @app.get('/missing/{name}')
    async def missing(name: str):
        raise HTTPException(404, f'Sequence {name} not found')

    @app.get('/stream-crash')
    async def stream_crash():
        async def body():
            yield b'partial'
            raise RuntimeError('stream failed')

        return StreamingResponse(body())

    @app.get('/boom')
    async def boom():
        raise RuntimeError('kaboom')

    return app


@pytest.fixture
def client() -> TestClient:
    app = RequestContextMiddleware(
        CORSMiddleware(_create_test_app(), allow_origins=['http://localhost:3000'], expose_headers=['x-request-id'])
    )
    return TestClient(app)


def _assert_uuid(value: str) -> None:
    assert str(uuid.UUID(value)) == value


def test_success_returns_request_id_and_logs_completion(client, log_output):
    response = client.get('/items/42', params={'q': 'secret-search-term'})
    assert response.status_code == 200
    request_id = response.headers['x-request-id']
    _assert_uuid(request_id)

    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == request_id
    assert completed['level'] == 'info'
    assert completed['method'] == 'GET'
    # Path parameters are logged as a template
    assert completed['route'] == '/items/{item_id}'
    assert completed['status'] == 200
    assert isinstance(completed['duration_ms'], float)
    assert isinstance(completed['pid'], int)
    for field in ('timestamp', 'version', 'logger'):
        assert field in completed
    assert completed['timestamp'].endswith('+00:00')

    # A custom logger also gets the request context
    [item_log] = log_output.by_message('item_requested')
    assert item_log['request_id'] == request_id
    # Custom logger keeps its own fields
    assert item_log['item_id'] == 42

    # Query values are never logged
    assert 'secret-search-term' not in log_output.text


def test_each_request_gets_a_new_id(client, log_output):
    first = client.get('/items/1').headers['x-request-id']
    second = client.get('/items/1').headers['x-request-id']
    assert first != second


def test_not_found_has_request_id(client, log_output):
    response = client.get('/does-not-exist')
    assert response.status_code == 404
    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == response.headers['x-request-id']
    assert completed['route'] == 'unmatched'
    assert completed['status'] == 404


def test_unhandled_exception_logged_once_with_generic_body(client, log_output):
    response = client.get('/boom')
    assert response.status_code == 500
    request_id = response.headers['x-request-id']
    assert response.json() == {'detail': 'Internal Server Error', 'request_id': request_id}

    errors = [r for r in log_output.records if r['level'] == 'error']
    assert len(errors) == 1
    [error] = errors
    assert error['message'] == 'unhandled_exception'
    assert error['request_id'] == request_id
    assert error['exc_info'].startswith('Traceback')
    assert 'RuntimeError: kaboom' in error['exc_info']

    [completed] = log_output.by_message('request_completed')
    assert completed['status'] == 500
    assert completed['level'] == 'warning'


def test_crash_after_response_started_is_logged_as_failure(client, log_output):
    client.get('/stream-crash')
    [error] = [r for r in log_output.records if r['level'] == 'error']
    assert error['message'] == 'unhandled_exception'
    assert 'RuntimeError: stream failed' in error['exc_info']
    [completed] = log_output.by_message('request_completed')
    # The 200 was already sent, but the request is not a success
    assert completed['status'] == 200
    assert completed['level'] == 'warning'


def test_handled_5xx_logs_detail(client, log_output):
    response = client.get('/unavailable')
    assert response.status_code == 503
    assert response.json() == {'detail': 'NCBI is down, try again later'}
    [completed] = log_output.by_message('request_completed')
    assert completed['status'] == 503
    assert completed['level'] == 'warning'
    assert completed['detail'] == 'NCBI is down, try again later'
    # A handled error is not a crash: no stack, no error event
    assert not log_output.by_message('unhandled_exception')
    assert 'Traceback' not in log_output.text


def test_4xx_detail_is_not_logged(client, log_output):
    response = client.get('/missing/my-secret-construct')
    assert response.status_code == 404
    assert response.json() == {'detail': 'Sequence my-secret-construct not found'}
    [completed] = log_output.by_message('request_completed')
    assert 'detail' not in completed
    assert 'my-secret-construct' not in log_output.text


def test_user_binding(client, log_output):
    response = client.get('/bound')
    [completed] = log_output.by_message('request_completed')
    assert completed['user_id'] == 'user_123'
    assert completed['request_id'] == response.headers['x-request-id']


def test_context_in_threadpool_route(client, log_output):
    # Context is set for sync routes
    # also, bind_user works in sync routes when called inside
    response = client.get('/sync')
    request_id = response.headers['x-request-id']
    [route_log] = log_output.by_message('sync_route_called')
    assert route_log['request_id'] == request_id
    # Binding from a copied context is visible to the middleware
    [completed] = log_output.by_message('request_completed')
    assert completed['user_id'] == 'user_sync'


def test_inbound_request_id_is_ignored(client, log_output):
    response = client.get('/items/1', headers={'X-Request-ID': 'client-chosen-id'})
    request_id = response.headers['x-request-id']
    _assert_uuid(request_id)
    [completed] = log_output.by_message('request_completed')
    assert completed['request_id'] == request_id
    assert 'client-chosen-id' not in log_output.text


def test_cors_exposes_request_id_on_cloning_app():
    client = TestClient(main.app)
    response = client.get('/version', headers={'Origin': 'http://localhost:3000'})
    assert response.status_code == 200
    assert 'x-request-id' in response.headers
    # It's a UUID
    _assert_uuid(response.headers['x-request-id'])
    exposed = response.headers['access-control-expose-headers'].lower()
    assert 'x-request-id' in exposed
    assert 'x-warning' in exposed


def test_nested_middleware_is_pass_through(log_output):
    # Ensures that if by accident you wrap the middleware twice, it doesn't create two IDs
    app = RequestContextMiddleware(RequestContextMiddleware(_create_test_app()))
    response = TestClient(app).get('/items/1')
    assert response.headers.get_list('x-request-id') == [response.headers['x-request-id']]
    assert len(log_output.by_message('request_completed')) == 1


def _run_logging_snippet(env_overrides: dict[str, str]) -> str:
    code = (
        'import logging, logging.config\n'
        'from opencloning.observability.logging_config import build_logging_config\n'
        'logging.config.dictConfig(build_logging_config())\n'
        "logging.getLogger('some.library').debug('debug_event')\n"
        "logging.getLogger('httpx2').info('HTTP Request: GET https://x.org/?api_key=SECRET')\n"
        "logging.getLogger('gunicorn.error').info('Booting worker')\n"
    )
    env = {**os.environ, **env_overrides}
    result = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True, check=True)
    return result.stdout


def test_log_level_debug_and_json_output():
    output = _run_logging_snippet({'LOG_LEVEL': 'debug'})
    records = [json.loads(line) for line in output.splitlines()]
    assert [r['message'] for r in records] == ['debug_event', 'Booting worker']
    assert records[0]['level'] == 'debug'
    assert records[0]['version'] == __version__
    assert records[1]['logger'] == 'gunicorn.error'
    # httpx2 INFO logs (outbound URLs) are suppressed
    assert 'SECRET' not in output


def test_default_level_is_info():
    output = _run_logging_snippet({'LOG_LEVEL': ''})
    assert [json.loads(line)['message'] for line in output.splitlines()] == ['Booting worker']


def test_build_logging_config_levels(monkeypatch):
    monkeypatch.setenv('LOG_LEVEL', 'warning')
    assert build_logging_config()['root']['level'] == 'WARNING'
    assert build_logging_config('debug')['root']['level'] == 'DEBUG'
    monkeypatch.delenv('LOG_LEVEL')
    assert build_logging_config()['root']['level'] == 'INFO'


def test_gunicorn_conf(monkeypatch):
    import opencloning.observability.gunicorn_conf as gunicorn_conf

    monkeypatch.setenv('GUNICORN_WORKERS', '3')
    monkeypatch.setenv('GUNICORN_TIMEOUT', '5')
    monkeypatch.setenv('LOG_LEVEL', 'DEBUG')
    conf = importlib.reload(gunicorn_conf)
    assert conf.workers == 3
    assert conf.timeout == 5
    assert conf.loglevel == 'debug'
    assert conf.logconfig_dict['root']['level'] == 'DEBUG'
    assert conf.worker_class == 'uvicorn_worker.UvicornWorker'


def test_crash_before_response_gets_generic_500(log_output):
    # A bare ASGI app that fails before sending anything: the middleware itself answers with the generic 500
    async def app(scope, receive, send):
        raise RuntimeError('kaboom')

    response = TestClient(RequestContextMiddleware(app)).get('/boom')
    assert response.status_code == 500
    assert response.json() == {'detail': 'Internal Server Error', 'request_id': response.headers['x-request-id']}
    assert len(log_output.by_message('unhandled_exception')) == 1
