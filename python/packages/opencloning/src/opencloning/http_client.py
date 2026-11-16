# Response is imported into other modules from here
from httpx2 import (  # noqa: F401
    Response,
    AsyncClient,
    ConnectError,
    TimeoutException,
    AsyncHTTPTransport,
    Request,
)
import os

import ssl
import certifi
from .app_settings import settings
from .external_service_errors import (  # noqa: F401
    ExternalServiceError,
    ExternalServiceTimeout,
    ExternalServiceUnavailable,
    ExternalServiceNotAllowed,
)

allowed_external_urls = settings.ALLOWED_EXTERNAL_URLS

if settings.PLANNOTATE_URL:
    allowed_external_urls.append(settings.PLANNOTATE_URL)

_oidc_issuer_url = os.environ.get('OIDC_ISSUER_URL')
if _oidc_issuer_url:
    allowed_external_urls.append(_oidc_issuer_url.rstrip('/'))


class AllowedExternalUrlsTransport(AsyncHTTPTransport):
    async def handle_async_request(self, request: Request) -> Response:
        host = request.url.host
        if not any(str(request.url).startswith(url) for url in allowed_external_urls):
            raise ExternalServiceNotAllowed(f'Request to {request.url} is not allowed')
        try:
            return await super().handle_async_request(request)
        except TimeoutException as e:
            raise ExternalServiceTimeout(f'{host} took too long to respond, try again later') from e
        except ConnectError as e:
            raise ExternalServiceUnavailable(f'Cannot connect to {host}, try again later') from e


proxy = None
if settings.PROXY_URL:
    proxy = settings.PROXY_URL


def get_http_client(timeout: float | None = None):
    """Client for requests to external services. ``timeout`` defaults to ``EXTERNAL_REQUEST_TIMEOUT``."""
    transport = AllowedExternalUrlsTransport()
    client_ctx = None
    if proxy is not None:
        client_ctx = ssl.create_default_context(cafile=certifi.where())
        if settings.PROXY_CERT_FILE:
            client_ctx.load_verify_locations(cafile=settings.PROXY_CERT_FILE)
    return AsyncClient(
        proxy=proxy,
        verify=client_ctx,
        transport=transport,
        timeout=settings.EXTERNAL_REQUEST_TIMEOUT if timeout is None else timeout,
    )
