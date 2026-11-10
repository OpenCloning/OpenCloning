# opencloning-cli

`opencloning-cli` is the command-line companion to the OpenCloning backend. It provides Alembic-backed schema management, guarded local seeding, stub workflows and admin commands for `opencloning-db`.

## Install

`opencloning-cli` is a `uv` workspace member. From the repository root:

```bash
uv sync
uv run opencloning-cli --help
```

## Apply schema migrations

Use `db migrate` to bring the configured database to Alembic head. On an empty database this creates all tables (starts from baseline revision `faa1e883e333`).

```bash
source .env.dev
uv run opencloning-cli db migrate
```

Equivalent to `uv run alembic -c packages/opencloning-db/alembic.ini upgrade head` with `OPENCLONING_DB_URL` set. See [opencloning-db/README.md](../opencloning-db/README.md) for autogenerate workflow.

## Seed local DB state

`db seed` clears object-storage prefixes, ensures schema at head, truncates application tables, and loads the deterministic demo/test baseline. It only runs when `OPENCLONING_TESTING=1`.

```bash
source .env.dev
OPENCLONING_TESTING=1 uv run opencloning-cli db seed
```

Use `--recreate-schema` to drop and recreate the `public` schema before migrating (for broken mid-dev states).

## Admin commands

Admin commands read and write the configured database directly. Load `.env.dev` first.

```bash
source .env.dev
uv run opencloning-cli admin list-users
uv run opencloning-cli admin list-workspaces
uv run opencloning-cli admin assign-user view-only-user@example.com 1 --role editor
uv run opencloning-cli admin set-instance-admin bootstrap@example.com
```

Local `.env.dev` sets `OIDC_TEST_MODE=1`, which accepts `test:...` bearer tokens and requires `OPENCLONING_TESTING=1` and only localhost/127.0.0.1 origins (config loading fails otherwise). The origin check does not restrict network access, so only expose a test-mode server on a trusted network. `OPENCLONING_TESTING=1` is also required for `db seed` and `db stubs`.

## Generate DB Stubs

 Use `db stubs` to generate JSON stubs for frontend testing. By default it writes one JSON file per yielded stub request into `./stubs/db` (for example, `get_primers.json`, `get_sequences.json`, and similar request-specific files).

`db stubs` writes JSON request/response fixtures for frontend or integration tests. It requires `OPENCLONING_TESTING=1` because it calls `db seed` between cases.

```bash
source .env.dev
OPENCLONING_TESTING=1 uv run opencloning-cli db stubs --output-dir ./stubs/db
```

The command reseeds the database to the default baseline between stub cases and records the yielded stub requests as separate files in the output directory.
