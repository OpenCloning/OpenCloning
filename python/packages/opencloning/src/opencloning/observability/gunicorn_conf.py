"""Gunicorn configuration, loaded with ``gunicorn -c python:opencloning.observability.gunicorn_conf``.

Environment variables: GUNICORN_WORKERS (default 2), GUNICORN_TIMEOUT (default 20), LOG_LEVEL,
plus the logging variables documented in :mod:`opencloning.observability.logging_config`.

The docker image has no shell, so this file also does what an entrypoint script would:

- APP_TARGET (cloning, db or mcp): which app to serve when none is given on the command line.
- USE_HTTPS=true: serve TLS with /certs/key.pem and /certs/cert.pem.
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

APP_MODULES = {
    'cloning': 'opencloning.main:app',
    'db': 'opencloning_db.combined:app',
    'mcp': 'opencloning_mcp.server:app()',
}
_app_target = os.getenv('APP_TARGET')
if _app_target:
    if _app_target not in APP_MODULES:
        raise RuntimeError(f'APP_TARGET must be one of {", ".join(APP_MODULES)}, got {_app_target!r}')
    # An app given on the command line takes precedence over this
    wsgi_app = APP_MODULES[_app_target]

if os.getenv('USE_HTTPS', 'false').lower() == 'true':
    keyfile = '/certs/key.pem'
    certfile = '/certs/cert.pem'
    for _path in (keyfile, certfile):
        if not os.access(_path, os.R_OK):
            raise RuntimeError(f'USE_HTTPS=true but TLS file {_path} does not exist or is not readable')
