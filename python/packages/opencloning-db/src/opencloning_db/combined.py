"""Parent application that serves OpenCloning and opencloning-db under separate roots."""

from fastapi import FastAPI
from sqlalchemy.orm import Session
from starlette.datastructures import Headers
from starlette.types import ASGIApp

from opencloning.main import create_fastapi_app as create_cloning_fastapi_app
from opencloning.main import wrap_with_cors as wrap_cloning_with_cors
from opencloning.observability.middleware import RequestContextMiddleware, register_error_handlers

from opencloning_db.auth.middleware import AuthenticatedSubApp, RequestVerifier
from opencloning_db.api import create_app as create_db_app
from opencloning_db.config import get_config
from opencloning_db.db import get_engine
from opencloning_db.deps import parse_bearer_token, resolve_user_from_token


async def verify_local_bearer_request(headers: Headers) -> None:
    config = get_config()
    session = Session(get_engine(config))
    try:
        token = parse_bearer_token(headers.get('authorization'))
        await resolve_user_from_token(token, session, config)
    finally:
        session.close()


def create_app(
    *,
    cloning_app: ASGIApp | None = None,
    db_app: ASGIApp | None = None,
    cloning_verifier: RequestVerifier | None = None,
) -> FastAPI:
    app = FastAPI(
        title='OpenCloning Combined API',
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    register_error_handlers(app)

    # CORS wraps the auth check, so that 401 responses can be read by the browser.
    app.mount(
        '/cloning',
        wrap_cloning_with_cors(
            AuthenticatedSubApp(
                cloning_app or create_cloning_fastapi_app(),
                cloning_verifier or verify_local_bearer_request,
            )
        ),
    )
    app.mount('/db', db_app or create_db_app())

    @app.get('/')
    async def root() -> dict[str, str]:
        return {
            'cloning': '/cloning',
            'cloning_docs': '/cloning/docs',
            'db': '/db',
            'db_docs': '/db/docs',
        }

    return app


app = RequestContextMiddleware(create_app())
