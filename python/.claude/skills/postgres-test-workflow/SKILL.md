---
name: postgres-test-workflow
description: "Use when running or debugging OpenCloning Postgres-backed tests, understanding OPENCLONING_TEST_DATABASE_URL, backend test fixtures, CLI smoke tests, or which pytest command to run for database validation."
---

# Postgres Test Workflow

Use this skill when you need the repo-specific test workflow for Postgres-backed backend or CLI validation.

## Source Of Truth

- Backend DB fixtures: `packages/opencloning-db/tests/conftest.py`
- CLI test fixtures: `packages/opencloning-cli/tests/conftest.py`
- Config behavior: `packages/opencloning-db/src/opencloning_db/config.py`
- Main backend test suite: `packages/opencloning-db/tests`
- CLI smoke tests: `packages/opencloning-cli/tests/test_commands.py`

## Test Databases

- Default runtime DB for host-side development comes from `.env.dev` and usually points to `opencloning_dev`.
- Tests normally use `opencloning_test`.
- Override the test DB with `OPENCLONING_TEST_DATABASE_URL` if you need a different Postgres database for the test slice.

Example:

```bash
export OPENCLONING_TEST_DATABASE_URL=postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_test
```

## Migrations in CI

Host CI applies migrations against `opencloning_test` before pytest with `uv run alembic -c packages/opencloning-db/alembic.ini upgrade head`. The Docker-compose test job likewise runs `alembic ... upgrade head`. Tests also call `opencloning_db.migrations.ensure_schema` via `reset_database`.

## How Fixtures Work

`packages/opencloning-db/tests/conftest.py`:

- builds a `Config(...)` explicitly for tests instead of depending on ambient runtime env
- uses temporary directories for `sequence_files_dir` and `sequencing_files_dir`
- ensures schema at Alembic head via `opencloning_db.migrations.reset_database`, then truncates tables between tests
- overrides FastAPI `get_db` for integration-style API tests

`packages/opencloning-cli/tests/conftest.py`:

- points CLI smoke tests at `OPENCLONING_TEST_DATABASE_URL` or its default `opencloning_test`
- creates temporary workspace directories for generated files
- swaps the cached runtime config for the duration of each test
