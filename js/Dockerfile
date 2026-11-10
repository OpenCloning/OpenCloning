# Frontend for OpenCloning
# https://github.com/OpenCloning/OpenCloning_frontend

# Stage 1: Build the application
FROM node:22.22.2-alpine3.22 AS builder
WORKDIR /app

# Copy everything (Yarn workspaces need the full structure)
COPY . /app

RUN corepack enable
RUN yarn install --immutable

# Add build argument for base URL with a default value
ARG BASE_URL="/"

# URL of the OpenCloning MCP server (empty to disable loading strategies from it).
# Baked into the build, and also used to whitelist requests.
ARG VITE_MCP_SERVER_URL=""
ENV VITE_MCP_SERVER_URL=$VITE_MCP_SERVER_URL

RUN yarn build --base "$BASE_URL"

# Stage 2: Create a lightweight production image
FROM node:22.22.2-alpine3.22
WORKDIR /build
COPY --from=builder /app/apps/opencloning/build .

# Install envsubst (to create config.json from config.env.json)
RUN apk add --no-cache envsubst
# Remove npm cache
RUN npm cache clean --force
COPY ./docker_entrypoint.sh /build/docker_entrypoint.sh
ENV BACKEND_URL=http://127.0.0.1:8000
ENV DATABASE=""
ENV SHOW_APP_BAR="true"
ENV NO_EXTERNAL_REQUESTS="false"
ENV ENABLE_ASSEMBLER="false"
ENV ENABLE_PLANNOTATE="false"
CMD ["sh", "docker_entrypoint.sh"]
