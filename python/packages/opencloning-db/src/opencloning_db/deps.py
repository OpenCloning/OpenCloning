"""FastAPI dependencies: database session and current user."""

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from opencloning.observability.context import bind_user_to_request_context
from sqlalchemy.orm import Session

from opencloning_db.auth.oidc import verify_oidc_bearer_token
from opencloning_db.auth.provisioning import resolve_oidc_user
from opencloning_db.config import Config, get_config
from opencloning_db.db import get_engine
from opencloning_db.models import User

# auto_error=False: the scheme is only declared here (for the OpenAPI docs). The header itself is
# validated by parse_bearer_token, so that missing or malformed headers are logged as on /cloning.
bearer_scheme = HTTPBearer(auto_error=False)

logger = logging.getLogger('opencloning_db.auth')


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )


def parse_bearer_token(authorization: str | None) -> str:
    if authorization is None:
        logger.warning('auth_failed', extra={'reason': 'missing_header'})
        raise credentials_exception()

    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        logger.warning('auth_failed', extra={'reason': 'bad_scheme'})
        raise credentials_exception()
    return token


async def resolve_user_from_token(token: str, session: Session, config: Config) -> User:
    try:
        identity = await verify_oidc_bearer_token(token, config)
    except InvalidTokenError as e:
        # error_type is the PyJWT exception class (e.g. ExpiredSignatureError), never token content
        extra = {'reason': 'invalid_token', 'error_type': type(e).__name__}
        if type(e) is InvalidTokenError:
            # Raised by our own OIDC code with constant messages (never token content).
            extra['detail'] = str(e)
        logger.warning('auth_failed', extra=extra)
        raise credentials_exception()
    bind_user_to_request_context(identity.subject)
    return resolve_oidc_user(session, config, identity)


def get_db(config: Annotated[Config, Depends(get_config)]):
    session = Session(get_engine(config))
    try:
        yield session
    finally:
        session.close()


async def get_current_user(
    request: Request,
    _credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[Session, Depends(get_db)],
    config: Annotated[Config, Depends(get_config)],
) -> User:
    token = parse_bearer_token(request.headers.get('authorization'))
    return await resolve_user_from_token(token, session, config)
