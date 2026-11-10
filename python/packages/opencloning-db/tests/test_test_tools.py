import subprocess
from importlib import reload

import pytest
from fastapi.testclient import TestClient
import opencloning_db.api as api_module


@pytest.fixture
def testing_app_client(monkeypatch) -> TestClient:
    monkeypatch.setenv('OPENCLONING_TESTING', '1')
    reload(api_module)
    try:
        yield TestClient(api_module.app)
    finally:
        monkeypatch.delenv('OPENCLONING_TESTING', raising=False)
        reload(api_module)


@pytest.fixture
def non_testing_app_client(monkeypatch) -> TestClient:
    monkeypatch.delenv('OPENCLONING_TESTING', raising=False)
    reload(api_module)
    yield TestClient(api_module.app)
    monkeypatch.undo()


def test_reset_endpoint_disabled_returns_404(non_testing_app_client):
    response = non_testing_app_client.post('/__test/reset-db')
    assert response.status_code == 404


def test_reset_endpoint_requires_token(testing_app_client):
    response = testing_app_client.post('/__test/reset-db')
    assert response.status_code == 403
    assert response.json()['detail'] == 'Forbidden'


def test_reset_endpoint_calls_cli(testing_app_client, monkeypatch):

    calls = []

    def fake_run(cmd, capture_output, text, check):  # noqa: ANN001
        calls.append((cmd, capture_output, text, check))
        return subprocess.CompletedProcess(cmd, 0, stdout='', stderr='')

    monkeypatch.setattr('opencloning_db.routers.test_tools.subprocess.run', fake_run)

    response = testing_app_client.post('/__test/reset-db', headers={'X-Test-Reset-Token': 'RESET-TOKEN'})
    assert response.status_code == 204
    assert calls
    cmd, capture_output, text, check = calls[0]
    assert cmd == ['opencloning-cli', 'db', 'seed']
    assert capture_output is True
    assert text is True
    assert check is False


def test_reset_endpoint_returns_500_on_cli_failure(testing_app_client, monkeypatch):

    def fake_run(cmd, capture_output, text, check):  # noqa: ANN001
        return subprocess.CompletedProcess(cmd, 1, stdout='', stderr='boom')

    monkeypatch.setattr('opencloning_db.routers.test_tools.subprocess.run', fake_run)

    response = testing_app_client.post('/__test/reset-db', headers={'X-Test-Reset-Token': 'RESET-TOKEN'})
    assert response.status_code == 500
    assert response.json()['detail'] == 'boom'
