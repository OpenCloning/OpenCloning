"""Calls to the OpenCloning cloning API (the FastAPI app in the `opencloning` package).

The API runs inside this process: TestClient hands each request straight to the FastAPI app, without
network. Routing, validation and error handling run exactly as in the deployed API. To call a remote
API instead, replace TestClient with httpx2.Client(base_url=...): the rest of the code stays the same.
"""

from fastapi.testclient import TestClient
from mcp.server.mcpserver.exceptions import ToolError
from opencloning.main import app as cloning_app

# raise_server_exceptions=False: a crash in the API becomes a 500 response, like in production
_client = TestClient(cloning_app, raise_server_exceptions=False)


def post(endpoint: str, json: dict | None = None, params: dict | None = None, files: dict | None = None):
    """POST to the cloning API and return the JSON response.

    If the API answers with an error, raise a ToolError with the API's message, so the model can
    read it and fix its call (e.g. "These enzymes do not cut: NotI").
    Warnings the API sends in the x-warning header (e.g. sequences skipped when reading a file) are
    added to the result as "warnings", so that they reach the model too.
    """
    response = _client.post(endpoint, json=json, params=params, files=files)
    if response.status_code != 200:
        raise ToolError(f'The cloning API returned an error: {response.json()["detail"]}')
    result = response.json()
    if isinstance(result, dict) and response.headers.get('x-warning'):
        result['warnings'] = response.headers['x-warning']
    return result
