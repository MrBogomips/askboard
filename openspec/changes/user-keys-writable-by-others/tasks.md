# Tasks

Each task writes its tests first and sees them fail before implementing. "The check" is `bun run build && GITHUB_TOKEN=$(gh auth token) bun run check`. Commit bodies say `Refs #224`. Groups run in order; effort high for groups 1 and 2, medium after.

## 0. Base

- [x] 0.1 Check every name design.md borrows on `origin/main` with `git grep -n`, and record each with its file and line in group 0's commit body, with main's SHA and `BOARD_PROTOCOL_VERSION`. Tests: none. Verify: every name is found with the shape design.md's Context gives; a missing or changed one stops the work for `/openspec-update-change`.

## 1. Contract: the warning code (D2)

- [ ] 1.1 Tests first in `packages/contract/test/settings-keys-messages.test.ts`: a `settings` message whose Keys row carries `{code: "keys-file-writable-by-others", file: "user", key: "keys"}` passes; the same with `rule` or `action` fails; `BOARD_PROTOCOL_VERSION`'s pin (`draft-record-numbers.test.ts` today) moves to main's minor plus one. Then the enum value and description in `board-protocol/settings.json`, `SettingWarning`'s union, and `BOARD_PROTOCOL_VERSION` with its header sentence. Verify: the cases fail first, then pass; the check passes.

## 2. Core: the rule and stderr (D1, D3, D5)

- [ ] 2.1 Tests first in `packages/core/test/config-keys.test.ts` and `config-diagnostics-text.test.ts`, with `othersCanWrite: true` (core, "A user file others can write", "A writable file's keys are not checked"): no override, `theme` applies, one warning, the project's first; no `keys-not-applied`; one stderr line. Then `keysRule` and `WARNINGS`, and AD-14's clause in the spine. Verify: the cases fail first, then pass; `othersCanWrite: false` cases pass unchanged; the check passes.

## 3. View: the Keys row (D3, D5)

- [ ] 3.1 Tests first in `board-page/settings-panel-data.test.ts` ("the Keys row") and `strings/keys-strings.test.ts` (its view requirement's three scenarios): `keysWarningsOf` holds the code after the project's warning, `otherWarningsOf` does not, and `keysWarningText` gives D3's text in both languages with the path isolated. Then the code, the string appended in `en-US.ts`, `it-IT.ts`, `keys.ts`, and EXPERIENCE.md's and DESIGN.md's lines. Verify: tests fail first, then pass; the check passes.

## 4. The help skill (D4)

- [ ] 4.1 Tests first in `tools/build/skills/help.test.ts` (skills, "The help skill names a user file others can write", both scenarios): `configure-keys.md`'s "Where" holds D4's bullet after the project file's, naming `chmod go-w`. Then `configureKeysText`, `bun run build:skills`, and commit `skills/askboard-help/`. Verify: the test fails first, then passes; `bun run check:skills` is clean; the commit body records `configure-keys.md`'s characters against 4,000.

## 5. Records and the rebase

- [ ] 5.1 Write `docs/as-built/user-keys-writable-by-others.md` (no status). Rebase onto `origin/main` and bind the board protocol at main's minor plus one (askboard-contract-versioning): the constant, its pins, the binding line in design.md D2 and in the note. Verify: borrowed names re-found; no stale number in the diff; the check, `bun run build` and `openspec validate --all --strict --no-interactive` pass.
