# Linux container for the mod delivery spike, task 4.1: criteria 10, 12 and 13 on Linux.
# Toolchain only. run-linux.sh mounts the probe and this folder at run time, and no secret is ever built in:
# the OAuth token reaches the container through `docker run --env CLAUDE_CODE_OAUTH_TOKEN`, by name.
# Build without a context: docker build --tag askboard-spike-mod-delivery:linux - < Dockerfile
# Claude Code is `latest` at build time; --build-arg CLAUDE_CODE_VERSION=<x.y.z> pins another version.

FROM oven/bun:1.4.4-debian@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e AS bun

FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c

ARG CLAUDE_CODE_VERSION=latest

# procps for ps (criterion 12's leftover check); ca-certificates for HTTPS from git and Python.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git procps python3 tmux \
  && rm -rf /var/lib/apt/lists/*

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

RUN npm install --global "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
  && npm cache clean --force

# The runs use the Claude Code version the image was built with.
ENV DISABLE_AUTOUPDATER=1

# The versions this build got, read again by in-container.sh at every run.
RUN mkdir -p /opt/probe-image /tmp/version-home \
  && { \
    echo "node $(node --version)"; \
    echo "bun $(bun --version)"; \
    echo "claude-code $(HOME=/tmp/version-home claude --version)"; \
    echo "npm $(npm --version)"; \
    echo "tmux $(tmux -V)"; \
    echo "$(git --version)"; \
    echo "$(python3 --version)"; \
    echo "os $(. /etc/os-release && echo "$PRETTY_NAME")"; \
  } > /opt/probe-image/versions.txt \
  && rm -rf /tmp/version-home \
  && cat /opt/probe-image/versions.txt

USER node
WORKDIR /home/node
