# uv binary source (COPY --from cannot use build args directly, so it goes through a named stage)
ARG UV_VERSION=0.13.7
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM node:22-trixie-slim

ARG TZ=Europe/London
ENV TZ="$TZ"
ARG USERNAME=dev
ARG CLAUDE_CODE_VERSION=stable
# Keep in sync with packageManager in js/package.json
ARG YARN_VERSION=4.9.1
ARG PYTHON_VERSION=3.12

# Basic tools, firewall tools (used by init-firewall.sh), shellcheck for the tests,
# build tools + postgres client for python/, and Cypress system dependencies for js/
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl git less procps sudo nano \
  iptables ipset iproute2 dnsutils aggregate jq \
  shellcheck build-essential postgresql-client \
  xvfb libgtk2.0-0t64 libgtk-3-0t64 libgbm-dev libnotify-dev libnss3 libxss1 \
  libasound2t64 libxtst6 xauth \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Non-root user (Claude Code refuses --dangerously-skip-permissions as root).
# Rename the image's node user (uid 1000) so file ownership matches the host user.
RUN usermod --login "$USERNAME" --home "/home/$USERNAME" --move-home node \
  && groupmod --new-name "$USERNAME" node

# uv, and a uv-managed Python in a shared location (not /root) so the dev user can use it
COPY --from=uv /uv /uvx /usr/local/bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/python UV_PYTHON="$PYTHON_VERSION"
RUN uv python install "$PYTHON_VERSION"

# Python dependencies from python/pyproject.toml + uv.lock, installed at build time before the firewall exists.
# Workspace packages themselves are installed by postCreateCommand (uv sync in python/).
ENV UV_PROJECT_ENVIRONMENT=/opt/venv UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
RUN --mount=type=cache,target=/root/.cache/uv \
  --mount=type=bind,source=python/pyproject.toml,target=/tmp/deps/pyproject.toml \
  --mount=type=bind,source=python/uv.lock,target=/tmp/deps/uv.lock \
  uv sync --no-install-local --frozen --project /tmp/deps \
  && chown -R "$USERNAME:$USERNAME" /opt/venv

# Yarn shims via corepack (needs root to write to /usr/local/bin)
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Workspace, node_modules volume mount point, Claude config dir, and persisted shell history
RUN mkdir -p /workspace/js/node_modules /commandhistory "/home/$USERNAME/.claude" \
  && touch /commandhistory/.bash_history \
  && chown -R "$USERNAME:$USERNAME" /workspace /commandhistory "/home/$USERNAME/.claude" \
  && echo "export PROMPT_COMMAND='history -a' HISTFILE=/commandhistory/.bash_history" >> "/home/$USERNAME/.bashrc"

# Firewall script: the user may run this one script as root, nothing else
COPY .devcontainer/init-firewall.sh .devcontainer/check-isolation.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/init-firewall.sh /usr/local/bin/check-isolation.sh \
  && echo "$USERNAME ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/firewall \
  && chmod 0440 /etc/sudoers.d/firewall

ENV DEVCONTAINER=true
ENV PATH="/opt/venv/bin:/home/${USERNAME}/.local/bin:${PATH}"
WORKDIR /workspace
USER $USERNAME

# Download Yarn at build time, before the firewall exists
RUN corepack install --global "yarn@$YARN_VERSION"

# Claude Code native installer; installs to ~/.local/bin
RUN curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION"
