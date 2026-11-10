[![Python tests](https://github.com/OpenCloning/OpenCloning_frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenCloning/OpenCloning_frontend/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/OpenCloning/OpenCloning_frontend/graph/badge.svg?token=CFIB2H6WMO)](https://codecov.io/gh/OpenCloning/OpenCloning_frontend)

# OpenCloning frontend

This repository contains the OpenCloning frontend monorepo, which includes the main React application and shared packages. Before going further, please go to the [main project README](https://github.com/OpenCloning/OpenCloning?tab=readme-ov-file#readme), where you can find an introduction.

A hosted version of this application can be found at [https://opencloning.org/](https://opencloning.org/).

## Repository structure

This is a monorepo managed with Yarn workspaces:

- `apps/opencloning/` - The main OpenCloning application
- `packages/` - Shared packages:
  - `@opencloning/store` - Redux store and cloning logic
  - `@opencloning/ui` - UI components
  - `@opencloning/utils` - Utility functions

## Getting started

If you want to quickly set up a local instance of the frontend and backend of the application using Docker, check [getting started in 5 minutes](https://github.com/OpenCloning/OpenCloning#timer_clock-getting-started-in-5-minutes) in the main repository.

## Running the site locally

We use node 22.17, to manage different versions of node, we use `nvm`. Installation instructions [here](https://github.com/nvm-sh/nvm#installing-and-updating).

```bash
# Install node 22.17 (first time only)
nvm install 22.17
# Activate node 22.17
nvm use 22.17
```

To handle dependencies and build the site, [yarn 3](https://v3.yarnpkg.com/) is used.

```bash
# Enable yarn 3 in the project (first time only)
corepack enable

# Install dependencies (every time you pull changes)
yarn install

# If you want to serve the development site locally at http://localhost:3000/
yarn start
# If you want to build the static assets of the production site in apps/opencloning/build
yarn build
```

## Connecting to the backend

For the application to work, you must have a running backend. For that, see the [backend installation instructions](https://github.com/OpenCloning/OpenCloning_backend#local-installation).

By default, if you run the dev server with `uvicorn opencloning.main:app`, the backend will be running at `http://localhost:8000/`. That's where the dev server of the frontend (ran with `yarn start`) will send the requests to by default.

The backend URL can be changed by setting a different value in the `config.json` (see next section).

See also [connecting to the frontend section](https://github.com/OpenCloning/OpenCloning_backend?tab=readme-ov-file#connecting-to-the-frontend) in the backend repo.

## Configuration

The configuration of the frontend is done in the file that will be served from `/config.json`. In the dev server, this file is served from `apps/opencloning/public/config.json`. That file is not included in the repository, and is generated from `apps/opencloning/public/config.dev.json` when you run `yarn start`. For the production site, `config.prod.json` is used. The things you can configure are:

- `backendUrl`: The URL of the backend. By default, it is `http://localhost:8000/`.
- `showAppBar`: Whether to show the top app bar (blue with buttons for examples, etc.). By default, it is `true`.
- `noExternalRequests`: Whether to block requests to external services. By default, it is `false`.
- `database`: For integrations, provide the database name. This is not documented, but for an example see `packages/ui/src/components/eLabFTW`.

For production: when building the site with `yarn build`, simply replace `apps/opencloning/build/config.json` with your settings. This is what is done in [this docker-compose file](https://github.com/OpenCloning/OpenCloning).

## Running with docker 🐳

If you want to serve the full site (backend and frontend) with docker, check [getting started in 5 minutes](https://github.com/OpenCloning/OpenCloning#timer_clock-getting-started-in-5-minutes) in the main repository.

If you want to serve only the frontend from a docker container, an image is available at [manulera/opencloningfrontend](https://hub.docker.com/r/manulera/opencloningfrontend). The image is built from the Dockerfile in the root of this repository and exposes the port 3000. To run it:

```bash
docker pull manulera/opencloningfrontend
docker run -p 3000:3000 manulera/opencloningfrontend
```

## Contributing :hammer_and_wrench:

Check [contribution guidelines in the main repository](https://github.com/OpenCloning/OpenCloning/blob/master/CONTRIBUTING.md).

## Settings for vscode :desktop_computer:

For the `eslint` to work, you will need the [eslint module](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Tests

### End to end tests

To run the tests, first run the dev server with `yarn start`.

To run most tests, you will need the backend to be running at http://localhost:8000/. You can see how to do run it in the [backend repo](https://github.com/OpenCloning/OpenCloning_backend). For the github actions tests, a submodule is used (see below).

To run the tests:

```bash
# Open cypress UI
yarn cypress open

# Run a particular test in the command line
yarn cypress run --spec cypress/e2e/source_genome_region.cy.js

# Run a few tests in parallel from the command line (edit file if needed)
bash run_tests_in_parallel.sh
# If the tests fail, you can see screenshots of the failed tests in the folder cypress/screenshots

```

### Component tests

For these, you don't have to run the `yarn start` command, but you need the backend server as above. To run them:

```bash
yarn cypress open
```

### Unit tests

These are run with `vitest`. To run them:

```bash
yarn vitest
```

### Actions and submodule

The tests run with cypress in github actions require the submodule OpenCloning_backend to be included. If you want to include it locally:

```bash
git submodule update --init
```

If you want to change the commit of the submodule:

```bash
cd OpenCloning_backend
git checkout -b the-branch
git pull origin the-branch
cd ..
# commit the frontend repo normally
```

### Coverage

To update which files are excluded from coverage, edit the `.nycrc.json` file.

## Misc

### Web analytics

You can configure website analytics using umami by setting the env var `VITE_UMAMI_WEBSITE_ID` to the website id. When building the site, the analytics script will be included in the build. See `apps/opencloning/index.html` and `apps/opencloning/vite.config.js` to see how this is done (using ejs templating).

### MCP server

The URL of the OpenCloning MCP server (used to load strategies via `?source=mcp&strategy=...`) is set at build time with the env var `VITE_MCP_SERVER_URL`, for example in a `.env` file for the dev server, or as a docker build argument (`--build-arg VITE_MCP_SERVER_URL=...`). The same URL is added to the whitelist of external requests. If unset, loading from an MCP server is disabled.

### Recording video with cypress

```
CYPRESS_NO_COMMAND_LOG=1 yarn cypress run --spec cypress/e2e/source_genome_region.cy.js
```

### eLabFTW

The API keys should be in the ignored file `.env.local`

Example file:

```bash
VITE_ELABFTW_BASE_URL=https://localhost
VITE_ELABFTW_API_READ_KEY=<key>
VITE_ELABFTW_API_WRITE_KEY=<key>
```

To build the image for local testing:

```bash
docker build -t manulera/opencloningfrontend:local --build-arg BASE_URL=/opencloning/ .
```

### Running scripts

> There is probably a better way to do this, but this is what I have found for now.

It can be useful to run scripts to test a few things without running the whole frontend. The only way I have found to do this is running the script as a test.

- Create file with pattern `script.test.js`
- Run `yarn vitest run script.test.js`

The file content should be something like this:

```javascript
import { ab1ToJson } from "@teselagen/bio-parsers";
import fs from "fs";

describe("ab1ToJson", () => {
  it("should convert an AB1 file to JSON", () => {
    const a = 1;
    console.log(a);
  });
});
```

### Updating transitive dependencies

```
npx -y yarn-update-indirect form-data
```

## Versioning and releases

The whole monorepo is released together, with a single version, by [release-please](https://github.com/googleapis/release-please). See the [release workflow](../.github/workflows/release.yml).

* PR titles must follow [conventional commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`); this is checked on every PR. PRs are squash-merged, so the title becomes the commit message, which determines the version bump and the changelog entry.
* Every push to `master` updates a release PR with the version bumps and `CHANGELOG.md`.
* Merging that PR publishes the `@opencloning/*` npm packages, the Python packages, the Docker images and the Netlify site.

To publish the npm packages manually:

```
YARN_NPM_AUTH_TOKEN=<> yarn workspaces foreach --all --no-private --topological npm publish --access public --tolerate-republish
```
