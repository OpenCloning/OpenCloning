FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ARG TZ=Europe/London
ENV TZ="$TZ"
ARG USERNAME=dev
ARG CLAUDE_CODE_VERSION=stable

# Basic tools, firewall tools (used by init-firewall.sh), and shellcheck for the tests
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl git less procps sudo nano \
  iptables ipset iproute2 dnsutils aggregate jq \
  shellcheck build-essential postgresql-client \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Non-root user (Claude Code refuses --dangerously-skip-permissions as root)
RUN useradd --create-home --shell /bin/bash "$USERNAME"

# Python dependencies from the root pyproject.toml/uv.lock, installed at build time before the firewall exists
ENV UV_PROJECT_ENVIRONMENT=/opt/venv UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
RUN --mount=type=cache,target=/root/.cache/uv \
  --mount=type=bind,source=pyproject.toml,target=/tmp/deps/pyproject.toml \
  --mount=type=bind,source=uv.lock,target=/tmp/deps/uv.lock \
  uv sync --no-install-local --frozen --project /tmp/deps \
  && chown -R "$USERNAME:$USERNAME" /opt/venv
ENV PATH="/opt/venv/bin:/home/${USERNAME}/.local/bin:${PATH}"

# Workspace, Claude config dir, and persisted shell history
RUN mkdir -p /workspace /commandhistory "/home/$USERNAME/.claude" \
  && touch /commandhistory/.bash_history \
  && chown -R "$USERNAME:$USERNAME" /workspace /commandhistory "/home/$USERNAME/.claude" \
  && echo "export PROMPT_COMMAND='history -a' HISTFILE=/commandhistory/.bash_history" >> "/home/$USERNAME/.bashrc"

# Firewall script: the user may run this one script as root, nothing else
COPY .devcontainer/init-firewall.sh .devcontainer/check-isolation.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/init-firewall.sh /usr/local/bin/check-isolation.sh \
  && echo "$USERNAME ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/firewall \
  && chmod 0440 /etc/sudoers.d/firewall

ENV DEVCONTAINER=true
WORKDIR /workspace
USER $USERNAME

# Claude Code native installer (no Node.js); installs to ~/.local/bin
RUN curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION"
