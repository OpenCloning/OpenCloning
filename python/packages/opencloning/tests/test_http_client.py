import unittest

import httpx2
import pytest
import respx

from opencloning.app_settings import settings
from opencloning.external_service_errors import (
    ExternalServiceNotAllowed,
    ExternalServiceTimeout,
    ExternalServiceUnavailable,
)
from opencloning.http_client import get_http_client

URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/dummy'


class HttpClientErrorsTest(unittest.IsolatedAsyncioTestCase):

    @respx.mock
    async def test_timeout(self):
        respx.get(URL).mock(side_effect=httpx2.ReadTimeout('timeout'))
        async with get_http_client() as client:
            with pytest.raises(ExternalServiceTimeout) as e:
                await client.get(URL)
        assert e.value.status_code == 504
        assert str(e.value) == 'eutils.ncbi.nlm.nih.gov took too long to respond, try again later'

    @respx.mock
    async def test_connection_error(self):
        respx.get(URL).mock(side_effect=httpx2.ConnectError('cannot connect'))
        async with get_http_client() as client:
            with pytest.raises(ExternalServiceUnavailable) as e:
                await client.get(URL)
        assert e.value.status_code == 503
        assert str(e.value) == 'Cannot connect to eutils.ncbi.nlm.nih.gov, try again later'

    async def test_url_not_allowed(self):
        async with get_http_client() as client:
            with pytest.raises(ExternalServiceNotAllowed) as e:
                await client.get('https://not-allowed.example.com/')
        assert e.value.status_code == 403
        assert str(e.value) == 'Request to https://not-allowed.example.com/ is not allowed'


def test_timeout_setting():
    assert get_http_client().timeout.read == settings.EXTERNAL_REQUEST_TIMEOUT
    assert get_http_client(3).timeout.read == 3
