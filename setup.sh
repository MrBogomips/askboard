#!/bin/sh
# Sets up an AskBoard checkout or worktree, locally and on CI (CLAUDE.md, Development commands).
#
#   ./setup.sh [--ci] [--codex-only] [--dry-run | --check] [--force]
#   --ci          as CI runs it, also when CI is set: bun install --frozen-lockfile
#   --codex-only  only regenerate the Codex files (CLAUDE.md, Codex interop)
#   --dry-run, --check, --force
#                 passed to codex_port (see its block); they imply --codex-only
#
# It installs no tool: Node and Bun come from the developer's machine or from the CI action.
set -eu
cd "$(dirname "$0")"

NODE_MINIMUM=24.22.1

fail() {
  echo "setup: $*" >&2
  exit 1
}

check_toolchain() {
  command -v node >/dev/null 2>&1 ||
    fail "Node $NODE_MINIMUM or later is required (AD-19); with Volta, the checkout's pin applies"
  node -e '
    const need = process.argv[1].split(".").map(Number);
    const have = process.versions.node.split(".").map(Number);
    const i = need.findIndex((n, k) => have[k] !== n);
    process.exit(i === -1 || have[i] > need[i] ? 0 : 1);
  ' "$NODE_MINIMUM" || fail "Node $(node --version) is older than $NODE_MINIMUM (AD-19)"
  bun_wanted=$(node -p 'require("./package.json").packageManager.replace(/^bun@/, "")')
  command -v bun >/dev/null 2>&1 || fail "Bun $bun_wanted is required (package.json packageManager)"
  bun_found=$(bun --version)
  [ "$bun_found" = "$bun_wanted" ] ||
    fail "Bun $bun_found found, $bun_wanted required (package.json packageManager)"
  echo "setup: Node $(node --version), Bun $bun_found"
}

# >>> codex-port >>>
# Managed by the codex-port skill; a later run replaces this block. Edit the Claude Code
# sources (CLAUDE.md, .claude/, .mcp.json), never the generated Codex files.
#
# codex_port [--dry-run | --check] [--force]
#   Regenerates the Codex files (AGENTS.md, .agents/skills/, .codex/) from the Claude Code
#   sources with the latest rulesync. It converts a copy of the sources in a temporary folder
#   and checks the result there, so a failed or surprising conversion leaves the files as they
#   were. It records what it wrote in .codex/codex-port.manifest and removes what an earlier
#   run wrote for a source that is gone.
#   --dry-run  list what it would write; change nothing
#   --check    check the files against the sources, without the network: every skill and
#              agent has its Codex file, and AGENTS.md matches CLAUDE.md
#   --force    overwrite a file of the same name that codex-port did not write
#   Call it as a plain command, never as `codex_port || ...`, which turns off its error checks.
codex_port() (
  set -eu
  cp_dry=0 cp_check=0 cp_force=0
  for cp_arg in "$@"; do
    case $cp_arg in
      --dry-run) cp_dry=1 ;;
      --check) cp_check=1 ;;
      --force) cp_force=1 ;;
      *) echo "codex-port: unknown option '$cp_arg'" >&2; return 2 ;;
    esac
  done
  cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  cp_manifest=.codex/codex-port.manifest
  cp_marker='<!-- Generated from CLAUDE.md by codex-port'
  if [ -L AGENTS.md ] || [ -L .agents ] || [ -L .codex ]; then
    echo "codex-port: AGENTS.md, .agents or .codex is a symbolic link; it writes through none" >&2
    return 1
  fi

  # cp_checks <root>: the Codex files under <root> cover every source of this project.
  cp_checks() {
    cp_fail=0 cp_skills=0 cp_agents=0
    if [ -f CLAUDE.md ] || [ -f .claude/CLAUDE.md ]; then
      if [ ! -f "$1/AGENTS.md" ]; then
        echo "codex-port: AGENTS.md is missing" >&2; cp_fail=1
      elif grep -q '^@[^[:space:]]' "$1/AGENTS.md"; then
        echo "codex-port: AGENTS.md has an @import line, which Codex does not resolve: inline it in CLAUDE.md" >&2
        cp_fail=1
      fi
    fi
    for cp_src in .claude/skills/*/SKILL.md; do
      [ -f "$cp_src" ] || continue
      cp_name=$(basename "$(dirname "$cp_src")")
      cp_skills=$((cp_skills + 1))
      [ -f "$1/.agents/skills/$cp_name/SKILL.md" ] ||
        { echo "codex-port: skill '$cp_name' is not ported" >&2; cp_fail=1; }
    done
    for cp_src in .claude/agents/*.md; do
      [ -f "$cp_src" ] || continue
      cp_name=$(basename "$cp_src" .md)
      cp_agents=$((cp_agents + 1))
      [ -f "$1/.codex/agents/$cp_name.toml" ] ||
        { echo "codex-port: agent '$cp_name' is not ported" >&2; cp_fail=1; }
    done
    return $cp_fail
  }

  if [ "$cp_check" = 1 ]; then
    cp_checks .
    if [ -f CLAUDE.md ] && ! tail -n +3 AGENTS.md | cmp -s - CLAUDE.md; then
      echo "codex-port: AGENTS.md is older than CLAUDE.md: regenerate the Codex files" >&2
      return 1
    fi
    echo "codex-port: the Codex files are up to date ($cp_skills skills, $cp_agents agents)"
    return 0
  fi

  # Only the features the sources have: rulesync writes a Codex approval policy into
  # .codex/config.toml for permissions it was never given.
  cp_features=
  cp_feature() { cp_features=${cp_features:+$cp_features,}$1; }
  if [ -f CLAUDE.md ] || [ -f .claude/CLAUDE.md ] || [ -d .claude/rules ]; then cp_feature rules; fi
  if ls .claude/skills/*/SKILL.md >/dev/null 2>&1; then cp_feature skills; fi
  if ls .claude/agents/*.md >/dev/null 2>&1; then cp_feature subagents; fi
  if [ -f .mcp.json ]; then cp_feature mcp; fi
  if grep -qs '"hooks"' .claude/settings.json; then cp_feature hooks; fi
  if grep -qs '"permissions"' .claude/settings.json; then cp_feature permissions; fi
  if [ -z "$cp_features" ]; then
    echo "codex-port: no Claude Code sources to port"
    return 0
  fi

  # Convert a copy of the sources: personal files and harness worktrees stay out.
  cp_tmp=$(mktemp -d "${TMPDIR:-/tmp}/codex-port.XXXXXX")
  trap 'rm -rf "$cp_tmp"' EXIT
  for cp_src in CLAUDE.md .mcp.json; do
    if [ -f "$cp_src" ]; then cp "$cp_src" "$cp_tmp/"; fi
  done
  if [ -d .claude ]; then
    mkdir "$cp_tmp/.claude"
    for cp_src in .claude/* .claude/.[!.]*; do
      [ -e "$cp_src" ] || continue
      case ${cp_src#.claude/} in worktrees | settings.local.json | CLAUDE.local.md) continue ;; esac
      cp -R "$cp_src" "$cp_tmp/.claude/"
    done
  fi
  # Package install scripts never run (npm_config_ignore_scripts).
  cp_version=$(cd "$cp_tmp" && npm_config_ignore_scripts=true npx --yes rulesync@latest --version) || cp_version=
  cp_version=$(printf '%s\n' "$cp_version" | tail -n 1)
  case $cp_version in
    [0-9]*.[0-9]*.[0-9]*) ;;
    *) echo "codex-port: cannot run rulesync from npm (offline?); the Codex files are unchanged" >&2; return 1 ;;
  esac
  (cd "$cp_tmp" && npm_config_ignore_scripts=true npx --yes "rulesync@$cp_version" convert \
    --from claudecode --to codexcli --features "$cp_features" --silent)
  # rulesync drops disable-model-invocation; Codex reads the same intent from agents/openai.yaml.
  for cp_src in .claude/skills/*/SKILL.md; do
    [ -f "$cp_src" ] || continue
    sed -n '2,/^---$/p' "$cp_src" | grep -q '^disable-model-invocation: *true' || continue
    cp_policy="$cp_tmp/.agents/skills/$(basename "$(dirname "$cp_src")")/agents/openai.yaml"
    if [ -d "$(dirname "$(dirname "$cp_policy")")" ] && [ ! -f "$cp_policy" ]; then
      mkdir -p "$(dirname "$cp_policy")"
      printf 'policy:\n  allow_implicit_invocation: false\n' >"$cp_policy"
    fi
  done
  if [ -f "$cp_tmp/AGENTS.md" ]; then
    { echo "$cp_marker with rulesync $cp_version; edit CLAUDE.md, not this file. -->"; echo; cat "$cp_tmp/AGENTS.md"; } >"$cp_tmp/AGENTS.md.new"
    mv "$cp_tmp/AGENTS.md.new" "$cp_tmp/AGENTS.md"
  fi
  if ! cp_checks "$cp_tmp"; then
    echo "codex-port: rulesync $cp_version did not produce the expected files; the Codex files are unchanged" >&2
    return 1
  fi
  cp_list=$(cd "$cp_tmp" && for cp_out in AGENTS.md .agents .codex; do
    if [ -e "$cp_out" ]; then find "$cp_out" -type f; fi
  done | sort)

  if [ "$cp_dry" = 1 ]; then
    echo "codex-port: rulesync $cp_version would write:"
    printf '%s\n' "$cp_list"
    return 0
  fi

  # Never overwrite a file this block did not write: rulesync would replace it without a word.
  printf '%s\n' "$cp_list" | while IFS= read -r cp_path; do
    [ -n "$cp_path" ] && [ -f "$cp_path" ] || continue
    if [ -f "$cp_manifest" ] && grep -qxF "$cp_path" "$cp_manifest"; then continue; fi
    if [ "$cp_path" = AGENTS.md ] && head -n 1 AGENTS.md | grep -qF "$cp_marker"; then continue; fi
    if [ "$cp_force" = 0 ]; then
      echo "codex-port: $cp_path was not written by codex-port; fold what it holds into the Claude Code sources, then remove it or pass --force" >&2
      exit 1
    fi
  done

  # Remove what the previous run wrote, so outputs whose source is gone disappear.
  if [ -f "$cp_manifest" ]; then
    while IFS= read -r cp_path; do
      case $cp_path in
        *..*) ;;
        AGENTS.md | .agents/* | .codex/*) rm -f "$cp_path" ;;
      esac
    done <"$cp_manifest"
    find .agents .codex -type d -empty -delete 2>/dev/null || true
  fi
  printf '%s\n' "$cp_list" | while IFS= read -r cp_path; do
    [ -n "$cp_path" ] || continue
    mkdir -p "$(dirname "$cp_path")"
    cp "$cp_tmp/$cp_path" "$cp_path"
  done
  { echo "$cp_list"; echo "$cp_manifest"; } | sort >"$cp_tmp/manifest"
  mkdir -p .codex
  cp "$cp_tmp/manifest" "$cp_manifest"

  cp_checks .
  echo "codex-port: rulesync $cp_version wrote AGENTS.md, $cp_skills skills and $cp_agents agents ($(wc -l <"$cp_manifest" | tr -d ' ') files, listed in $cp_manifest)"
)
# <<< codex-port <<<

main() {
  ci=0 codex_only=0 codex_args=
  if [ -n "${CI:-}" ]; then ci=1; fi
  for arg in "$@"; do
    case $arg in
      --ci) ci=1 ;;
      --codex-only) codex_only=1 ;;
      --dry-run | --check | --force) codex_only=1 codex_args="$codex_args $arg" ;;
      *) fail "unknown option '$arg' (use --ci, --codex-only, --dry-run, --check or --force)" ;;
    esac
  done
  if [ "$codex_only" = 0 ]; then
    check_toolchain
    if [ "$ci" = 1 ]; then bun install --frozen-lockfile; else bun install; fi
  fi
  # shellcheck disable=SC2086 # codex_args holds whole option words only
  codex_port $codex_args
}

main "$@"
