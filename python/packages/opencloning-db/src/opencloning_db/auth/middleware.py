"""Authentication wrappers for mounted ASGI applications."""

from collections.abc import Awaitable, Callable

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

RequestVerifier = Callable[[Headers], Awaitable[None]]


class AuthenticatedSubApp:
    """Require bearer authentication before forwarding to a mounted sub-application."""

    def __init__(self, app: ASGIApp, verify_request: RequestVerifier):
        self.app = app
        self.verify_request = verify_request

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http' or scope['method'] == 'OPTIONS':
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        try:
            await self.verify_request(headers)
        except HTTPException as exc:
            response = JSONResponse(
                {'detail': exc.detail},
                status_code=exc.status_code,
                headers=exc.headers,
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
