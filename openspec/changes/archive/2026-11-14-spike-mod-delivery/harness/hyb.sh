#!/bin/sh
# Summarises hybrid runs: push latency, read latency per nonce, catch-up submits, paths used.
# Usage: hyb.sh <run>...
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
for r in "$@"; do
  echo "## $r"
  python3 -I "$S/latency.py" "$r" | head -1
  python3 -I "$S/readlat.py" "$r" | cut -c1-40
  grep -h -o '"kind":"catch-up-submit","seq":[0-9]*' "$S/runs/$r/logs/mod.jsonl"
  grep -o '"via":"[a-z.]*"' "$S/runs/$r/logs/server.jsonl" | sort | uniq -c
done
