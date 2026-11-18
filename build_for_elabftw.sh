#!/bin/sh
# Build the backend, frontend and combined images locally, all tagged "local".
# The frontend is served under /opencloning/, as in the eLabFTW integration
# (same as the prod-baseurl-opencloning images).
set -eu

cd "$(dirname "$0")"

docker build -f python/docker/opencloning.Dockerfile -t manulera/opencloningbackend:local python
docker build --build-arg BASE_URL=/opencloning/ -t manulera/opencloningfrontend:local js
docker build --build-arg BACKEND_TAG=local --build-arg FRONTEND_TAG=local -t manulera/opencloning:local .
