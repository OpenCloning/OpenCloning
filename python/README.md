[![CI](https://github.com/OpenCloning/OpenCloning/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenCloning/OpenCloning/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/OpenCloning/OpenCloning/graph/badge.svg?flag=python)](https://codecov.io/gh/OpenCloning/OpenCloning)

# OpenCloning Backend monorepo

This directory of the OpenCloning repository contains the backend API and the database API. Before going further, please check out the [project website](https://opencloning.org) and read the [main project readme](../README.md).

This directory contains two main packages, a CLI and an experimental MCP server that are part of the OpenCloning project. Check out their respective readmes for more information on how to run them locally or using Docker:
- [opencloning](./packages/opencloning/README.md): the backend API for *in silico* cloning
- [opencloning-db](./packages/opencloning-db/README.md): the database API to store a collection of plasmids, primers, and lines.
- [opencloning-cli](./packages/opencloning-cli/README.md): useful CLI for development and testing.
- [opencloning-mcp](./packages/opencloning-mcp): **experimental** MCP server. Its interface may change without notice, and it is excluded from test coverage.

## Running the cloning API locally - for the OpenCloning frontend

From the repository root:

```bash
# Install or update workspace dependencies
uv sync
# Run the cloning API
uv run uvicorn opencloning.main:app --reload --reload-exclude='.venv'
```

## Running both the cloning and the database API locally - for the OpenCloningDB frontend

From the repository root:

```bash
# Install or update workspace dependencies
uv sync
# Load required local runtime config
source .env.dev
# If you are using mac, you may have to stop any local Postgres instances running on port 5432
brew services stop postgresql
# Start local Postgres with dev/test/e2e databases
docker compose -f docker/docker-compose.postgres.yml up -d
# Apply schema migrations (creates tables on an empty database)
uv run opencloning-cli db migrate
# Optional: load the deterministic demo/test baseline
OPENCLONING_TESTING=1 uv run opencloning-cli db seed
# Run the database API
uv run uvicorn opencloning_db.combined:app --reload --reload-exclude='.venv'
```

That will serve the cloning API at [http://127.0.0.1:8000/cloning](http://127.0.0.1:8000/cloning) and the database API at [http://127.0.0.1:8001/db](http://127.0.0.1:8001/db).

`.env.dev` sets `OIDC_TEST_MODE=1`, so the API accepts `Authorization: Bearer test:<subject>|<display_name>` or `test:<subject>|<email>|<display_name>` without JWKS. Seeded users (for example `bootstrap+clerk_test@example.com`) have no OIDC identity yet; the first token with that email links the existing row. `OIDC_TEST_MODE=1` requires `OPENCLONING_TESTING=1` and only localhost/127.0.0.1 origins in `ALLOWED_ORIGINS` and `OIDC_AUTHORIZED_PARTIES` (config loading fails otherwise), which is also required for `db seed`, `db stubs`, and `/__test/reset-db`. The origin check is a config sanity check, not a network restriction: any client that can reach the server can authenticate as any user with a test token, so only expose a test-mode server on a trusted network. For a real identity provider, set `OIDC_TEST_MODE=0` and a real `OIDC_ISSUER_URL`.

## Upload limits

File uploads are size-limited; requests above the limit are rejected with HTTP 413. Primer sequences are limited to 1000 bp (not configurable).

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_SEQUENCE_FILE_SIZE_MB` | `10` | Maximum size (MB) of each uploaded sequence file (GenBank, FASTA, SnapGene, cloning strategy JSON...) |
| `MAX_SEQUENCING_FILE_SIZE_MB` | `20` | Maximum size (MB) of each uploaded sequencing file (database API only) |
| `MAX_REQUEST_BODY_SIZE_MB` | `100` | Maximum size (MB) of any request body, enforced while it is received, so oversized uploads are rejected before they are written to temporary files |

## Database connections

Each process (each gunicorn worker) has its own connection pool, and can open up to `DB_POOL_SIZE + DB_MAX_OVERFLOW` connections to Postgres. Keep `GUNICORN_WORKERS * (DB_POOL_SIZE + DB_MAX_OVERFLOW)`, plus any other clients of the database, below the connection limit of the Postgres server. When all the connections of a worker are in use, requests wait for a free one (up to 30 s) instead of failing.

| Variable | Default | Description |
| --- | --- | --- |
| `DB_POOL_SIZE` | `5` | Connections kept open in the pool of each process (database API only) |
| `DB_MAX_OVERFLOW` | `4` | Extra connections each process can open when the pool is in use (database API only) |

## Logging and request IDs

Both apps log one JSON object per line to stdout, for all loggers (app code, gunicorn, uvicorn, libraries). Every response carries an `X-Request-ID` header, and the same `request_id` is stamped on every log record of that request, so an error shown in the frontend can be traced to the server logs. Each request produces one `request_completed` event (method, route template, status, duration). Request bodies, query strings, headers and client IPs are never logged.

| Variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `INFO` | Log level of the root and gunicorn loggers |

The JSON logging is configured by gunicorn, through [`opencloning/observability/gunicorn_conf.py`](packages/opencloning/src/opencloning/observability/gunicorn_conf.py) (which also reads `GUNICORN_WORKERS` and `GUNICORN_TIMEOUT`), so it applies to the Docker images. Plain `uvicorn` (as in the commands above) keeps uvicorn's default logs, which is what you want during development. To see the JSON logs locally, run the app the way the image does (no `--reload`):

```bash
uv run gunicorn -c python:opencloning.observability.gunicorn_conf opencloning_db.combined:app
```

## Dependency guardrail (deptry)

This repository uses a uv workspace. In a workspace, dependencies are resolved in one shared environment, so imports can appear to work even when a package does not declare them in its own `pyproject.toml`.

To catch that, pre-commit runs `deptry` separately for `opencloning` and `opencloning-db`, each using that package’s `pyproject.toml` as the source of truth for declared dependencies.

Run them manually from the repository root:

```bash
uv run deptry --config packages/opencloning/pyproject.toml packages/opencloning/src
uv run deptry --config packages/opencloning-db/pyproject.toml packages/opencloning-db/src
```

## Scripting with pydna

You can write python scripts to automate cloning using the python library [pydna](https://github.com/pydna-group/pydna), which is now integrated with the OpenCloning data model. See [the documentation](https://github.com/pydna-group/pydna/blob/master/docs/notebooks/history.ipynb) for how to get started.

## Contributing :hammer_and_wrench:

Check the [contribution guidelines](../CONTRIBUTING.md) for general guidelines.

For more specific tasks:
* Creating a new type of source: follow the [new source issue template](../.github/ISSUE_TEMPLATE/new-source.md). You can create an issue like that [here](https://github.com/OpenCloning/OpenCloning/issues/new?template=new-source.md).

## Notes

### Pin a particular library version from GitHub

Do not do the default:

```
uv add git+https://github.com/pydna-group/pydna --branch main
uv add git+https://github.com/pydna-group/pydna --rev 4fd760d075f77cceeb27969e017e04b42f6d0aa3
```

Instead, edit pyproject directly:

```
pydna @ git+https://github.com/pydna-group/pydna@fa00f2a1240bd2caae7a89c808a464f297209ecf
```

The reason for this is that otherwise you cannot install the package from pip from the repository,
as the github version is not pinned. For the same reasons, you don't want to publish this to pypi,
and this will make the action fail.

If resolution seems stale, clear uv’s cache:

```bash
uv cache clean
```
