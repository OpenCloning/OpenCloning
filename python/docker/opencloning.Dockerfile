# Backend for OpenCloning
# https://github.com/OpenCloning/OpenCloning (python/)
#
# Production (cloning app): docker build -f docker/opencloning.Dockerfile .
# Production (db combined): docker build -f docker/opencloning.Dockerfile --build-arg APP_TARGET=db .
# Production (MCP server): docker build -f docker/opencloning.Dockerfile --build-arg APP_TARGET=mcp .
# CI tests:                docker build -f docker/opencloning.Dockerfile --target test .
#
# The production and test images are distroless: no shell or package manager. The test image
# runs on the same base and interpreter as production, only with a different venv. To get a
# busybox shell when troubleshooting, build locally with the runtime tag changed to debug-nonroot.
#
# Base images are pinned by digest (multi-arch index) for reproducible builds; Dependabot
# (docker ecosystem) bumps the digests.

ARG APP_TARGET="cloning"

# BUILDER — shared setup
FROM python:3.15-slim-bookworm@sha256:498829c717b1e59fc42f0e7865eafe4e04ca0f70a3769d4ae70ba218df54507c AS base-setup

# Build toolchain for deps without prebuilt wheels on some platforms
# (e.g. edlib and primer3-py on linux/aarch64, which need gcc/g++/make).
# Only in builder stages; the production stage copies the venv and does not include it.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# System libraries that manylinux wheels expect (instead of bundling them) and distroless/cc
# lacks. The rest (glibc, libstdc++, libgcc_s) are in distroless/cc. Copied to the runtime
# stage below, keeping their path (/usr/lib/<arch>-linux-gnu/).
RUN mkdir /runtime-libs \
    && cp -L --parents /usr/lib/$(dpkg-architecture -qDEB_HOST_MULTIARCH)/libz.so.1 /runtime-libs/

RUN useradd -m -s /bin/bash backend
USER backend
WORKDIR /home/backend

ENV UV_COMPILE_BYTECODE=1

# Keep in sync with the uv version in .github/actions/setup-python and .devcontainer/Dockerfile
COPY --from=ghcr.io/astral-sh/uv:0.13.7@sha256:96f40d3904aad8d0bd010539001d36c8e2188b981e1334471a90c4a1d93bb490 /uv /uvx /usr/local/bin/

# Python itself comes from uv (python-build-standalone), installed under /home/backend/python,
# so that the production stage can copy the interpreter together with the venv (its
# bin/python is a symlink to it). It only needs glibc, unlike the one in /usr/local.
ENV UV_PYTHON_INSTALL_DIR="/home/backend/python"
ENV UV_PYTHON_PREFERENCE=only-managed
ENV UV_PYTHON=3.12

# The standalone interpreter ships pip (and ensurepip's bundled wheel), which are not needed
# to run and show up in vulnerability scans. The venvs have no pip (uv sync does not add it).
RUN uv python install \
    && rm -rf $UV_PYTHON_INSTALL_DIR/cpython-*/lib/python3*/site-packages/pip* \
       $UV_PYTHON_INSTALL_DIR/cpython-*/lib/python3*/ensurepip

ENV VIRTUAL_ENV="/home/backend/venv"
ENV UV_PROJECT_ENVIRONMENT=$VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Workspace: opencloning only (enough for prod lock sync)
FROM base-setup AS workspace-opencloning

COPY pyproject.toml uv.lock ./
COPY packages/opencloning/pyproject.toml packages/opencloning/README.md packages/opencloning/
COPY packages/opencloning/src packages/opencloning/src

# Production venv — only opencloning + runtime deps
FROM workspace-opencloning AS builder-prod-cloning

RUN uv sync --frozen --package opencloning --no-default-groups --no-editable

# Workspace + opencloning-db (for CI / full workspace test sync)
FROM workspace-opencloning AS workspace-full

COPY packages/opencloning-db/pyproject.toml packages/opencloning-db/
COPY packages/opencloning-db/README.md packages/opencloning-db/
COPY packages/opencloning-db/alembic.ini packages/opencloning-db/
COPY packages/opencloning-db/alembic packages/opencloning-db/alembic
COPY packages/opencloning-db/src packages/opencloning-db/src
COPY packages/opencloning-cli packages/opencloning-cli
COPY packages/opencloning-mcp/pyproject.toml packages/opencloning-mcp/README.md packages/opencloning-mcp/
COPY packages/opencloning-mcp/src packages/opencloning-mcp/src

# Test venv — whole workspace + test deps, copied into the "test" target below
FROM workspace-full AS builder-test

RUN uv sync --frozen --no-default-groups --no-editable --group test

FROM workspace-full AS builder-prod-db

RUN uv sync --frozen --package opencloning-db --package opencloning-cli --no-default-groups --no-editable

FROM workspace-opencloning AS builder-prod-mcp

COPY packages/opencloning-mcp/pyproject.toml packages/opencloning-mcp/README.md packages/opencloning-mcp/
COPY packages/opencloning-mcp/src packages/opencloning-mcp/src
RUN uv sync --frozen --package opencloning-mcp --no-default-groups --no-editable

FROM builder-prod-${APP_TARGET} AS builder-selected

# RUNTIME — shared by the production and test images
# cc = glibc + libstdc++/libgcc (needed by compiled wheels like edlib, primer3-py, numpy),
# plus ca-certificates and tzdata. Same Debian release as the builder (bookworm).
FROM gcr.io/distroless/cc-debian12:nonroot@sha256:9dac0a79194e45a7da0158a9c6da57b217585af0786db3845d1f0ec1a0dd182f AS runtime

WORKDIR /home/backend
COPY --from=base-setup /runtime-libs/ /
# Same path as in the builder: the venvs' python symlink points to it.
# Python and the venvs are owned by root, so the nonroot user that runs the app cannot modify
# them
COPY --from=base-setup --chown=0:0 /home/backend/python /home/backend/python
ENV VIRTUAL_ENV="/home/backend/venv"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
USER nonroot

# TEST IMAGE: run the database migrations and pytest as two commands (there is no shell), e.g.
#   docker run <image> alembic -c packages/opencloning-db/alembic.ini upgrade head
#   docker run <image> python -m pytest
FROM runtime AS test

COPY --from=builder-test --chown=0:0 /home/backend/venv /home/backend/venv
COPY pyproject.toml conftest.py ./
COPY packages/opencloning-db/alembic.ini packages/opencloning-db/
COPY packages/opencloning-db/alembic packages/opencloning-db/alembic
COPY packages/opencloning-db/tests packages/opencloning-db/tests
COPY packages/opencloning/tests packages/opencloning/tests
COPY packages/opencloning-mcp/tests packages/opencloning-mcp/tests

CMD ["python", "-m", "pytest"]

# FINAL IMAGE (default build target, so it must be the last stage)
FROM runtime AS production

ARG APP_TARGET="cloning"
ENV APP_TARGET="${APP_TARGET}"

COPY --from=builder-selected --chown=0:0 /home/backend/venv /home/backend/venv

# Fail the build (not the running container) if a compiled dependency cannot load its libraries.
# Exec form, since there is no shell.
RUN ["python", "-c", "import numpy, edlib, primer3"]

ENV USE_HTTPS=false

# Worker processes per container
ENV GUNICORN_WORKERS=2
ENV GUNICORN_TIMEOUT=20

EXPOSE 8000

# The app to serve (APP_TARGET) and TLS (USE_HTTPS) are handled in gunicorn_conf
CMD ["gunicorn", "-c", "python:opencloning.observability.gunicorn_conf"]
