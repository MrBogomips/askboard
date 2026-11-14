#!/bin/sh
# Criterion 6: -p run whose answer arrives by push after the agent ended its turn.
# Usage: c6.sh <claude-binary> <run-name> [extra claude flags, e.g. --max-turns 2]
set -u
SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad
BIN=$1
RUN=$2
shift 2
START=$(date +%s)
sh "$SCRATCH/run-auto.sh" "$BIN" "$RUN" 15000 8000 1 "Call probe_ask with askId c6 and question 'after the end'. Then reply 'waiting' and end your turn. If a message with a nonce arrives later, reply with one line: GOT and the nonce." "$@"
END=$(date +%s)
echo "duration $((END - START)) s"
python3 -I -c "import json,sys; r=json.load(open(sys.argv[1])); print('subtype', r.get('subtype'), 'num_turns', r.get('num_turns'), 'is_error', r.get('is_error')); print('result', str(r.get('result'))[:200])" "$SCRATCH/runs/$RUN/result.json"
grep -h -o '"kind":"[a-z.-]*"[^}]*drop[^}]*' "$SCRATCH/runs/$RUN/logs/mod.jsonl" | head -5
grep -c 'submit-started' "$SCRATCH/runs/$RUN/logs/mod.jsonl"
