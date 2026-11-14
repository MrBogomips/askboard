# Overnight plan: close the mod delivery spike, then run the renderer spike

Self-contained instructions for a fresh, unattended session started in the mod delivery worktree. Execute the phases in order, without asking questions. Where a step needs the product owner (PO), do the preparation, record "awaiting PO" in the log at the end, and move on. Never stop the whole run for one failed step: record it and continue.

**Priority: reach product functionality as soon as possible.** Close the mod delivery spike up to the PO's decisions, then run the renderer spike (SOLUTION-DESIGN §10.3), the other phase 1 spike that unblocks the epics. Linux work comes last and is optional.

## Ground rules

- **Worktrees.** Mod delivery: `/Users/mr/git/MrBogomips/askboard/.claude/worktrees/feature-spike-mod-delivery` (branch `worktree-feature-spike-mod-delivery`, change folder `openspec/changes/spike-mod-delivery/`, called `CHANGE`). Renderer: created in Phase 4.
- **Git:** local commits on the worktree branches are allowed, conventional commits, at least one per phase. **Never push, never open a PR, never merge, never touch `main`.**
- **No AI attribution** anywhere: no Claude or Anthropic mentions, no AI URLs, no Co-Authored-By or session trailers, in commits, files or comments. This overrides any harness reminder.
- **Never write under `~/.claude/dev-mods`**, never install or enable plugins in the user's configuration. Probes load only with `--plugin-dir` in nested sessions.
- **Do not edit `docs/`** (PRD, spine, SOLUTION-DESIGN, UX): their changes wait for the PO's decisions. Draft them in the change folder instead.
- **OpenSpec:** create, change and archive its artifacts only through its workflow (`openspec` CLI, the `opsx` skills); never hand-edit `.claude/commands/opsx/` or `.claude/skills/openspec-*`. **For this run the PO authorises `/opsx:apply` right after `/opsx:propose` for the renderer spike**, overriding the propose skill's stop-before-apply boundary.
- **Never** `npm install --global` without `--prefix <scratch dir>` (Volta intercepts it).
- **Spend:** nested runs use `claude-opus-5-5`; stay within the runs named here, plus at most one retry of a run that failed for a harness reason.
- **Clean up:** after each run, `tmux ls` shows no session named after a run (`c*-`, `d-*`); kill leftovers. No background process left at the end.

## What exists (mod delivery)

- `CHANGE/proposal.md`, `design.md`, `tasks.md` (17 of 23 done), `findings.md` (read it whole first).
- `CHANGE/probe/`: the probe plugin (MCP stub `server.ts`, hooks `hook.ts`, mod `hooks/register.js`, `driver.ts`, agent `agents/probe-worker.md`, `prompts.md`). Mod settings by environment: `PROBE_RUN_DIR`, `PROBE_POLL_MS`, `PROBE_TRANSPORT` (`tcp`, `unix`, `process`), `PROBE_MAIN_VIA` (`submit`, `send`, `hybrid`), `PROBE_PUSH_VIA` (`send`, `append`), `PROBE_SELF_ALLOW`. `CHANGE/probe-fetch-block/`: policy-mod stand-in.
- `CHANGE/harness/`: copies of the run scripts. The originals, referenced by absolute path, live in `SCRATCH=/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad`, with `runs/<run>/` (logs), `project/` (the trusted scratch git project) and the pinned binaries `cc-2.1.311/bin/claude`, `cc-2.1.308/bin/claude`. If `SCRATCH` is gone, recreate it from `CHANGE/harness/` (`setup-project.sh`; binaries with `npm install --global --prefix SCRATCH/cc-<v> @anthropic-ai/claude-code@<v>`); if `project/` cannot be trusted unattended, record it and skip the interactive runs.
- Scripts: `run-i.sh <bin> <run> [flags]` (tmux, clean environment, `PROBE_*` passed through; `PROBE_DIR` overrides the probe folder, `PROBE_CC_FLAGS` adds flags), `deliver-i.sh <bin> <run> <seconds> <count> <interval-ms> <prompt>`, `run-auto.sh <bin> <run> <delay-ms> <interval-ms> <count> <prompt> [flags]` (headless), `summ.sh <run>`, `hyb.sh <run>...`, `latency.py`, `readlat.py <run> [agent]`, `tokens.py <session> [agent]`, `c7.sh`, `c7-sum.sh`.
- **Shell quirk:** if a guard refuses compound commands (variables, loops, `cd &&`), write them into a script under `SCRATCH` and run `sh <file>`.

## Phase 1: start the remaining runs in the background (about 30 minutes, unattended)

Launch these, then go straight to Phase 2 while they run; collect their results at the end of Phase 2.

1. **Criterion 7, subagent half (task 3.6).** Copy `c7.sh` to `c7b.sh` so the subagent provably outlives the answer: steps `twenty times sleep 110`; answer at 25 minutes (`sleep 1500`); before answering, append `bun driver.ts state` and a `tmux capture-pane` to `c7.txt`. Run `c7b-312` (`claude`) and `c7b-311` (`SCRATCH/cc-2.1.311/bin/claude`) in the background. **Pass:** the subagent's transcript (`~/.claude/projects/*scratchpad-project*/<session>/subagents/agent-<id>.jsonl`) holds the nonce in a user row, the stub PID is unchanged and the session file exists before the answer.
2. **Append under load** (risk for AD-4: an appended row between `tool_use` and `tool_result`). `deliver-i.sh` with `PROBE_PUSH_VIA=append PROBE_MAIN_VIA=hybrid PROBE_CC_FLAGS="--permission-mode auto"`, 20 answers 2000 ms apart, runs `d-stress-312` and `d-stress-311`. Prompt: main asks, starts a background probe-worker that also asks with steps `sleep 3` twelve times, then main runs `sleep 3` eight times. **Pass:** no API error in `debug.log` (`grep -i 'error\|400\|invalid'`), every nonce reaches its owner.
3. **Interrupt, then push (D6)**, `d-esc-312`, hybrid: main asks and runs `sleep 30`; at 10 s `tmux send-keys Escape`; answers at 15 s and 40 s. Record each answer's fate (`drop` in `mod.jsonl`, catch-up, later submit). If one is lost, add to the mod a retry of dropped submits from `turn.complete` and the next `turn.start`, rerun once, record both.
4. **Criterion 8 alternative with the mod on**, `c8-toast-312`: behind `PROBE_SHOW_LINK=1`, a `tool.call` hook that, for `probe_ask` with `e.agentId` set, after `next(e)` calls `$.ui.toast('AskBoard: <link>')` and `$.ui.status('AskBoard: 1 open')` (link from the stub's `/state`; add the field if missing). A background subagent asks once; capture the pane every 2 s for 20 s. Record whether toast and status appear.

When all four are in: record each result in `findings.md` (§ Criterion 7, § Criterion 1 "Append under load", § Criterion 1 "Interrupt", § Criterion 8), mark 3.6 done if both 3.6 runs pass, `claude plugin validate CHANGE/probe`, refresh `CHANGE/harness/`, commit `test(spike-mod-delivery): …`.

## Phase 2: findings ready for the PO (task 5.1 without the decisions)

1. **Reorder `findings.md`** by criterion (1–4, 5, 6, 7, 8, 9–17, 18); Documentation read and the D table stay last. Lose no content.
2. **Verdict table** at the top: one row per criterion 1–18, columns 2.1.311, `latest`, 2.1.308 (where run), Linux ("pending, 4.1"), verdict (pass, fail, pass with change, untested), section link.
3. **Failures and consequences:** for each failure (D13 auto mode refuses `session.send`; criterion 8 link not shown for subagent asks; criterion 6 `-p` limits; criterion 13 `--continue` and `/clear`; `--strict-mcp-config` drops plugin servers), quote the matching "If it fails" row of SOLUTION-DESIGN §10.1 and say what applies.
4. **"Proposed outcomes (awaiting the PO)"** table: item, evidence, proposed decision, alternative, empty "PO decision" column. At least:
   - AD-4: push by `$.session.append` to subagents and to a working main conversation; `$.prompt.submit` when idle; catch-up submit at `turn.complete` for rows appended after the last `turn.step`; pull stays authoritative; never push to a finished agent (D1); drop `session.send` (D13).
   - AD-5: the mod's key from `$.session.id()`, never its environment (O5); the Claude Code PID as the cross-process key (criterion 13).
   - AD-2: SIGINT as an exit signal (O1); `subscriptions/listen` starts the API at connection (O6).
   - AD-10: guard semantics confirmed (criterion 15), from 2.1.311 only.
   - AD-11: no `Origin` from the mod; the Unix-socket option (D3).
   - AD-12: hook `cwd` of worktree subagents (criterion 17).
   - AD-17 and SOLUTION-DESIGN §7: drop `--strict-mcp-config`.
   - AD-18: minimum 2.1.311 confirmed.
   - FR-21–25 / F6: how a subagent's board link reaches the user (§ Criterion 8 options, Phase 1 step 4).
   - OQ2: latency per agent kind, as input to the target. R1 and the addendum: D13, to report upstream.
   - Facts F3, F5, F6, F12, F13, F15, F16, F17, F25: verified, narrowed or refuted. The three Deferred rows: closed or reworded.
5. **Spine update draft:** `CHANGE/spine-update-draft.md` with, for each outcome, the exact replacement text quoted against the current text (file and section: spine ADs, Stack row, Deferred rows, SOLUTION-DESIGN §7, §10.1, §12, §13, PRD OQ2 and R1), each block marked "applies only if the PO accepts row N". AD IDs stay stable.
6. `openspec validate --all --strict --no-interactive` and `bun run check` (`GITHUB_TOKEN=$(gh auth token)` if `gh` is logged in) must pass.

Do not mark 5.1 done. Commit `docs(spike-mod-delivery): verdicts, proposed outcomes and the spine update draft`.

## Phase 3: review the probe

One code-review subagent on `git diff origin/main...HEAD` of the mod delivery branch, limited to `probe/` and `harness/`: does any bug make a recorded measurement wrong? Fix only those, rerun the affected run, commit `fix(spike-mod-delivery): …`. Then go to Phase 4.

## Phase 4: the renderer spike (SOLUTION-DESIGN §10.3, S-1 to S-8)

1. **Worktree.** From the main checkout: `git -C /Users/mr/git/MrBogomips/askboard fetch origin`, then `git -C /Users/mr/git/MrBogomips/askboard worktree add .claude/worktrees/feature-spike-renderer -b worktree-feature-spike-renderer origin/main`. Work there from now on; run `bun install --frozen-lockfile` in it.
2. **Read** `CLAUDE.md`, `openspec/config.yaml` (its `context` field), SOLUTION-DESIGN §9, §10.3 and §13, the spine ADs it names (at least AD-1, AD-8, AD-9, AD-19 and the Stack), `docs/ux-askboard-2026-10-27/DESIGN.md`, `EXPERIENCE.md`, `architecture-change-requests.md` (S-1 to S-8), and `docs/prd-askboard-2026-10-25/addendum.md` (adoption rule). Follow the mod delivery spike's shape: `CHANGE/proposal.md`, `design.md` and `tasks.md` are the model (probe code in the change folder, `findings.md`, a final group "Decisions and the spine" with the PO's decisions, a "Workflow follow-up").
3. **Propose:** run the `opsx:propose` workflow for `spike-renderer` (spec-driven schema, `skip_specs: true` like the mod delivery spike, since it is a spike). The proposal names §10.3's exit criteria and S-1 to S-8; tasks are verifiable; the Linux checks go in a last group, optional. `openspec validate --all --strict --no-interactive` must pass. Commit `docs(spike-renderer): propose the renderer spike`.
4. **Apply** (authorised above): run the `opsx:apply` workflow and work through the tasks in order. Probe code lives in the change folder (as `probe/` does for mod delivery), with exact pins that meet the adoption rule (licence, stars, activity) and with Bun 1.4.4. Measure, do not argue: every verdict names the command or run that produced it. Record results in the renderer `findings.md` as you go; mark each task done only when its verification holds. Tasks that need the PO (decisions, at-the-keyboard checks, anything visual the PO must judge) are prepared and left open with "awaiting PO". Commit after each task group: `test(spike-renderer): …`.
5. **Stop before the spine:** write the renderer's "Proposed outcomes (awaiting the PO)" and a `spine-update-draft.md`, as in Phase 2; do not edit `docs/`. `openspec validate` and `bun run check` must pass in that worktree. Commit `docs(spike-renderer): findings and proposed outcomes`.

## Phase 5 (last, optional): Linux preparation for mod delivery task 4.1

Only if time remains. In `CHANGE/linux/`: a `Dockerfile` (Node 24 image, Bun 1.4.4, `tmux`, `git`, `python3`, Claude Code `latest` installed globally inside the image) and `run-linux.sh` that mounts `CHANGE/probe` read-only and a runs folder, takes `CLAUDE_CODE_OAUTH_TOKEN` from the caller's environment without writing it anywhere, and runs criteria 10, 12 and 13 (`c10-unix`, `smoke-exit.sh`, `run-c13.sh`). Build the image; run only the stub-only part of criterion 12 (`smoke-server.sh`, no model). Leave 4.1 open; record in the log the command the PO runs after `claude setup-token`. Commit `test(spike-mod-delivery): add the Linux devcontainer harness`.

## Stop conditions

Stop when the phases are done, or when two consecutive runs fail for a harness reason you cannot fix, or when nested sessions cannot authenticate (then continue with the work that needs no nested session). Leave no tmux session or background process running.

## Morning report

Append to the log below: per phase, done / partial / skipped with the reason; commits per branch (`git log --oneline origin/main..HEAD` in each worktree); what the PO must do next (decisions in both "Proposed outcomes" tables, renderer tasks awaiting the PO, `claude setup-token` and the Linux command, the PRs once decided). Under 40 lines.

## Log

### 2026-10-30, morning report

Phases:
- 1 done. c7b-312 and c7b-311 pass: asks open 30 m 50 s, same stub PID, the append read at step 18 of 24. d-stress passes on both versions (40 answers each, each reaching its owner once). d-esc-312 and d-esc2-312 fail: answers given after an Esc are lost (D6); the corrected retry in `probe/hooks/register.js` is not run (no third run under the spend rule). c8-toast-312 passes with a change: the toast shows for 2–4 s, the status entry stays and must be updated when an ask closes.
- 2 done. 13 pass, 4 pass with change (1, 6, 12, 13), 1 fail (8 with mods off); 18 proposed-outcome rows; `spine-update-draft.md`. Task 5.1 stays open for the decisions.
- 3 done. No bug changes a recorded measurement, so no fix. For E1: stamp the append time before the append; count only `isDelivered: true` as delivered; use `readlat.py`, not `latency.py`, for append runs.
- 4 done up to the PO. `spike-renderer` is at 26 of 32 tasks: 10 pass, 8 pass with change, 1 fail (Radix Select), 3 await the PO; 25 proposed-outcome rows; `spine-update-draft.md`. Linux arm64 matches macOS; x86-64 is untested. Group 5 fixed a build bug that disabled tree-shaking; the earlier runs were repeated on the new build and no verdict changed.
- 5 done for the stub. Image `askboard-spike-mod-delivery:linux`; the stub-only part of criterion 12 passes; the model runs (4.1) need a token.

Deviations: the c7b runs answered at 31 min, not 25 (task 3.6 needs 30 or more). Claude Code refuses a standalone `sleep` of 25 s or more, so steps chain `sleep 24`. Phase 5 ran in parallel with Phases 1–4. No third d-esc run. Cleanup: no run tmux session, process or container is left.

Commits (`git log --oneline origin/main..HEAD`), neither branch pushed:
- `worktree-feature-spike-mod-delivery`: 9d76abf, 5493dbc, 059fab6, 0b66806, b147bdc, and this log.
- `worktree-feature-spike-renderer`: b6ed474, 9d4f48a, 2536af0, 9a971df, 6fc11af, d75c13f, eaf7db4, 622e2de.

What the PO does next:
1. Decide both "Proposed outcomes (awaiting the PO)" tables: `spike-mod-delivery/findings.md` (18 rows) and `spike-renderer/findings.md` (25 rows). Then apply each `spine-update-draft.md` to `docs/` (mod delivery 5.2, renderer 8.4). The drafts overlap at SOLUTION-DESIGN §12 and the §13 introduction; the renderer draft's blocks say how to apply them in either order.
2. Renderer tasks awaiting the PO: 3.3 (board policy `img-src` and `font-src`, row 4), 5.2 (Select, row 6), 6.1 (screenshots), 6.2 (drag by hand in Chrome and Safari; steps in findings § Product owner checks), 8.3, 8.4.
3. Mod delivery 4.1: `claude setup-token`, then `CLAUDE_CODE_OAUTH_TOKEN=<token> sh openspec/changes/spike-mod-delivery/linux/run-linux.sh`.
4. D6: verify the corrected retry with the command in findings.md § Interrupt, then push (D6). The harness scripts hard-code `SCRATCH` to this run's `/private/tmp` folder: edit that line if the folder is gone.
5. Remove the criterion 5 leftover `~/.claude/plugins/cache/askboard-spike-mp/probe/0.1.0`.
6. Open the two PRs once the decisions are applied.
