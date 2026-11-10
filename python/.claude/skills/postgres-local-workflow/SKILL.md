---
name: postgres-local-workflow
description: "Use when working on OpenCloning local Postgres setup, .env.dev loading, docker compose database startup, dev/test/e2e database roles, or seeding and running opencloning-db locally."
---

# Postgres Local Workflow

Use this skill when you need the repo-specific local database workflow for OpenCloning.

## Source Of Truth

- Docker DB service: `docker/docker-compose.postgres.yml`
- Extra local databases: `docker/postgres/init-multiple-databases.sql`
- Required local env exports: `.env.dev`
- DB/API quickstart: `packages/opencloning-db/README.md`
- CLI quickstart: `packages/opencloning-cli/README.md`

## Local Database Roles

- `opencloning_dev`: normal host-side local development database.
- `opencloning_test`: backend and CLI tests against Docker Postgres.
- `opencloning_e2e`: reserved for end-to-end work when needed.

The Docker init SQL creates `opencloning_test` and `opencloning_e2e` if they do not already exist. If you need those init hooks to run again, recreate the Docker volume.

## Standard Local Setup

Run from the repository root:

```bash
uv sync
docker compose -f docker/docker-compose.postgres.yml up -d
source .env.dev
uv run opencloning-cli db migrate
OPENCLONING_TESTING=1 uv run opencloning-cli db seed
uv run uvicorn opencloning_db.api:app --port 8001 --reload --reload-exclude='.venv'
```

Inside the dev container (`DEVCONTAINER=true`), Postgres already runs as a sidecar on `localhost:5432` migrations run on container creation, and `.env.dev` is already loaded into the environment: skip `docker compose` (not available there) and `source .env.dev`.

`.env.dev` sets `OIDC_TEST_MODE=1` for local and test auth (`Authorization: Bearer test:<subject>|<email>|<display_name>`). Seeded users start unlinked; the first matching email attaches that identity. `OPENCLONING_TESTING=1` is only for seed, stubs, and `/__test/reset-db`.

## Required Runtime Environment

Runtime config must be present in env.

Expected variables are defined in `.env.dev` for local development.

Load them with:

```bash
source .env.dev
```
