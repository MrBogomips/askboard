#!/bin/sh
# The stand-in claude as one command, the way bench starts `claude` (design decision 14).
exec bun "$(dirname "$0")/fake-claude.ts" "$@"
