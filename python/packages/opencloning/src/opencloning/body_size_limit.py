"""Cap the size of request bodies while they are received."""

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class MaxBodySizeMiddleware:
    """Pure ASGI middleware that answers 413 when a request body exceeds ``max_size_mb`` megabytes.

    Starlette parses and spools multipart uploads to temporary files before route code runs, so
    per-file checks like ``read_upload_with_limit`` cannot stop an oversized request from filling the
    disk. Here the body is counted as it arrives, which also covers chunked requests.

    Add it with ``app.add_middleware`` so it sits inside CORS, and browsers can read the 413.
    """

    def __init__(self, app: ASGIApp, max_size_mb: int):
        self.app = app
        self.max_bytes = max_size_mb * 1024 * 1024
        self.detail = f'Request body exceeds the maximum size of {max_size_mb} MB'

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        content_length = dict(scope['headers']).get(b'content-length', b'')
        if content_length.isdigit() and int(content_length) > self.max_bytes:
            response = JSONResponse({'detail': self.detail}, status_code=413)
            await response(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message['type'] == 'http.request':
                received += len(message.get('body', b''))
                if received > self.max_bytes:
                    # Raised while the route reads the body. FastAPI passes HTTPException through
                    # body parsing (other errors become a 400), so the client gets the 413.
                    raise HTTPException(413, self.detail)
            return message

        await self.app(scope, limited_receive, send)
