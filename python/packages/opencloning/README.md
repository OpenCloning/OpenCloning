# OpenCloning Cloning API

This python packages contains an API that provides a series of entry points for *in silico* cloning. The API documentation can be accessed [here](https://api.opencloning.org/docs).

You can also install it and use some of the exported functions, in particular for primer design.

## Migrating between model versions and fixing model bugs

* The data model changes, so the json files you created may not be compatible with the newest version of the library, which uses the latest data mode. You can easily fix this using `python -m opencloning_linkml.migrations.migrate file.json
` see [full documentation](https://github.com/OpenCloning/OpenCloning_LinkML?tab=readme-ov-file#migration-from-previous-versions-of-the-schema).
* Before version 0.3, there was a bug for assembly fields that included locations spanning the origin. See the details and how to fix it in the documentation of [this file](./packages/opencloning/src/opencloning/bug_fixing/README.md).

## Getting started

If you want to quickly set up a local instance of the frontend and backend of the application, check [getting started in 5 minutes](https://github.com/OpenCloning/OpenCloning#timer_clock-getting-started-in-5-minutes) in the main repository.

For the configuration of the container via env variables, check the docker-compose file in [the main repository](https://github.com/OpenCloning/OpenCloning).

### Running locally

You can install this as a python package:

```bash
# Create a virtual environment
python -m venv .venv
# Activate the virtual environment
source .venv/bin/activate
# Install the package from pypi
pip install opencloning
# Run the API (uvicorn should be installed in the virtual environment)
uvicorn opencloning.main:app
```

### Installing from GitHub (monorepo)

This repository is a uv workspace; the installable package lives in `packages/opencloning/`.
When installing directly from GitHub, include the `subdirectory` fragment:

```bash
# uv
uv add "opencloning @ git+https://github.com/OpenCloning/OpenCloning_backend.git@master#subdirectory=packages/opencloning"

# pip
pip install "git+https://github.com/OpenCloning/OpenCloning_backend.git@master#subdirectory=packages/opencloning"
```

### Running locally if you want to contribute

This repository is a [uv](https://docs.astral.sh/uv/) workspace: the installable package lives under `packages/opencloning/`, and the repo root holds workspace metadata and shared dev dependencies. Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then from the repository root:

```bash
# Install the workspace (editable opencloning + dev/test dependency groups) into .venv
uv sync

# Install the pre-commit hooks
uv run pre-commit install

# Run tools via uv, or activate .venv and use them directly
source .venv/bin/activate   # optional
```

The virtual environment is created at the repository root (`.venv`). For VS Code settings see the folder `.vscode`.

Now you should be able to run the api by running:

```bash
# The --reload argument will reload the API if you make changes to the code
uvicorn opencloning.main:app --reload --reload-exclude='.venv'
```

Then you should be able to open the API docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to know that your API is working.

### Running locally with docker :whale:

If you want to serve the full site (backend and frontend) with docker, check [getting started in 5 minutes](https://github.com/OpenCloning/OpenCloning#timer_clock-getting-started-in-5-minutes) in the main repository.

If you want to serve only the backend from a docker container, an image is available at [manulera/opencloningbackend](https://hub.docker.com/r/manulera/opencloningbackend). The image is built from [`docker/opencloning.Dockerfile`](docker/opencloning.Dockerfile) (repository root as build context) and exposes the port 3000. To run it:

```bash
docker build -f docker/opencloning.Dockerfile -t manulera/opencloningbackend .
docker run -d --name backendcontainer -p 8000:8000 manulera/opencloningbackend
```

To run with a read-only root filesystem while still allowing temporary files (required for tools like mafft), mount `/tmp` as tmpfs (RAM-backed writable storage).

```bash
docker run -d --name backendcontainer -p 8000:8000 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256M \
  manulera/opencloningbackend
```

If you want to build the test image locally, you can do so by:

```bash
docker build -f docker/opencloning.Dockerfile -t manulera/opencloningbackend-test --target builder-test .
```

If you don't want to download the repository and build the image, you can fetch the latest image from dockerhub.

```bash
docker pull manulera/opencloningbackend
docker run -d --name backendcontainer -p 8000:8000 manulera/opencloningbackend
```

The api will be running at `http://localhost:8000`, so you should be able to access the docs at [http://localhost:8000/docs](http://localhost:8000/docs).

### Connecting to the frontend

If you want to receive requests from the [frontend](https://github.com/OpenCloning/OpenCloning_frontend), or from another web application you may have to include the url of the frontend application in the CORS exceptions. By default, if you run the dev server with `uvicorn opencloning.main:app --reload --reload-exclude='.venv'`, the backend will accept requests coming from `http://localhost:3000`, which is the default address of the frontend dev server (ran with `yarn start`).

If you want to change the allowed origins, you can do so via env variables (comma-separated). e.g.:

```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001 uvicorn opencloning.main:app --reload --reload-exclude='.venv'
```

Similarly, the frontend should be configured to send requests to the backend address, [see here](https://github.com/OpenCloning/OpenCloning_frontend#connecting-to-the-backend).

#### Serving the frontend from the backend

You may prefer to handle everything from a single server. You can do so by:
* Build the [frontend](https://github.com/OpenCloning/OpenCloning_frontend) with `yarn build`.
* Copy the folder `build` from the frontend to the root directory of the backend, and rename it to `frontend`.
* Set the environment variable `SERVE_FRONTEND=1` when running the backend. By default this will remove all allowed origins, but you can still set them with `ALLOWED_ORIGINS`.
* Set the value of `backendUrl` in `frontend/config.js` to `/`.
* Now, when you go to the root of the backend (e.g. `http://localhost:8000`), you should receive the frontend instead of the greeting page of the API.

You can see how this is done in this [docker image](https://github.com/OpenCloning/OpenCloning/blob/master/Dockerfile) and [docker-compose file](https://github.com/OpenCloning/OpenCloning/blob/master/docker-compose.yml).

## Running the tests locally

From the repository root (after `uv sync`):

> This will require setting the `ADDGENE_TOKEN` environment variable, see [Addgene authenticated access](#addgene-authenticated-access) for more details.

```bash
uv run pytest packages/opencloning/tests -v -ks
```

If you wanted to run them in docker:

```bash
export COMPOSE_PROJECT_NAME=opencloning-local-docker
# Plus env vars for ADDGENE and NCBI API keys

docker compose \
  -f docker/docker-compose.postgres.yml \
  -f docker/docker-compose.ci-tests.yml \
  run --rm tests \
  python -m pytest -vs -o cache_dir=/tmp/pytest-cache
```

## Addgene authenticated access

Addgene sequences are retrieved through the [Addgene Developers API](https://developers.addgene.org), which requires an API token with the `catalog:retrieve-with-sequences` scope. Request one from Addgene, and set it as an environment variable to enable Addgene imports:

```bash
export ADDGENE_TOKEN="your_addgene_api_token"
```

For one-off local runs you can also prefix commands:

```bash
ADDGENE_TOKEN="your_addgene_api_token" uv run pytest packages/opencloning/tests -v -ks
```

If the variable is not set, Addgene import endpoints return an informative error explaining that a token is required.

Genbank files are downloaded from `https://api.developers.addgene.org/download/genbank/{sequence_id}/`, which redirects to a presigned storage URL. Both hosts are in the default `ALLOWED_EXTERNAL_URLS`; if you override that variable, include them.

Use of the Addgene API and data must comply with Addgene Terms of Use.

For CI, configure a repository secret named `ADDGENE_TOKEN` so Addgene-dependent tests can run.

## Catalogs

Catalogs are used to map ids to urls for several plasmid collections. They are stored under `packages/opencloning/src/opencloning/catalogs/`.

To update the catalogs, run the following command from the repository root:

```bash
uv run python scripts/update_catalogs.py
```
