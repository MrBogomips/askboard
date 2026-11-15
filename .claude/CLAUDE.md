# AskBoard: Claude Code only

- Session context: MRB-ASKB

The shared rules are in `AGENTS.md`, which Claude Code reads through `CLAUDE.md`, a symbolic link to it. This file holds what only Claude Code uses.

- **Development plugin:** after `bun run build`, `claude --plugin-dir <checkout>` loads it in any project, with its hooks and the mod. A server whose start fails is skipped by new sessions for 15 minutes, so build first. `claude mcp list` shows AskBoard connected even when Node is older than 24.22.1, so check `/mcp` for its five tools.
- **Project agents:** the `model`, `effort`, `tools` and preloaded `skills` in `.claude/agents/` hold for Claude Code only; `askboard-delivery` says which agent runs a job at which effort, and when to raise it.
- **Reviewers' memory** lives outside the repository, in the user's agent memory folder, so parallel worktrees never conflict on it. Patterns the reviewers see recur become skill rules at the kaizen step before a pull request, which the PO's setup runs.
- **OpenSpec skills** are invoked as `/openspec-propose` and so on (OpenSpec 2 has no `/opsx:*` commands).
- **Worktrees:** Claude Code creates integrated worktrees itself; with the default `worktree.baseRef` (`fresh`) a worktree branches from `origin/main`, so unpushed local commits are not in it.
