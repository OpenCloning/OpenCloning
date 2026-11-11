"""Per-request context shared between the request middleware, auth code and log records."""

from contextvars import ContextVar, Token
from dataclasses import dataclass


@dataclass(slots=True)
class RequestContext:
    """Mutable on purpose: code running in a copied context (threadpool, task group)
    still updates the object created by the middleware, so ``user_id`` bound during
    auth is visible when the request is logged on completion."""

    request_id: str
    user_id: str | None = None
    # Set for handled server errors (HTTPException with status >= 500), see middleware
    error_detail: str | None = None


_request_context: ContextVar[RequestContext | None] = ContextVar('opencloning_request_context', default=None)


def get_request_context() -> RequestContext | None:
    return _request_context.get()


def set_request_context(ctx: RequestContext) -> Token:
    return _request_context.set(ctx)


def reset_request_context(token: Token) -> None:
    _request_context.reset(token)


def current_request_id() -> str | None:
    ctx = _request_context.get()
    return ctx.request_id if ctx is not None else None


def bind_user_to_request_context(subject: str) -> None:
    """Attach the authenticated user's external subject (e.g. Clerk user ID) to the request logs."""
    ctx = _request_context.get()
    if ctx is not None:
        ctx.user_id = subject
