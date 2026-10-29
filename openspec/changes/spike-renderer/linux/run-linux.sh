#!/bin/sh
# Task 7.1: the fixtures of runs `matrix`, `c3c4`, `golden-time` and `snapshot` in Playwright's
# Linux Chromium, Firefox and WebKit (NFR-7), in the image of ./Dockerfile.
#
# Usage, from the change folder, after `bun run build` and the renders run in probe/:
#   sh linux/run-linux.sh <runs dir>
# <runs dir> is mounted over probe/runs, which the probe's read-only mount otherwise holds; it
# gets the renders of runs `snapshot-renders` and `snapshot-renders-radios` copied in, for the
# Snapshot runs. The container is removed when it exits.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
probe=$(cd "$here/../probe" && pwd)
runs=${1:?usage: sh linux/run-linux.sh <runs dir>}
image=askboard-spike-renderer:linux

mkdir -p "$runs"
runs=$(cd "$runs" && pwd)
for renders in snapshot-renders snapshot-renders-radios; do
  mkdir -p "$runs/$renders"
  cp -R "$probe/runs/$renders/renders" "$runs/$renders/"
done

docker image inspect "$image" > /dev/null 2>&1 || docker build --tag "$image" - < "$here/Dockerfile"
echo "image $(docker image inspect "$image" --format '{{.Id}}')"

MATRIX=c-radio,c-checkbox,c-switch,c-tabs,c-select,c-select-popper,c-select-shim,c-slider,c-toggle-group,c-popover,c-popover-modal,c-popover-modal-shim,c-date-picker,c-markdown,c-markdown-classes,c-katex,c-katex-string,c-mathlive,c-mathlive-sandboxed,c-mathlive-shim,c-table,c-tree,c-spreadsheet,c-ranking,c-kanban,c-chart,c-chart-rich,c-graph,c-diff,c-diff-vars-shim,c-app,c-app-jitless,c-tailwind
C3C4=mermaid-flowchart-shim,mermaid-sequence-shim,plantuml-sequence-shim,plantuml-smetana-class-shim,plantuml-resources,plantuml-resources-default
E=chromium,firefox,webkit

docker run --rm --name askboard-spike-renderer-linux --ipc=host \
  --volume "$probe:/probe:ro" --volume "$runs:/probe/runs" --workdir /probe "$image" sh -c "
    set -e
    cat /opt/probe-image/versions.txt
    bun drive.ts versions
    bun drive.ts linux-matrix --engines $E --fixtures $MATRIX
    bun drive.ts linux-c3c4 --engines $E --fixtures $C3C4
    bun drive.ts linux-c3c4-blob --engines $E --variants board-img-blob --fixtures $C3C4
    bun drive.ts linux-c3c4-snapshot --engines $E --snapshot --fixtures $C3C4
    bun drive.ts linux-golden-time --engines $E --variants board-img-blob --script golden --repeat 10 --fixtures golden,golden-smetana,golden-text
    bun drive.ts linux-snapshot --engines $E --script snapshot --renders snapshot-renders --fixtures golden,size-uj1,size-all
    bun drive.ts linux-snapshot-radios --engines $E --script snapshot --renders snapshot-renders-radios --fixtures size-all-radios
  "
