# Linux image for the renderer spike, task 7.1 (NFR-7): Playwright 1.64.1's own image, with its
# Chromium, Firefox and WebKit in /ms-playwright (PLAYWRIGHT_BROWSERS_PATH), plus Bun 1.4.4.
# Toolchain only: run-linux.sh mounts the probe read-only and a runs folder over probe/runs.
# Build without a context: docker build --tag askboard-spike-renderer:linux - < Dockerfile

FROM oven/bun:1.4.4-debian@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e AS bun

FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# The versions this build got, printed again by run-linux.sh at every run.
RUN mkdir -p /opt/probe-image \
  && { \
    echo "bun $(bun --version)"; \
    echo "os $(. /etc/os-release && echo "$PRETTY_NAME")"; \
    echo "arch $(uname -m)"; \
    echo "browsers $(ls /ms-playwright | tr '\n' ' ')"; \
  } > /opt/probe-image/versions.txt \
  && cat /opt/probe-image/versions.txt
