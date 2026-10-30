#!/bin/sh
# Criterion 5 outside the browser, runs `det-<runtime>-<zone>-<locale>`: every fixture for both
# engines under three time zones and two locales, in Bun and in Node 24.22.2. From probe/:
# `sh tools/det.sh`, then `bun tools/det-summary.ts` to compare the hashes.
set -eu
for tz in UTC Pacific/Kiritimati America/Adak; do
  zone=$(echo "$tz" | tr '/' '_')
  for loc in en_US.UTF-8 de_DE.UTF-8; do
    short=$(echo "$loc" | cut -d. -f1)
    TZ=$tz LANG=$loc LC_ALL=$loc bun run.ts "det-bun-$zone-$short" --engine both --only whitelist,boards,errors >/dev/null || true
    TZ=$tz LANG=$loc LC_ALL=$loc volta run --node 24.22.2 node run.ts "det-node-$zone-$short" --engine both --only whitelist,boards,errors >/dev/null || true
  done
done
