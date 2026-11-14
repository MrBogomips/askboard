#!/bin/sh
# Criterion 12: what a run left behind once its client is gone. Usage: leftovers.sh <run-dir>
# Probe processes still running (stub, hooks, driver), session files, and sockets in the run folder.
R=$1
PS=$(ps -eo pid=,ppid=,args= | grep -E '[s]erver\.ts|[h]ook\.ts|[d]river\.ts')
echo "probe processes left: $(printf '%s' "$PS" | grep -c .)"
[ -n "$PS" ] && printf '%s\n' "$PS"
echo "session files left: $(find "$R/sessions" -name '*.json' 2> /dev/null | wc -l)"
echo "sockets left: $(find "$R" -name '*.sock' 2> /dev/null | wc -l)"
