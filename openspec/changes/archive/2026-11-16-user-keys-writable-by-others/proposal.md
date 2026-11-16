# Proposal

## Why

Issue: #224

`ask-core` applies a user configuration file's `keys` even when another local user can write that file, while it already drops the same file's `editor` (AD-14, addendum security model, research risk R6). Since `board-keys` (#187) the user's keys also reach the board's own actions, so such a file can bind "Answer the question in focus" to an everyday key: finding X-2 of `board-keys`' pre-PR security review. The PO approved the fix on 2026-11-16: treat `keys` as `editor` is.

## What Changes

- **The rule.** A user file whose `keys` would apply, but which another user can write (the file or its folder group- or world-writable, owned by another user, or with an owner and mode that cannot be read), has its whole `keys` ignored with one warning, before the key-override check. The file's other keys apply. Every key keeps its default. This is the same test that already drops `editor`.
- **The warning.** A new warning code, `keys-file-writable-by-others`, on the user file and the key `keys`. Stderr writes one line for it at the session's first read, and the settings panel's Keys row shows it in both languages.
- **The help skill.** `askboard-help`'s key configuration reference says that such a file's keys are ignored, and how the user makes the file theirs alone.
- **Out of scope:** dropping only the board's actions (the Issue's narrower alternative). The `editor` rule and the file-mode test stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `core`: modified "Key overrides come from the user file only" (a user file others can write has its `keys` ignored with a warning).
- `view-and-widgets`: new requirement "A user file others can write in the Keys row".
- `skills`: new requirement "The help skill names a user file others can write".

## Impact

- `packages/contract/src/schemas/board-protocol/`: `settings.json` admits the new warning code, and `SettingWarning`'s code union in `index.ts` gains it. The board protocol widens to the next minor after main's. No other set changes.
- `packages/core/src/config/`: `rules.ts` (the `keys` rule) and `diagnostics.ts` (its stderr line).
- `packages/view/src/`: `board-page/settings-keys-data.ts` (the Keys row's warnings) and one string in `strings/en-US.ts`, `it-IT.ts` and `keys.ts`.
- `tools/build/skills/help-keys.ts` and the regenerated `skills/askboard-help/`, within the help skill's budgets.
- Documents: the spine's AD-14 (one clause, amended in place), EXPERIENCE.md (The user's keys; Voice and Tone), DESIGN.md (Settings panel), `docs/as-built/user-keys-writable-by-others.md`.
- Platforms: macOS and Linux (NFR-7). A Linux account with umask 002 creates group-writable files, so such a user's keys are ignored until the file is made private, as their `editor` already is (design.md, Risks).
