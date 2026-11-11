# opencloning-db

`opencloning-db` is the database/API companion package for the OpenCloning backend. It provides the app and local data workflows used for OpenCloning database features.

## Run locally

From the repository root:

```bash
# Install or update workspace dependencies
uv sync

# If you are using mac, you may have to stop any local Postgres instances running on port 5432
brew services stop postgresql

# Start local Postgres with dev/test/e2e databases
docker compose -f docker/docker-compose.postgres.yml up -d postgres

# Load required local runtime config
source .env.dev

# Apply schema migrations (creates tables on an empty database)
uv run opencloning-cli db migrate

# Optional: load the deterministic demo/test baseline
OPENCLONING_TESTING=1 uv run opencloning-cli db seed

# Run both the cloning and the database API - this what the OpenCloningDB frontend expects
uv run uvicorn opencloning_db.combined:app --reload --reload-exclude='.venv'

# Run the opencloning-db API (only database, not cloning. This is not used when running with the frontend)
uv run uvicorn opencloning_db.api:app --reload --reload-exclude='.venv'
```

That will serve the cloning API at [http://127.0.0.1:8000/cloning](http://127.0.0.1:8000/cloning) and the database API at [http://127.0.0.1:8001/db](http://127.0.0.1:8001/db). That's what the OpenCloningDB frontend expects.

See [Authentication](#authentication) for bearer tokens, local test mode, and a real identity provider.

## Authentication

Every database route requires `Authorization: Bearer ...`. When the cloning app is served through `opencloning_db.combined`, the `/cloning` mount uses the same check.

### Local and test

`.env.dev` sets `OIDC_TEST_MODE=1`. The API then accepts pipe-delimited tokens with no JWKS lookup:

- `test:<subject>|<display_name>`
- `test:<subject>|<email>|<display_name>`

`OIDC_TEST_MODE=1` requires `OPENCLONING_TESTING=1` and only localhost/127.0.0.1 origins in `ALLOWED_ORIGINS` and `OIDC_AUTHORIZED_PARTIES`. The origin check is a config sanity check, not a network restriction: any client that can reach the server can authenticate as any user with a test token, so only expose a test-mode server on a trusted network.

Seeded demo users (for example `bootstrap+clerk_test@example.com`) start with no OIDC identity. The first token whose email matches links that row and does not create another workspace.

`OPENCLONING_TESTING=1` only enables `db seed`, `db stubs`, and `/__test/reset-db`. It does not accept or reject bearer tokens.

### Real identity provider

Set `OIDC_TEST_MODE=0` and `OIDC_ISSUER_URL`. Optional claim names are `OIDC_SUBJECT_CLAIM`, `OIDC_EMAIL_CLAIM`, and `OIDC_NAME_CLAIM`. `OIDC_AUTHORIZED_PARTIES` lists allowed `azp` values; if unset, it falls back to `ALLOWED_ORIGINS`.

The API loads the issuer discovery document, verifies RS256 session JWTs against JWKS, and requires a matching `azp`.

## Upload limits

Uploaded files are rejected with HTTP 413 when they exceed the configured size. Primer sequences are limited to 1000 bp (not configurable).

| Variable | Default | Applies to |
| --- | --- | --- |
| `MAX_SEQUENCE_FILE_SIZE_MB` | `10` | Sequence files and cloning strategy files (`/sequences/validate-upload`, `/sequences/bulk`, `/sequences/cloning_strategy/bulk/validate`) |
| `MAX_SEQUENCING_FILE_SIZE_MB` | `20` | Each file uploaded to `/sequences/{id}/sequencing_files` |
| `MAX_REQUEST_BODY_SIZE_MB` | `100` | Whole request body of any endpoint, enforced while it is received (before uploads are written to temporary files) |

## Database migrations (Alembic)

Schema changes are defined in **`opencloning_db.models`** and applied with **Alembic** in this package (`alembic/`, `alembic.ini`). Edit the models first, generate or adjust the revision under `alembic/versions/`, then run migrations against each database.

Alembic reads the database URL from **`OPENCLONING_DB_URL`** (same as the app; load `.env.dev` for local work). Revision history is stored in the database table `alembic_version`, not in git.

From the repository root, pass the config file explicitly (or `cd packages/opencloning-db` and omit `-c`):

```bash
ALEMBIC_CFG=packages/opencloning-db/alembic.ini
# Use -c "$ALEMBIC_CFG" (quoted). Do not put -c inside the variable: zsh does not
# split $ALEMBIC on spaces, so `ALEMBIC="-c …"; alembic $ALEMBIC` breaks.
```

### Autogenerate a migration

With Postgres running and `.env.dev` loaded:

```bash
source .env.dev
ALEMBIC_CFG=packages/opencloning-db/alembic.ini

# Optional: see which revision the database is at
uv run alembic -c "$ALEMBIC_CFG" current

# 1. Change src/opencloning_db/models.py first (desired end state).
# 2. Generate a revision by diffing models against the live database:
uv run alembic -c "$ALEMBIC_CFG" revision --autogenerate -m "short description of the change"

# 3. Open the new file under packages/opencloning-db/alembic/versions/ and review it.
#    Autogenerate can miss or mis-handle partial indexes, renames, and data backfills.
```

The database you point at must reflect the **previous** migration state (run `alembic upgrade head` first, or use a fresh DB). If the schema already matches your models but `alembic_version` is empty, stamp instead of upgrading (see below).

### Run migrations

```bash
source .env.dev
ALEMBIC_CFG=packages/opencloning-db/alembic.ini

# Apply all pending revisions (CLI wrapper or Alembic directly)
uv run opencloning-cli db migrate
# uv run alembic -c "$ALEMBIC_CFG" upgrade head

# Confirm
uv run alembic -c "$ALEMBIC_CFG" current
```

To migrate a different database (for example the test DB), set `OPENCLONING_DB_URL` to that database before running Alembic.

**Schema already up to date?** If the live database already has the objects a migration would add (for example after a manual change or an older deploy), `upgrade` may fail with “already exists”. Mark the database as migrated without running SQL:

```bash
uv run alembic -c "$ALEMBIC_CFG" stamp head
```

Use `stamp` only when you are sure the live schema matches the migration chain at `head`.

### Useful commands

| Command                                               | Purpose                                       |
| ----------------------------------------------------- | --------------------------------------------- |
| `uv run alembic -c "$ALEMBIC_CFG" history`            | List revisions                                |
| `uv run alembic -c "$ALEMBIC_CFG" downgrade -1`       | Revert the last revision                      |
| `uv run alembic -c "$ALEMBIC_CFG" upgrade head --sql` | Print SQL without executing (offline preview) |

## Running tests locally

From the repository root:

```bash
# Install or update workspace dependencies
uv sync

# Run the tests
uv run pytest packages/opencloning-db/tests -v -ks
```

## Frontend testing

Frontend testing using the database requires reseeding after tests that modify the database. This is done by calling the `/__test/reset-db` endpoint with the `X-Test-Reset-Token` header set to `RESET-TOKEN`. That endpoint is only available if the `OPENCLONING_TESTING` environment variable is set to `1`, and it delegates to the guarded `opencloning-cli db seed` command. Bearer tokens are separate; see [Authentication](#authentication).

## Building and running the Docker image

The Dockerfile is shared with the cloning app, and the build arg `APP_TARGET` determines which app to build. So you can build the image by running:

```bash
docker build -f docker/opencloning.Dockerfile --build-arg APP_TARGET=db -t manulera/opencloning-db-backend .
# or
docker buildx build -f docker/opencloning.Dockerfile --build-arg APP_TARGET=db -t manulera/opencloning-db-backend:prod --platform linux/amd64,linux/arm64 .
```

Then run it for development:

```bash
# Run the containers (Postgres + db API)
docker compose \
    -f docker/docker-compose.postgres.yml \
    -f docker/docker-compose.opencloning-db.yml \
    up -d
```

## Database backup worker

To create backups, you can use [this dockerfile](../../docker/postgres-aws-cli.Dockerfile) for a worker.

To build it:

```bash
docker build -f docker/postgres-aws-cli.Dockerfile -t manulera/postgres-aws-cli .
```
