"""Gunicorn configuration, loaded with ``gunicorn -c python:opencloning.observability.gunicorn_conf``.

Environment variables: GUNICORN_WORKERS (default 2), GUNICORN_TIMEOUT (default 20), LOG_LEVEL,
plus the logging variables documented in :mod:`opencloning.observability.logging_config`.
"""

import os

from opencloning.observability.logging_config import build_logging_config

bind = '0.0.0.0:8000'
workers = int(os.getenv('GUNICORN_WORKERS', '2'))
timeout = int(os.getenv('GUNICORN_TIMEOUT', '20'))
worker_class = 'uvicorn_worker.UvicornWorker'
control_socket_disable = True
# Keep the DB engine, OIDC caches and HTTP clients per worker (created lazily after fork).
preload_app = False

# Gunicorn and uvicorn access logs are replaced by the ``request_completed`` event of
# RequestContextMiddleware. The worker copies gunicorn's (empty) access handlers to uvicorn.access.
accesslog = None
errorlog = '-'
loglevel = (os.getenv('LOG_LEVEL') or 'info').lower()
logconfig_dict = build_logging_config()
