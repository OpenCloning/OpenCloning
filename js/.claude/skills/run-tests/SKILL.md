---
name: run-tests
description: How to run the unit (vitest), component and e2e (Cypress) tests inside the dev container. Use when running, debugging or verifying tests, especially if Cypress fails with "Cannot find module 'electron'".
---

# Running tests in the dev container

Use the `just` recipes from the repository root (`/workspace`); they run inside `js/`, so `--spec`
paths are relative to `js/`. Run `just` to list all recipes.

## Vitest (unit tests)

```bash
just vitest                                                          # all
just vitest packages/ui/src/components/assembler/assembler_utils.test.js   # one file
```

No backend needed.

## Cypress component tests

Some component tests call the cloning API, so start it first, in the background:

```bash
just dev-api-cloning
just cypress-component --spec packages/ui/src/components/assembler/UploadPlasmidsButton.cy.jsx
```

- The backend must be the **cloning API** (`dev-api-cloning`), not the combined one (`dev-api-combined`
  serves the cloning API under `/cloning`, so the tests get 404s).
- Component tests are served from `localhost:5173` (pinned in `cypress.config.js`), which must be in the
  backend's `ALLOWED_ORIGINS` (it is in `.env.dev`). CORS failures show up in the backend log as
  `OPTIONS ... 400 Bad Request`.
- OpenCloningDB requests must be stubbed (`cy.interceptOpenCloningDBStub` / `cy.intercept`): an unstubbed
  one fails the test with "Unstubbed OpenCloningDB request in a component test" (see `cypress/support/component.js`).

## Cypress e2e tests

Specs live in `cypress/e2e/group-*/`. They need the backend at `localhost:8000` and the frontend at
`localhost:3000`, both started from the dev container:

```bash
just dev-cloning      # cloning API + OpenCloning frontend (Ctrl+C stops both)
just dev-db           # or: combined API + OpenCloningDB frontend, for the opencloningdb groups
                      #     (needs Postgres seeded: just db-seed)
just cypress-e2e --spec cypress/e2e/group-3/source_empty.cy.js
```

Check the servers with `curl localhost:8000` and `curl localhost:3000`. Failed runs leave screenshots in
`js/cypress/screenshots/`; delete them. Specs that call external services (e.g. NCBI genome lookups) can
fail because the container firewall only allows a fixed set of domains.

## Why the recipes wrap Cypress

- `env -u ELECTRON_RUN_AS_NODE`: the shell may have `ELECTRON_RUN_AS_NODE=1` set (e.g. by the VS Code
  extension). This makes Cypress's Electron run as plain Node and fail with `Cannot find module 'electron'`.
- `xvfb-run -a`: the container has no display; Xvfb provides a virtual one. For the same reason
  `just cypress-open` (interactive UI) only works on the local machine, not in the container.

## Tips

- Output is noisy with vite "externalized for browser compatibility" warnings; pipe through `tail -50` to
  see the test results.
- Use a timeout (Cypress startup can take a while); the first run compiles with vite.
- Run the full e2e suite in parallel with `js/run_tests_in_parallel.sh` (see the script for options such as
  `--filter-out`).
