#!/bin/sh
# Summarises one delivery run: task tail, latency, delivered results, refusals.
# Usage: summ.sh <run>
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
R=$S/runs/$1
echo "== latency"; python3 -I "$S/latency.py" "$1" 2>&1 | tail -15
echo "== delivered"; grep '"kind":"delivered"' "$R/logs/server.jsonl" | sed -E 's/.*"via":"([^"]*)".*"isDelivered":([a-z]+).*/\1 \2/' | sort | uniq -c
echo "== not delivered lines"; grep -c 'not delivered' "$R/debug.log"
grep -m2 'not delivered' "$R/debug.log" | cut -c1-300
echo "== tool.check"; grep -i 'tool.check\|probe: the mod delivers' "$R/debug.log" | head -5 | cut -c1-300
echo "== screen tail"; grep -v '^\s*$' "$R/screen.txt" 2>/dev/null | tail -8
