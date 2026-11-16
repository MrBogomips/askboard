# Design

## Context

See proposal.md (Why). Read on `origin/main` dc83380a:

- `screened` (`core/src/config/rules.ts`) runs `editorRule` then `keysRule` on each applied file. `editorRule` drops a user file's `editor` when `state.othersCanWrite` is true, with `{code: "editor-file-writable-by-others", file, key: "editor"}`. `keysRule` drops a project `keys` (`project-keys-ignored`) and a user `keys` the check refuses (`keys-not-applied`, at most `SETTING_ROW_WARNINGS_MAX`), and never reads `othersCanWrite`.
- `othersCanWrite` comes from `readConfigFile` (`server/src/config-files.ts`, `writableByOthers`): the file, its real folder or its link's folder has mode bits `0o022`, another uid owns one of them, or a status cannot be read. It is computed at every read, so `keys`, read again when a board opens (AD-14), follows a `chmod` at the next board.
- The warning codes are a closed enum in the board protocol (`schemas/board-protocol/settings.json`, `$defs/warning`; `SettingWarning` in `index.ts`). Its `if/then/else` admits `rule`, `action`, `binding` and `with` only for `keys-not-applied`.
- `configurationDiagnostics` (`core/src/config/diagnostics.ts`) writes one stderr line per warning from `WARNINGS`, a `Record` over every code, so a new code fails to compile until it has a line.
- The view: `keysWarningsOf` and `keysWarningText` (`view/src/board-page/settings-keys-data.ts`) give the Keys row the codes `isKeysWarning` names; `otherWarningsOf` gives the rest to the panel, which shows only the codes in `settings-panel-data.ts`' `WARNINGS`.
- `askboard-help`'s `references/configure-keys.md` holds 3,770 characters against `HELP_BUDGETS.reference` 4,000 (as `check:skills` counts them).

Constraints: AD-14, AD-8, NFR-5, NFR-10 (fail closed: an ignored `keys` leaves every key at its default), FR-34, NFR-7.

## Goals / Non-Goals

**Goals:** the same file test drops `keys` as drops `editor`, with a warning of its own on stderr and in the Keys row.

**Non-Goals:** changing `writableByOthers` (for example, trusting a group-writable file whose group is the user's private group); dropping only some actions; any change to the configuration schema.

## Decisions

### D1. The whole `keys`, before the check (#224; PO, 2026-11-16)

`keysRule` returns `[{code: "keys-file-writable-by-others", file: "user", key: "keys"}]` when the user file's `keys` is set and `state.othersCanWrite` is true, before `keyOverridesProblems` runs. `screened` then deletes `values.keys` as it does for the other `keys` warnings, so the settings carry no override and every key is its default (NFR-10). The project file's rule runs first, so its warning stays first (the merge orders the project's warning before the user's, as today).

*Alternatives.* Dropping only the board's actions (the Issue's second option) was rejected: it splits one file's `keys` into parts that apply and parts that do not, which "Key overrides are never half-applied" forbids, and a widget's keys can also be bound to everyday keys. Running the check first and reporting both was rejected: a file the user does not control is not worth explaining action by action.

### D2. A new warning code, the board protocol's next minor

`settings.json`'s warning enum gains `keys-file-writable-by-others`, its `description` gains the code's meaning, and `SettingWarning["code"]` gains it. The `else` branch already refuses `rule`, `action`, `binding` and `with` on it. A new enum value is minor-compatible, so the board protocol moves to the **next minor after main's**, bound at the rebase task (askboard-contract-versioning, Rules 1 and 2): the constant, one header sentence naming this change, the version test, and the earlier exact pins. No other set changes: the configuration file's schema and the Snapshot data do not carry warnings.

*Alternative.* Reusing `editor-file-writable-by-others` with `key: "keys"` avoids the minor, but its name, its stderr line and the panel's string all say "its editor is ignored", and the Keys row would not hold it.

### D3. Where the warning shows

- **Stderr.** `WARNINGS` gains "can be written by another user, or a folder above it can, or another user owns one: its keys are ignored (every key is the default).", beside the editor's line. It is a warning for `keys`, so "Key problems on stderr at the first read" writes it once.
- **Keys row.** `isKeysWarning` admits the code. `keysWarningText` gives `settings.warningKeysWritableByOthers` with `{file}`: en-US "{file} can be written by others: your keys are not applied", it-IT "{file} può essere modificato da altri: i tuoi tasti non sono applicati" (to review). The row's sort keeps the project's warning first. `settings-panel-data.ts`' `WARNINGS` does not list it, so no other row shows it.

### D4. The help skill

`configureKeysText` (`tools/build/skills/help-keys.ts`) adds one bullet to "Where", after the project file's: "A user file another user can write, or whose folder another user can write, has its `keys` ignored, with a warning: `chmod go-w` the file and its folder, and the next board takes them." About 170 characters, so `configure-keys.md` stays under 4,000. If it does not fit, the task stops and reports to the architect; the budget does not move.

### D5. Records

- **Spine, AD-14** (the `keys` sentence of the configuration bullet), amended in place: "...and so is a project-level `keys`, ... (AD-8); a user file's `keys` is ignored with a warning, as its `editor` is, when another user can write the file or its folder." No new AD.
- **EXPERIENCE.md**: Accessibility Floor, "The user's keys": one sentence, a user file others can write has its keys ignored and the settings panel says so. Voice and Tone, "Settings panel: Keys warnings": D3's strings.
- **DESIGN.md**: Settings panel, States: the row warnings gain "a user file's `keys` ignored because others can write the file".
- **As-built**: `docs/as-built/user-keys-writable-by-others.md`, naming the code, the files and the bound board-protocol minor.

## Merge points

| With | Shared paths | Rule at the rebase |
|---|---|---|
| `palettes` (`worktree-feature-palettes`, read at 087bcf54) | The board protocol's version and header comment (`board-protocol/index.ts`); `board-protocol/settings.json` (it adds a palette row, we add an enum value under `$defs/warning`); `strings/en-US.ts`, `it-IT.ts`, `keys.ts` (both append); DESIGN.md's Settings panel; EXPERIENCE.md's Voice and Tone | Whichever merges first takes main's minor plus one; the other rebinds to the next. Keep both sides' lines. It modifies the contract requirement "Settings messages on the board protocol"; this change does not |
| `diagram-render`, `reopen-start-from-answer` and any other change in flight that widens the board protocol | The board protocol's version | The same rebinding rule |

Borrowed from `main` (task 0.1 checks each on `origin/main`): `screened`, `keysRule`, `editorRule`, `FileState.othersCanWrite`, `SettingWarning`, `SETTING_ROW_WARNINGS_MAX`, `configurationDiagnostics`, `WARNINGS` (diagnostics), `keysWarningsOf`, `keysWarningText`, `isKeysWarning`, `otherWarningsOf`, `configureKeysText`, `HELP_BUDGETS`, `BOARD_PROTOCOL_VERSION`, `STRING_KEYS`.

## Needs probe

None: the change makes no assumption about Claude Code's run-time behaviour.

## Risks / Trade-offs

- [A Linux account with umask 002 (Fedora, and Debian or Ubuntu with private user groups) creates the user file group-writable, so its keys are ignored, as its `editor` already is] → the panel and stderr say why, and the help skill gives the `chmod`. The board's own writes create the file `0o600` in a `0o700` folder, so a file the board created is not affected. Trusting a private group is a change to `writableByOthers`, outside this change.
- [A file that turns writable after a board opened] → `keys` is read again when the next board opens and is dropped there, as a refused `keys` is.

## Migration Plan

None. A user file others can write that sets `keys` takes the default keys at the next board, with the warning.
