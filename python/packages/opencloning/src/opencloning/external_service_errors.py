"""Errors of requests to external services (NCBI, Addgene, etc.), raised by the client in ``http_client``.

The web app turns them into a response with ``status_code`` (see ``register_error_handlers``), so the
request code does not depend on FastAPI. They live in their own module so that reloading ``http_client``
(as some tests do) does not create new classes that the registered handler would not recognise.
"""


class ExternalServiceError(Exception):
    status_code = 502


class ExternalServiceTimeout(ExternalServiceError):
    status_code = 504


class ExternalServiceUnavailable(ExternalServiceError):
    status_code = 503


class ExternalServiceNotAllowed(ExternalServiceError):
    status_code = 403
