"""Tests for MaxBodySizeMiddleware (request body cap enforced while the body is received)."""

import pytest
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

import opencloning.main as main
from opencloning.body_size_limit import MaxBodySizeMiddleware

MAX_BYTES = 1024 * 1024
ORIGIN = 'http://localhost:3000'


@pytest.fixture
def client():
    app = FastAPI()
    app.add_middleware(MaxBodySizeMiddleware, max_size_mb=1)
    handled = []

    @app.post('/upload')
    async def upload(file: UploadFile = File(...)):
        handled.append(file.filename)
        return {'size': len(await file.read())}

    @app.post('/json')
    async def json_body(body: dict):
        handled.append('json')
        return body

    # As in production, CORS wraps the app, so the 413 must carry CORS headers for browsers to read it
    with TestClient(CORSMiddleware(app, allow_origins=[ORIGIN])) as c:
        c.handled = handled
        yield c


def chunks(total: int, chunk_size: int = 64 * 1024):
    for start in range(0, total, chunk_size):
        yield b'A' * min(chunk_size, total - start)


def test_body_under_limit_is_accepted(client):
    r = client.post('/upload', files={'file': ('small.txt', b'A' * 100)}, headers={'Origin': ORIGIN})
    assert r.status_code == 200
    assert r.json() == {'size': 100}
    assert client.handled == ['small.txt']


def test_declared_content_length_over_limit_is_rejected_before_reading(client):
    r = client.post('/upload', files={'file': ('big.txt', b'A' * (MAX_BYTES + 1))}, headers={'Origin': ORIGIN})
    assert r.status_code == 413
    assert r.json() == {'detail': 'Request body exceeds the maximum size of 1 MB'}
    assert r.headers['access-control-allow-origin'] == ORIGIN
    assert client.handled == []


def test_chunked_body_over_limit_is_rejected(client):
    """Without Content-Length, the body is counted as it arrives."""
    r = client.post(
        '/json',
        content=chunks(MAX_BYTES * 4),
        headers={'Origin': ORIGIN, 'Content-Type': 'application/json'},
    )
    assert 'content-length' not in r.request.headers
    # 413 (not FastAPI's generic 400 for body parsing errors), and the route never runs
    assert r.status_code == 413
    assert r.json() == {'detail': 'Request body exceeds the maximum size of 1 MB'}
    assert r.headers['access-control-allow-origin'] == ORIGIN
    assert client.handled == []


def test_chunked_multipart_over_limit_is_rejected(client):
    """Multipart parsing stops at the limit instead of spooling the whole upload."""
    boundary = 'boundary123'
    head = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.txt"\r\n'
        'Content-Type: text/plain\r\n\r\n'
    ).encode()

    def multipart_body():
        yield head
        yield from chunks(MAX_BYTES * 4)
        yield f'\r\n--{boundary}--\r\n'.encode()

    r = client.post(
        '/upload',
        content=multipart_body(),
        headers={'Origin': ORIGIN, 'Content-Type': f'multipart/form-data; boundary={boundary}'},
    )
    assert 'content-length' not in r.request.headers
    assert r.status_code == 413
    assert client.handled == []


def test_cloning_app_registers_middleware():
    app = main.create_fastapi_app()
    assert any(m.cls is MaxBodySizeMiddleware for m in app.user_middleware)
