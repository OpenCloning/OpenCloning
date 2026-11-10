FROM node:22-trixie-slim

ARG TZ=Europe/London
ENV TZ="$TZ"
ARG USERNAME=dev
ARG CLAUDE_CODE_VERSION=stable
ARG YARN_VERSION=4.9.1

# Basic tools, firewall tools (used by init-firewall.sh), and shellcheck for the tests
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl git less procps sudo nano \
  iptables ipset iproute2 dnsutils aggregate jq \
  shellcheck xvfb \
  libgtk2.0-0t64 libgtk-3-0t64 libgbm-dev libnotify-dev libnss3 libxss1 \
  libasound2t64 libxtst6 xauth \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Non-root user (Claude Code refuses --dangerously-skip-permissions as root).
# Rename the image's node user (uid 1000) so file ownership matches the host user.
RUN usermod --login "$USERNAME" --home "/home/$USERNAME" --move-home node \
  && groupmod --new-name "$USERNAME" node

# Yarn shims via corepack (needs root to write to /usr/local/bin)
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Workspace, node_modules volume mount point, Claude config dir, and persisted shell history
RUN mkdir -p /workspace/node_modules /commandhistory "/home/$USERNAME/.claude" \
  && touch /commandhistory/.bash_history \
  && chown -R "$USERNAME:$USERNAME" /workspace /commandhistory "/home/$USERNAME/.claude" \
  && echo "export PROMPT_COMMAND='history -a' HISTFILE=/commandhistory/.bash_history" >> "/home/$USERNAME/.bashrc"

# Firewall script: the user may run this one script as root, nothing else
COPY .devcontainer/init-firewall.sh .devcontainer/check-isolation.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/init-firewall.sh /usr/local/bin/check-isolation.sh \
  && echo "$USERNAME ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/firewall \
  && chmod 0440 /etc/sudoers.d/firewall

ENV DEVCONTAINER=true
ENV PATH="/home/${USERNAME}/.local/bin:${PATH}"
WORKDIR /workspace
USER $USERNAME

# Download Yarn at build time, before the firewall exists (version from packageManager in package.json)
RUN corepack install --global "yarn@$YARN_VERSION"

# Claude Code native installer (Node.js is only for the frontend); installs to ~/.local/bin
RUN curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION"
