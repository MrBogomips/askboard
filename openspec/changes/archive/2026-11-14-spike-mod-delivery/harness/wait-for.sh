#!/bin/sh
# Waits until a file contains a fixed string, or the timeout passes. Usage: wait-for.sh <file> <string> <seconds>
FILE=$1
STRING=$2
LIMIT=$3
n=0
until grep -qF -- "$STRING" "$FILE" 2>/dev/null || [ "$n" -ge "$LIMIT" ]; do
  sleep 1
  n=$((n + 1))
done
if grep -qF -- "$STRING" "$FILE" 2>/dev/null; then echo "found after ${n}s"; else echo "timeout after ${n}s"; fi
