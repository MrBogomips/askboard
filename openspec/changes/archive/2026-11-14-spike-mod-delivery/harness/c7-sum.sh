#!/bin/sh
# Criterion 7 summary: session file and stub state before answering, push results, what the agents reported.
S=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
R=$S/runs/$1
grep -E 'asked at|=== before|\.json|"pid"|"key"|"nonce"|"t0"' "$R/c7.txt" | head -12
grep -h '"kind":"start"\|"kind":"exit"' "$R/logs/server.jsonl" | grep -o '"iso":"[^"]*"\|"kind":"[a-z]*"\|"reason":"[A-Z]*"' | paste - - - 2>/dev/null
grep -h '"kind":"delivered"' "$R/logs/server.jsonl" | grep -o '"seq":[0-9]*\|"via":"[a-z.]*"\|"isDelivered":[a-z]*\|"agentId":[^,]*' | paste - - - -
grep -i 'GOT\|NONCES\|N-[0-9a-f]\{8\}' "$R/screen.txt" | tail -5
