# Docker files

This folder contains docker files for the OpenCloning backend.

## Dockerfiles

* [opencloning.Dockerfile](opencloning.Dockerfile): Dockerfile to build the OpenCloning backend apps: `cloning` and `db`.

## Docker compose files

* [docker-compose.dev.yml](docker-compose.dev.yml): Docker compose file to run the backend in development mode in a container.
* [docker-compose.opencloning-db.yml](docker-compose.opencloning-db.yml): Docker compose file to run the database API container. Merge it with `docker-compose.postgres.yml` when you want a fully containerized local stack.
* [docker-compose.postgres.yml](docker-compose.postgres.yml): Docker compose file to run the local Postgres dev server for opencloning-db.
* [docker-compose.local-cloning-proxy.yml](docker-compose.local-cloning-proxy.yml): Nginx proxy configuration to run the cloning API with `SERVE_FRONTEND=1` at a a subpath (`localhost:3000/cloning`).
* [docker-compose.ci-tests.yml](docker-compose.ci-tests.yml): Docker compose file to run pytest in Docker against Postgres from docker-compose.postgres.yml.
