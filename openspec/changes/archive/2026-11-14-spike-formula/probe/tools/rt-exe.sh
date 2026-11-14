#!/bin/sh
# Criterion 2, run `rt-exe`: `sh tools/rt-exe.sh <scratch-dir>` from probe/. Builds both
# executables into the scratch dir, runs them there (no node_modules), records the dylibs
# each loads (DYLD_PRINT_LIBRARIES, macOS) and writes runs/rt-exe/{ironcalc,own}.json.
set -eu
out=${1:?scratch dir}
here=$(pwd)
mkdir -p "$out" "$here/runs/rt-exe"
bun build --compile tools/rt-exe.ts --outfile "$out/rt-exe-ironcalc" >/dev/null
bun build --compile tools/rt-exe-own.ts --outfile "$out/rt-exe-own" >/dev/null
cd "$out"
test ! -e node_modules
./rt-exe-ironcalc > "$here/runs/rt-exe/ironcalc.json"
./rt-exe-own > "$here/runs/rt-exe/own.json"
DYLD_PRINT_LIBRARIES=1 ./rt-exe-ironcalc 2>&1 >/dev/null | sed 's/^dyld\[[0-9]*\]: <[^>]*> //' | sort -u > "$here/runs/rt-exe/dylibs-ironcalc.txt"
ls -l rt-exe-ironcalc rt-exe-own | awk '{print $5, $9}' > "$here/runs/rt-exe/sizes.txt"
