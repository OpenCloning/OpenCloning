---
name: run-tests
description: How to run the unit (vitest), component and e2e (Cypress) tests inside the dev container. Use when running, debugging or verifying tests, especially if Cypress fails with "Cannot find module 'electron'".
---

# Running tests in the dev container

## Vitest (unit tests)

```bash
yarn test                                   # all
yarn vitest run packages/ui/src/components/assembler/assembler_utils.test.js   # one file
```

## Cypress component tests

```bash
env -u ELECTRON_RUN_AS_NODE xvfb-run -a yarn cypress run --component --spec <path/to/File.cy.jsx>
```

Run from the repo root (`/workspace`); `--spec` paths are relative to it, e.g.
`packages/ui/src/components/assembler/UploadPlasmidsButton.cy.jsx`.

### Why the extra bits

- `env -u ELECTRON_RUN_AS_NODE`: the shell may have `ELECTRON_RUN_AS_NODE=1` set (e.g. by the VS Code extension). This makes Cypress's Electron run as plain Node and fail with `Cannot find module 'electron'`. Unset it for the command.
- `xvfb-run -a`: the container has no display; Xvfb provides a virtual one.

## Cypress e2e tests

Specs live in `cypress/e2e/group-*/`. They need two things reachable from inside the container:

1. **Frontend at `localhost:3000`**: start it in the background and wait for it:
   ```bash
   (yarn start > /tmp/vite.log 2>&1 &); sleep 12; curl -s -o /dev/null -w "%{http_code}\n" localhost:3000
   ```
2. **Backend at `localhost:8000`**: it runs on the *host* (see the OpenCloning_backend README: `uv run uvicorn opencloning.main:app`). The `backend-forward` socat sidecar in `.devcontainer/docker-compose.yml` relays the container's `localhost:8000` to `host.docker.internal:8000`. Check with `curl localhost:8000/openapi.json`. If it fails, make sure the backend is running on the host and the dev container was rebuilt after the compose change.

Then run a spec (no `--component`):

```bash
env -u ELECTRON_RUN_AS_NODE xvfb-run -a yarn cypress run --spec cypress/e2e/group-3/source_empty.cy.js
```

Verified working with `source_empty.cy.js`. Stop the dev server afterwards by killing the process listening on port 3000 (do not use `pkill -f`: it matches and kills your own shell). Failed runs leave screenshots in `cypress/screenshots/`; delete them. Specs that call external services (e.g. NCBI genome lookups) can fail because the container firewall only allows a fixed set of domains.

### Tips

- Output is noisy with vite "externalized for browser compatibility" warnings; pipe through `tail -50` to see the test results.
- Use a timeout (Cypress startup can take a while); the first run compiles with vite.
- Run the full suite in parallel with `./run_tests_in_parallel.sh` (see the script for options such as `--filter-out`).
