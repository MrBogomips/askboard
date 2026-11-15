#!/bin/sh
# Which parts of CI a change needs (.github/AGENTS.md, CI). Run on a checkout of depth 2 whose HEAD is the
# commit under test: the merge commit of a pull request, or the commit pushed to main. Prints
#   code=true|false   whether `bun run check` has anything to check
#   codex=true|false  whether the Codex files are to be regenerated and checked
# for the workflow to append to $GITHUB_OUTPUT. Plain shell: no third-party action reads the diff.
#
#   pull_request     both from the diff against the base (HEAD^1)
#   push             code always; codex from the diff against the previous commit (HEAD^1)
#   anything else    both (the nightly run, a manual dispatch)
#
# A diff that cannot be read runs everything.
set -eu

event=${GITHUB_EVENT_NAME:-pull_request}

case $event in
  pull_request | push) ;;
  *)
    echo "code=true"
    echo "codex=true"
    exit 0
    ;;
esac

if ! files=$(git diff --no-renames --name-only HEAD^1 HEAD 2>/dev/null); then
  echo "code=true"
  echo "codex=true"
  exit 0
fi

# Documents nothing in `bun run check` reads. docs/ is documents except the three files tests and
# the view build read; AGENTS.md and its CLAUDE.md link are read by tools/codex-interop.test.ts and
# CHANGELOG.md by the release tooling, so they are not here. A nested AGENTS.md (docs/, .github/,
# tools/) counts as the other files of its folder. openspec/ is validated by its own job, except the approved
# examples the contract tests read. A diff lists both paths of a rename (--no-renames), so a code
# file moved into docs/ still counts.
is_document() {
  case $1 in
    docs/ux-askboard-2026-10-27/DESIGN.md | docs/prd-askboard-2026-10-25/addendum.md | docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md) return 1 ;;
    openspec/changes/archive/2026-10-29-review-model-contract/examples/*) return 1 ;;
    docs/* | openspec/* | drafts/*) return 0 ;;
    AGENTS.md | CLAUDE.md | CHANGELOG.md) return 1 ;;
    */*) return 1 ;;
    *.md) return 0 ;;
  esac
  return 1
}

# What the codex-port block of setup.sh converts or checks, and the block itself: the instruction
# files (AGENTS.md and its CLAUDE.md link, at the root or nested), .claude/ and .mcp.json.
is_codex_source() {
  case $1 in
    AGENTS.md | */AGENTS.md | CLAUDE.md | */CLAUDE.md) return 0 ;;
    setup.sh | .mcp.json | .claude/* | .github/workflows/codex.yml) return 0 ;;
  esac
  return 1
}

code=false
codex=false
while IFS= read -r file; do
  [ -n "$file" ] || continue
  is_document "$file" || code=true
  if is_codex_source "$file"; then codex=true; fi
done <<LIST
$files
LIST
if [ "$event" = push ]; then code=true; fi
# A change with no files (an empty merge) has nothing to check, but run it all rather than guess.
if [ -z "$files" ]; then
  code=true
  codex=true
fi
echo "code=$code"
echo "codex=$codex"
