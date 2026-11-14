#!/bin/sh
# Every view run of tasks 1.4 and 4.1 to 4.4, in order, then the evidence files. Run from probe/.
# The IronCalc adapter's results change while it is refined: the Bun hashes (run view-bun) are
# taken again here, so the browser hashes compare against the same adapter source.
set -eu
bun build.ts
bun run.ts view-bun --engine both --only whitelist,boards,errors || true
bun drive.ts versions
bun drive.ts smoke
bun drive.ts c1-negative
bun drive.ts c1
bun drive.ts c1-snapshot
bun drive.ts c3
bun drive.ts c4 --repeat 5
for tz in UTC Pacific/Kiritimati America/Adak; do
  for loc in en-US de-DE; do
    short=$(echo "$tz" | sed 's#.*/##' | tr 'A-Z' 'a-z')
    bun drive.ts "c5-$short-$loc" --tz "$tz" --locale "$loc"
  done
done
bun tools/view-evidence.ts view-smoke smoke
bun tools/view-evidence.ts view-c1 c1-negative c1 c1-snapshot
bun tools/view-evidence.ts view-c3 c3
bun tools/view-evidence.ts view-c4 c4
bun tools/view-evidence.ts view-c5 c5-utc-en-US c5-utc-de-DE c5-kiritimati-en-US c5-kiritimati-de-DE c5-adak-en-US c5-adak-de-DE
