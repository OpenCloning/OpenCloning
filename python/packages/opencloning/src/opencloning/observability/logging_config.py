"""Logging configuration: one JSON object per line on stdout for every logger.

Environment variables:
    LOG_LEVEL            root / gunicorn log level (default: INFO)
"""

import logging
import os
from typing import Any

from pythonjsonlogger.json import JsonFormatter

from .._version import __version__
from .context import get_request_context


class RequestContextFilter(logging.Filter):
    """Stamp request_id / user_id from the current request on every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        ctx = get_request_context()
        record.request_id = ctx.request_id if ctx else None
        record.user_id = ctx.user_id if ctx else None
        return True


class OpenCloningJsonFormatter(JsonFormatter):
    """JSON formatter: ISO 8601 UTC ``timestamp``, lowercase ``level``, ``logger``, ``pid`` and ``version``.

    Exceptions are emitted by python-json-logger as a single (JSON-escaped) ``exc_info`` string.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault('fmt', '%(levelname)s %(name)s %(process)d %(message)s')
        kwargs.setdefault('rename_fields', {'levelname': 'level', 'name': 'logger', 'process': 'pid'})
        kwargs.setdefault('timestamp', True)
        kwargs.setdefault('static_fields', {'version': __version__})
        super().__init__(*args, **kwargs)

    def process_log_record(self, log_data: dict[str, Any]) -> dict[str, Any]:
        if isinstance(log_data.get('level'), str):
            log_data['level'] = log_data['level'].lower()
        # Put the most useful fields first, so truncated lines in Live tail still show them.
        ordered = {key: log_data.pop(key) for key in ('timestamp', 'level', 'message') if key in log_data}
        ordered.update(log_data)
        return ordered


def build_logging_config(level: str | None = None) -> dict[str, Any]:
    """Return a ``logging.config.dictConfig`` dict (also used as gunicorn's ``logconfig_dict``)."""
    level = (level or os.getenv('LOG_LEVEL') or 'INFO').upper()
    handler_ids = ['stdout']
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'filters': {'request_context': {'()': RequestContextFilter}},
        'formatters': {'json': {'()': OpenCloningJsonFormatter}},
        'handlers': {
            'stdout': {
                'class': 'logging.StreamHandler',
                'stream': 'ext://sys.stdout',
                'formatter': 'json',
                'filters': ['request_context'],
            },
        },
        'root': {'level': level, 'handlers': handler_ids},
        'loggers': {
            'gunicorn.error': {'level': level, 'handlers': handler_ids, 'propagate': False},
            # Access logs are replaced by the ``request_completed`` event of RequestContextMiddleware.
            'gunicorn.access': {'level': 'INFO', 'handlers': [], 'propagate': False},
            'uvicorn.access': {'level': 'WARNING', 'handlers': [], 'propagate': False},
            # httpx2 logs full outbound URLs at INFO, which may contain user input or credentials.
            'httpx2': {'level': 'WARNING'},
            'httpcore2': {'level': 'WARNING'},
            'sqlalchemy.engine': {'level': 'WARNING'},
        },
    }
