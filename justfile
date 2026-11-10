# Common commands for the monorepo. Run `just` to list them.
# Recipes with [working-directory] run inside python/ or js/ (needs just >= 1.38).

# List available recipes
default:
    @just --list

# Install Python and JS dependencies
install:
    cd python && uv sync --frozen
    cd js && yarn install --immutable

# Cloning API only (8000)
[working-directory: 'python']
[group('backend')]
dev-api-cloning:
    uv run uvicorn opencloning.main:app --reload --reload-exclude='.venv'

# Cloning API (8000) + db API (8001)
[working-directory: 'python']
[group('backend')]
dev-api-combined:
    uv run uvicorn opencloning_db.combined:app --reload --reload-exclude='.venv'

# OpenCloning frontend (3000)
[working-directory: 'js']
[group('frontend')]
dev-frontend-cloning:
    yarn start

# OpenCloningDB frontend (3000), test OIDC provider
[working-directory: 'js']
[group('frontend')]
dev-frontend-db:
    yarn workspace opencloningdb dev:test

# Cloning API + OpenCloning frontend in one terminal (Ctrl+C stops both)
[group('dev')]
dev-cloning:
    #!/usr/bin/env bash
    trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT
    just dev-api-cloning &
    just dev-frontend-cloning &
    wait -n

# Combined API + OpenCloningDB frontend in one terminal (Ctrl+C stops both)
[group('dev')]
dev-db:
    #!/usr/bin/env bash
    trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT
    just dev-api-combined &
    just dev-frontend-db &
    wait -n

# Apply database migrations
[working-directory: 'python']
[group('backend')]
db-migrate:
    uv run opencloning-cli db migrate

# Reset the local DB to the test baseline, e.g. just db-seed --recreate-schema (destructive)
[group('backend')]
[working-directory: 'python']
db-seed *args:
    OPENCLONING_TESTING=1 uv run opencloning-cli db seed {{args}}

# Python tests, e.g. just pytest -k assembly
[working-directory: 'python']
[group('backend')]
pytest *args:
    uv run pytest {{args}}

# JS unit tests, e.g. just vitest packages/ui
[working-directory: 'js']
[group('frontend')]
vitest *args:
    yarn vitest run {{args}}

# Cypress component tests, e.g. just cypress-component --spec packages/ui/src/Foo.cy.jsx
[working-directory: 'js']
[group('frontend')]
cypress-component *args:
    env -u ELECTRON_RUN_AS_NODE xvfb-run -a yarn cypress run --component {{args}}

# Cypress e2e tests, e.g. just cypress-e2e --spec cypress/e2e/group-3/source_empty.cy.js
[working-directory: 'js']
[group('frontend')]
cypress-e2e *args:
    env -u ELECTRON_RUN_AS_NODE xvfb-run -a yarn cypress run --e2e {{args}}

# All pre-commit checks on all files
lint:
    pre-commit run --all-files
