# Proposal

## Why

AD-4 makes the Claude Code mod AskBoard's push transport, and AD-5 routes pushes and checks ownership through agent records that a `PreToolUse` hook sends over loopback. Both rest on facts no source states (SOLUTION-DESIGN §13: F3, F5, F6, F12, F13, F15, F16, F17; PRD R1). If they are wrong, AD-4, AD-5, AD-10, AD-11 or AD-12 change, or AskBoard runs on pull alone. These units come before E1 builds `mod`, `hooks` and the local API, so the spike runs first in phase 1 (SOLUTION-DESIGN §10.1). It also confirms the minimum Claude Code version that the release waits on (AD-18; provisionally 2.1.311, while `stable` is 2.1.308 on 2026-10-29).

## What Changes

- **A probe plugin**, kept in this change under `probe/` as evidence and not shipped. It has a stub stdio MCP server that has a local API on `127.0.0.1` with a token and writes a session file (AD-5, AD-11). It has hooks that log their input (`PreToolUse`, `PostToolUse`, `SubagentStop`), and a mod that polls the stub and pushes with `$.session.send` and `$.prompt.submit`. A driver script stands in for the board: it appends answers and timestamps them. The probe uses only Bun's and Node's built-ins, with no dependency.
- **Runs** of exit criteria 1 to 18 of §10.1, on the declared minimum (2.1.311) and on `latest` (2.1.312 on 2026-10-29), with default protocol negotiation. The stable channel (2.1.308) runs only for the criteria that decide the minimum, to show what fails below it. The fallback adapters (a Monitor watch and `PostToolUse` `additionalContext`) are probed only for a kind of agent the mod fails to reach, or when criteria 9 to 11 fail.
- **`findings.md`**: each criterion's result per version and its evidence (log excerpts, timings, token counts); latency per kind of agent (input to OQ2); extra tokens per answer (the cost model's X); and the minimum version that passes everything.
- **Spine update**, in this change, decided by the product owner on the findings:
  - Deferred: the push-transport row closes. So does the row for the minimum version and the session-file key. The latency row becomes the product owner's decision on OQ2, from criterion 3.
  - Stack: the Claude Code minimum is confirmed or moved.
  - ADs amended in place where a finding requires it: AD-4 (a further adapter for a kind of agent), AD-5 (identifiers, record binding, the session-file key, reaching the session process), AD-10 (the `SubagentStop` condition), AD-11 (`Origin` on mod requests), AD-12 (the root of `isolation: worktree` subagents), AD-18 (version source and minimum).
  - SOLUTION-DESIGN §13: the status of each fact the spike checks; §10.1 records the outcome.
  - PRD: OQ2 gains its target if the product owner sets one now; R1 is updated if a kind of agent stays without push.

## Capabilities

### New Capabilities

None. The spike settles facts and decisions and implements no product behaviour, so `.openspec.yaml` sets `skip_specs: true`. The `mod`, `hooks` and `board-host` capability specs come with the epics that build them, on the decisions recorded here.

### Modified Capabilities

None.

## Impact

- **New, in this change:** `probe/` (stub server, hooks, mod, driver, plugin manifest), `findings.md`.
- **Changed:** `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` (Deferred, Stack, and the ADs that the findings require changing), `SOLUTION-DESIGN.md` (§10.1, §13, §12 if owners change); `docs/prd-askboard-2026-10-25/prd.md` only if OQ2 or R1 changes.
- **No product code, no dependency:** nothing under `packages/` changes, and `bun.lock` stays as it is. The 2.1.311 Claude Code runs from a scratch install prefix, outside the repository and the user's global install.
- **Requirements and decisions served:** FR-10, FR-21 to FR-25, NFR-2, NFR-3, NFR-4, NFR-8, NFR-10, R1, OQ2; AD-3, AD-4, AD-5, AD-10, AD-11, AD-12, AD-18.
- **Gates:** E1's `mod`, `hooks` and local API build on the outcome. The release gate on the minimum version (AD-18) is confirmed or moved.
