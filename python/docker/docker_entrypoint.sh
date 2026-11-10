# APP_TARGET: which app to run — must be exactly one of:
#   cloning  -> opencloning.main:app
#   db       -> opencloning_db.combined:app
#
# GUNICORN_WORKERS: Gunicorn worker processes (default: 2).
# GUNICORN_TIMEOUT: the timeout for each worker process (default: 20).
# LOG_LEVEL: see opencloning/observability/logging_config.py
#
# Gunicorn settings (worker class, logging as one JSON object per line) live in
# opencloning/observability/gunicorn_conf.py.

case "${APP_TARGET}" in
    cloning) APP_MODULE=opencloning.main ;;
    db) APP_MODULE=opencloning_db.combined ;;
    *)
        echo "Error: APP_TARGET must be cloning or db" >&2
        exit 1
        ;;
esac

GUNICORN_ARGS=(
    -c python:opencloning.observability.gunicorn_conf
    "${APP_MODULE}:app"
)

if [ "$USE_HTTPS" = "true" ]; then
    if [ ! -f "/certs/key.pem" ] || [ ! -f "/certs/cert.pem" ] || [ ! -r "/certs/key.pem" ] || [ ! -r "/certs/cert.pem" ]; then
        echo "Error: TLS certificate files /certs/key.pem and /certs/cert.pem must both exist and be readable"
        exit 1
    fi
    exec gunicorn "${GUNICORN_ARGS[@]}" --keyfile /certs/key.pem --certfile /certs/cert.pem
else
    exec gunicorn "${GUNICORN_ARGS[@]}"
fi
