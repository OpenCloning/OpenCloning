import os
import tempfile

# Must be set before opencloning_mcp is imported: the database engine is created at import time
os.environ['OPENCLONING_MCP_DB_URL'] = 'sqlite:///' + os.path.join(tempfile.mkdtemp(), 'test.sqlite')

import pytest  # noqa: E402
from mcp import Client  # noqa: E402

from opencloning_mcp import db  # noqa: E402
from opencloning_mcp.server import mcp  # noqa: E402

db.init_db()


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
async def client():
    """An MCP client connected in memory to the server (no network)."""
    async with Client(mcp) as c:
        yield c
