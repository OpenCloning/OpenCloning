"""Request ID middleware, request completion log and generic 500 responses."""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse, Response
from starlette.datastructures import MutableHeaders
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .context import (
    RequestContext,
    current_request_id,
    get_request_context,
    reset_request_context,
    set_request_context,
)

REQUEST_ID_HEADER = 'x-request-id'

logger = logging.getLogger('opencloning.request')


def internal_error_body() -> dict:
    return {'detail': 'Internal Server Error', 'request_id': current_request_id()}


async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Only builds the response (inside CORS, so browsers can read it). Logging happens once in
    # RequestContextMiddleware: Starlette re-raises the exception after this handler returns.
    return JSONResponse(internal_error_body(), status_code=500)


async def server_error_http_exception_handler(request: Request, exc: StarletteHTTPException) -> Response:
    """Remember why a request failed with a handled 5xx, so ``request_completed`` can report it.

    The response is FastAPI's default one. Details of 4xx responses are not recorded: they often
    echo user input, and 401/403 have their own events.
    """
    ctx = get_request_context()
    if exc.status_code >= 500 and ctx is not None:
        ctx.error_detail = str(exc.detail)
    return await http_exception_handler(request, exc)


def register_error_handlers(app: FastAPI) -> None:
    """Generic JSON 500 (with the request ID) for unhandled exceptions; failure reasons for handled 5xx."""
    app.add_exception_handler(Exception, internal_error_handler)
    app.add_exception_handler(StarletteHTTPException, server_error_http_exception_handler)


def _route_template(scope: Scope) -> str:
    route = scope.get('route')
    path = getattr(route, 'path', None)
    if path is None:
        return 'unmatched'
    return scope.get('root_path', '') + path


class RequestContextMiddleware:
    """Pure ASGI middleware, meant to be the outermost layer of the app.

    - Generates a request ID, exposes it to logs (contextvar) and returns it as ``X-Request-ID``.
    - Logs unhandled exceptions once (with stack) and answers with a generic JSON 500.
    - Logs one ``request_completed`` event per request (no query strings, bodies, headers or IPs).

    Nested instances pass through, so wrapping an already wrapped app is harmless.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http' or get_request_context() is not None:
            await self.app(scope, receive, send)
            return

        # Always generated server-side; any inbound X-Request-ID header is ignored.
        ctx = RequestContext(request_id=str(uuid.uuid4()))
        token = set_request_context(ctx)
        status_code: int | None = None
        crashed = False
        start = time.perf_counter()

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message['type'] == 'http.response.start':
                status_code = message['status']
                MutableHeaders(scope=message).append(REQUEST_ID_HEADER, ctx.request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            crashed = True
            # Logged here once; not re-raised, so the server does not log a second (multi-line) traceback.
            logger.error('unhandled_exception', exc_info=True)
            if status_code is None:
                response = JSONResponse(internal_error_body(), status_code=500)
                await response(scope, receive, send_with_request_id)
        finally:
            # A crash after the response started (e.g. while streaming) keeps its 2xx status, but is a failure.
            failed = crashed or status_code is None or status_code >= 500
            level = logging.WARNING if failed else logging.INFO
            extra = {
                'method': scope['method'],
                'route': _route_template(scope),
                'status': status_code,
                'duration_ms': round((time.perf_counter() - start) * 1000, 1),
            }
            if ctx.error_detail is not None:
                extra['detail'] = ctx.error_detail
            logger.log(level, 'request_completed', extra=extra)
            reset_request_context(token)
