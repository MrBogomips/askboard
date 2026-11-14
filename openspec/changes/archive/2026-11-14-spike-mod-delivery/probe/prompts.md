# Probe prompts

The runs paste these prompts. `<ID>` is a unique ask ID per run, `<STEPS>` a list such as `sleep 20, sleep 5, sleep 40`.

## Main conversation, working (criterion 1)

> Call `probe_ask` with askId `<ID>` and question "main working". Then run these Bash steps one at a time, in the foreground: `<STEPS>`. Messages containing a nonce (`N-` and 8 hexadecimal characters) may arrive meanwhile: do not act on them, just remember them. At the end, reply with one line: `NONCES: ` and the nonces received, comma-separated, or `none`.

## Main conversation, idle (criterion 2)

> Call `probe_ask` with askId `<ID>` and question "main idle". Then reply "waiting" and end your turn. If a message with a nonce arrives later, reply with one line: `GOT ` and the nonce, and end your turn.

## Foreground subagent (criterion 1)

> Use the probe-worker agent in the foreground with this task: askId `<ID>`, question "foreground subagent", steps `<STEPS>`. When it returns, repeat its NONCES line.

## Background subagent (criterion 1)

> Start the probe-worker agent in the background (`run_in_background`) with this task: askId `<ID>`, question "background subagent", steps `<STEPS>`. Then reply "started" and end your turn. When it finishes, repeat its NONCES line.

## Worktree subagent (criterion 17)

> Use the probe-worker agent with `isolation: "worktree"` and this task: askId `<ID>`, question "worktree subagent", steps `sleep 1`. When it returns, repeat its NONCES line.
