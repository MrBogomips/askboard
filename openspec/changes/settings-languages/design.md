# Design

## Context

Motivation and scope: proposal.md. The PO's open questions are in the proposal (A1 to A10, B1 to B17); each decision below names the ones it rests on.

**What `main` holds at 92ca203** (E1, compute-engine, early benchmark):

- **No configuration.** `contract/src/versions.ts` reserves the set name `configuration` with owner `ask-core` and defines no schema; `ask-core`'s ports (`packages/core/src/ports.ts`) are `BoardAddress`, `BoardShowing`, `Identity`, `Randomness` and `Report`. The session process takes the project as `CLAUDE_PROJECT_DIR || cwd` for identity only (`server/src/session-process.ts:57`). Nothing creates `.askboard/`; the server instructions only tell agents to save screenshots under `.askboard/media/`.
- **English only.** The input format sets `language` and `locale` to `const: "en-US"` (`schemas/input/ask.json:32-37`), refused with "the only language AskBoard supports for now" (`requests.ts:62-63`), while the approved tool definition already offers `["en-US", "it-IT"]` (`schemas/tool-envelopes/tools.json:22-27`). The board document carries no language. Every string of the view and the board page is an English literal, and `<html lang="en">` is written in `server/src/board-host/pages.ts`, `view/src/assemble/index.ts` and `tools/build/board-page.ts`. Nothing formats through `Intl`; `compute` is locale- and time-zone-free by design (`compute/src/dates.ts:1-2`).
- **Theme follows the system only.** `view/src/theme.ts` exports `Theme = "light" | "dark"`, `followSystemTheme` and `applyTheme` (the `.dark` class); the board page passes the theme to the view in ext-apps' host context (`board-page/view-host.ts:43`, `:68`) and keeps nothing in browser storage (`board-page/start.ts:8`). The token build emits the compact ramp only and drops the `-comfortable` keys (`tools/build/tokens.ts`).
- **View protocol.** View messages are ext-apps tool calls `askboard.view.<type>`; the board page tells the view things with `ViewUpdate` notifications (`view/src/view-protocol.ts`); the srcdoc boots from the `askboard-data` block (`view/src/boot-data.ts`).
- **Tests.** The browser harness's session-process target runs `dist/askboard.mjs` from the repository root with the developer's `HOME` and no `XDG_CONFIG_HOME` (`packages/view/test/browser/harness/session-process.ts:255`, `:329`); the conformance runner gives a temporary `HOME` and checks it stays empty at `server/discover` (`packages/server/test/conformance/conformance.e2e.ts:129-137`). `compute/test/determinism.test.ts` already re-runs fixtures under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` and `LANG`/`LC_ALL` `en_US.UTF-8` and `de_DE.UTF-8`. CI runs Linux jobs only: `openspec`, `check` and `e2e`.

**What E3 and E4 bring** (read on their branches at 3910e00 and dacb395; group 0 checks every name once they are on `main`):

- **E3 (`ask-lifecycle`):** the board protocol at `1.1` with `BOARD_PROTOCOL_MESSAGES` (`toHost`: `connect`, `answer`, `act`, `draft`; `toPage`: `board`, `state`, `receipt`, `discarded`, `moved`, `refused`, `done`, `draft`, `closed`), and its "four appended steps" for a new message (E3 design.md:115-122); the view's two-row context header `shell/board-header.tsx` and bottom bar `shell/bottom-bar.tsx`; the rule that each set takes its next minor at merge (E3 design decision 2).
- **E4 (`push-delivery`):** the local API on a Unix socket, `GET /v1/rule` answering `{version, rule, showable}` and fixed at `rule: "none"` (`server/src/board-host/local-api/routes.ts:73-74`); `ASKING_RULES` and `AskingRule` (`contract/src/push/asking-rules.ts`); `sendsToAskBoard(rule, input)` with `with-references` throwing (`hooks/src/asking-rules.ts:7-28`); the PreToolUse hook that lets a call through when the rule's predicate throws (`hooks/src/pre-tool-use.ts:79-90`); optional members of `CorePorts` (`AgentRecords`, `Notices`).

**What other branches hold that E8 reads:** E5 (`excerpts`, proposal 205ad48), E7 (`snapshot`, b7c5438), `tree-widget` (PR #11, bcb4e29), `gantt-widget` (bb2db28), `molecules` (65491c0) and `widget-answers` (e7592bc). Their deferrals to E8 are in "Until E8" below.

## Goals / Non-Goals

**Goals:**

- One reader of the configuration files, in `ask-core`, behind one `Config` port, so no two units apply precedence differently (AD-14).
- The board writes only `theme`, `density` and `contextPlacement`; nothing an agent can write chooses a command; a file that fails its check applies nothing.
- Every string AskBoard shows on a board in en-US and it-IT; every value shown and typed in the ask's locale; the same text in every engine, time zone and runtime locale.
- Every "until E8" default closed in one table, each with what E8 does if it lands before the change that set it.

**Non-Goals:**

- The operations keys (port range, container opt-in, host-side address and port, grace period, record timeout): A3.
- More languages, a translation pipeline, right-to-left text, a language switch on the board (FR-34 forbids it).
- MoneyField, DateField and Value as atoms: their epics, using E8's formats and entry rules. E8 converts the number and date fields that exist on `main` when it runs.
- The notifier's, terminal's, hooks' and mod's texts (B13).

## Decisions

### 1. Order, dependencies and what happens if E8 lands first

Group 0 waits until E3 and E4 have merged to `main`, rebases, and checks every name it borrows (Context above); a name that differs stops the work for `/opsx:update`. The other branches are read with `git show` only. Some tasks need a change that may not be on `main` yet; each has a form for that case, so E8 never waits on it and the later change reads the key instead of its interim default:

| Task | Needs | If E8 lands first |
| --- | --- | --- |
| 5.3 the editor command | E5's `editorCommand` dependency of `board-host` | E8 exposes the editor in effect on `ask-core`'s settings; E5, on its rebase, wires `editorCommand` to it instead of `() => undefined`, and keeps "Open in editor" disabled only while no editor is in effect |
| 8.5 the context-placement default | E5's context column and per-question control | The view's presentation holds `contextPlacement`; E5 reads it as its default instead of "beside" |
| 8.4 the side sheet | E5's reading panel | E8 builds the board page's side sheet; E5's reading panel reuses it, one sheet at a time |
| 7.1 the strings | E5's and E7's strings | Those changes add their strings to both tables; the catalogue test fails otherwise |
| 4.6 the Snapshot folder | E7's writer | E7 takes the folder in effect from `ask-core` instead of `SNAPSHOT_FOLDER` |
| 1.2 the `.askboard/` constants | E7's `SNAPSHOT_FOLDER` and `ASKBOARD_GITIGNORE` | E8 defines them with E7's names and values; E7 reuses them |
| 8.3 the Theme control | E7's Snapshot header (B11) | E7 reuses the quick Theme toggle, which saves nothing in a Snapshot |
| 7.3 the Snapshot's top line | E7's top line (B6) | E7 formats its time with the contract's date-time format, in the ask's locale |
| 9.1 the Tree's number columns | `tree-widget` | The Tree passes the widget host's locale to the contract's number entry |
| 9.2 the Gantt's dates | `gantt-widget` | The Gantt's `date.ts` delegates to the contract's date entry and formats |
| 10.1 the number step of the end-to-end scenario | a number field on `main` (the Tree) | The step waits for the first number field on `main` and is recorded open |

`molecules` defers nothing to E8 (its open question 9 shows en-US values by choice); `defaultMinimumMargin` waits for the sales molecule's epic (B14). `widget-answers` keeps "`language` and `locale` stay `en-US` until E8" (its contract spec), which decision 7 supersedes.

### 2. Contract: appended blocks and versions

- **Configuration set** (`packages/contract/src/schemas/configuration/`): `config.json` (`urn:askboard:configuration:config`) and `index.ts` with `CONFIGURATION_VERSION = "1.0"`, `CONFIGURATION_KEYS`, `PRESENTATION_KEYS`, `CONFIGURATION_DEFAULTS` and the TypeScript types. The root is an object with `version` required and the eight keys optional; it admits other keys, which the reader warns on (B2). `editor` is `{type: array, minItems: 1, maxItems: 32, items: {type: string, minLength: 1, maxLength: 1024}}`; `snapshotFolder` a string of at most 1,024 characters; `defaultMinimumMargin` a number from 0 to 100 (B14). The set joins `SCHEMA_SETS` and `SCHEMA_IDS` as appended entries.
- **Next minors, assigned at merge** (E3 decision 2): the input format (`language` and `locale` from `const` to `enum`, B8), the board document (`language` and `locale` at the root, B7) and the board protocol (`settings`, `setting`, B5). E8 reads no other change's number.
- **Locale formats** (`packages/contract/src/locale/`, A6): `LOCALES`, the tables of separators, month and weekday names and currency symbols and minor units, and pure functions: `formatNumber(value, locale, {minFraction?, maxFraction?})`, `formatMoney(amount, currency, locale)`, `formatPercent(ratio, locale)`, `formatDate(fullDate, locale)`, `formatLongDate(fullDate, locale)`, `formatTime(instant, offsetMinutes, locale)`, `formatDateTime(instant, offsetMinutes, locale)`, `parseNumber(input, locale)`, `numberEcho(value, locale)`, `parseDate(input, locale)`, `dateEcho(fullDate, locale)`. Money takes a decimal string, as AD-7 carries it, and rounds only for display to the currency's minor unit (AD-13). An entry's refusal carries a code and its text in the ask's language, since `widgets` cannot import the view's catalogue (AD-1). No `Intl`, `toLocale*`, `Date` parsing of a calendar date, or runtime default.
- **Asking-rule references** (A5): `hasReference(text)` and its two patterns, in a new file beside E4's `push/asking-rules.ts`, with a short description for the skills.
- **Exports**: one appended block at the end of each of `src/index.ts`, `src/validate.ts` (`validateConfiguration`) and `src/fixtures/index.ts`, as the tree-widget change does. No other existing contract file changes, except `schemas/input/ask.json` and the input's TypeScript type (the two `enum`s), `requests.ts` (the `expected` text), the board document's root schema (two optional properties) and the version constants.

### 3. The `Config` port and its adapter (B1, B3, B4)

`ask-core` declares, in `packages/core/src/config/ports.ts`:

```ts
type FileRead =
  | { kind: "absent" }
  | { kind: "read"; text: string; othersCanWrite: boolean }
  | { kind: "unreadable"; code: string };
type Config = {
  userFile(): Promise<FileRead>;              // the user file, read now
  projectFile(): Promise<FileRead>;           // absent without a project root
  replaceUserFile(change: (current: FileRead) => Replace): Promise<WriteResult>;
  ensureProjectFolders(): Promise<FolderResult>;
  readonly paths: { user?: string; project?: string }; // as the panel shows them
};
type Replace = { kind: "write"; text: string } | { kind: "refuse"; reason: RefusalCode };
```

`CorePorts` gains `config?: Config`, appended; without it every key takes its default and nothing is written. `ask-core` parses, validates with the contract, merges and applies every rule; it calls no Node API.

The adapter, `packages/server/src/config-files.ts`, sits beside `identity.ts` among AD-1's entry-point files, so the import rules need no change. It resolves the paths once (decision 4), reads with `lstat` and `stat` to report `othersCanWrite` (group or world write on the file or its folder, or another owner), and replaces the user file by: resolving a symlink to its target; re-reading the target; calling `change`; on `write`, creating the folder `0700` when missing, writing `<target>.<random>.tmp` with mode `0600` (or the existing file's mode), `fsync`, `rename` over the target, then `fsync` of the folder; removing the temporary file on any failure. It never follows a symlink for the temporary name and never writes outside the target's folder.

### 4. Reading, merging and failing closed (A1, A2, B2)

- **Paths**: the project file is `<realpath(CLAUDE_PROJECT_DIR)>/.askboard/config.json`, and none without the variable (AD-12). The user file is `$XDG_CONFIG_HOME/askboard/config.json` when `XDG_CONFIG_HOME` is absolute, else `$HOME/.config/askboard/config.json` when `HOME` is absolute, else none. The panel shows the user path with `~` for `HOME`.
- **When**: `ask-core` reads both on the first call that needs a setting (the first ask, `/v1/rule`, a board's connect) and memoises the result; nothing runs before the first request after `server/discover` (AD-2). That is the session's "start" for AD-14's next-session rule.
- **Per file**: absent means no keys. Unreadable, not JSON, a `version` whose major is not 1, or a schema failure means the file is **not applied**: none of its keys count, and the reason is kept as `{code, pointer?}` (`unreadable`, `not-json`, `version`, `schema`) for the stderr diagnostic and the panel. A file that passes contributes its known keys; each unknown key is a warning `{code: "unknown-key", file, key}`.
- **Merge**: for each key, the project value, else the user value, else the default (`CONFIGURATION_DEFAULTS`). `editor` and `snapshotFolder` then pass decision 5. The result is the **settings in effect**, each key with `from` (`project`, `user`, `default`), the other file's value when both set it, and its warnings.
- **Diagnostics** go to stderr once per session, naming the file path, the code, the JSON pointer and Ajv's keyword, never a value of `editor`. Nothing is added to tool results (A1).

### 5. The editor and the Snapshot folder (security)

- **`editor`** is taken from the user file only. A project-level `editor` is dropped before the merge, with the warning `project-editor-ignored`, whatever the user file holds (AD-8). A user `editor` from a file whose read says `othersCanWrite` is dropped with `editor-file-writable-by-others` (B4). The command is handed to `board-host` as the argument vector; `{file}` and `{line}` are replaced in E5's `editorArguments`, and nothing else is expanded.
- **`snapshotFolder`** (B15) passes a syntactic check in `ask-core`: a relative path with no leading `/` or `~`, no backslash, no NUL, no empty or `.` segment after normalisation, and no `..` that leaves the root. Anything else is replaced by `.askboard/snapshots/` with the warning `snapshot-folder-replaced` (AD-14). E7's writer keeps its real-path check at write time, which also catches a symlink out of the project.
- **The board's reach** (SOLUTION-DESIGN §6): a holder of a board token can read the settings in effect, the editor's argument vector included, and change one of three presentation keys to a schema value. It cannot write any other key, choose a command, or write a path, and the session token never comes near a board.

### 6. Presentation keys: reading, writing, applying (B5, B10)

- **At connect**, `board-host` asks `ask-core` for the settings for a board: the user file's presentation keys are read again (decision 4's per-file rules) and merged with the project values read at first use; the behaviour keys come from the first read. `board-host` sends `settings` before the board (E3's connect sequence gains one appended call).
- **`settings`** carries `keys` (each `{value, from, writable, other?, warnings?}`), `files` (`user` and `project`, each `{path, status: "applied" | "absent" | "not-applied", problem?}`), `warnings`, and, after a write, `write: {key, outcome: "saved" | "refused" | "failed", reason?, path?}`. Warnings and problems are codes with their file, key or pointer; the board page renders them in the ask's language.
- **`setting {key, value}`**: its schema admits only the three keys and their values, so anything else is a `message` refusal (E1's path) before the session process sees it. `ask-core` checks again: a key the project sets is refused (`set-by-project`); otherwise it calls `replaceUserFile` with a transform that re-validates the current file (refusing `file-not-applied` if it fails), sets the key in place or appends it, keeps every other key in its order, and writes JSON with two-space indentation and a final newline. A new file holds `{"version": "1.0", <key>: <value>}`.
- **Applying**: the board page applies the value at once (theme on its root and in the host context, density and placement through the view update), sends `setting`, and on a `failed` or `refused` outcome keeps the value on that board and shows the error under the row. Other open boards keep theirs until they reconnect (B10).

### 7. The ask's language and locale (B7, B8)

`ask-core` fixes them when an ask is accepted (the core's ask creation gains one call): `language = ask.language ?? settings.defaultLanguage ?? "en-US"`, `locale = ask.locale ?? language`. Every revision's board document carries both at its root; `update` cannot change them, and the input format has no such field on `update`. The view and the board page read them from the board document; a document without them reads as `en-US` (an older Snapshot). FR-34's "for another language, the agent closes the ask and opens a new one" needs nothing new: E3's close and a new ask.

### 8. Formats and entry rules (A6, A7, A8)

| | en-US | it-IT |
| --- | --- | --- |
| Number | `1,234.5` | `1.234,5` |
| Money (EUR) | `€12,480.00` | `€ 12.480,00` |
| Money (USD) | `$12,480.00` | `$ 12.480,00` |
| Other currency | `CHF 12,480.00` | `CHF 12.480,00` |
| Percent | `18.5%` | `18,5%` |
| Date | `10/27/2026` | `27/10/2026` |
| Long date | `Tue, Oct 27, 2026` | `mar 27 ott 2026` |
| Time | `4:12 PM` | `16:12` |
| Date and time | `Oct 28, 2026, 4:12 PM` | `28 ott 2026, 16:12` |
| Gantt axis | `Mon 2`, `Nov 2`, `Nov 2026` | `lun 2`, `2 nov`, `nov 2026` |
| Number entry | `1,234.5`; `,` only between groups of three | `1.234,5`; `.` only between groups of three |
| Number echo | `= 1234.5` | `= 1234,5` |
| Date entry | `M/D/YYYY` or `YYYY-MM-DD` | `G/M/AAAA` or `AAAA-MM-GG` |
| Date echo | `= Wed, Dec 9, 2026` | `= mer 9 dic 2026` |

- A calendar date is split from its `YYYY-MM-DD` text and its weekday computed arithmetically; it never becomes a `Date` in a time zone (AD-7). A time is an RFC 3339 instant shown at an offset the view takes from `new Date(instant).getTimezoneOffset()`, which is the viewer's time zone.
- The it-IT number rules mirror the Tree's en-US parser (`tree-widget`, `packages/widgets/src/shared/number.ts`) with the two marks swapped: no exponent, one leading sign, digits, `.` only in groups of three after a first group of one to three digits, one `,` with digits on both sides. Each refusal names the first rule broken, with an example in that locale. The en-US reasons stay word for word.
- Currency symbols are the table's (`EUR` €, `USD` $, `GBP` £); any other code shows as the code. Minor units come from the table (`JPY` 0, default 2).

### 9. Strings (A9, B9, B13)

- **Catalogue**: `packages/view/src/strings/` holds `keys.ts` (the typed keys), `en-US.ts` and `it-IT.ts`. A string is a template with named slots (`"{count} open"`), filled as text only, and an optional `one`/`other` pair for counts. `t(language, key, slots)` is the one lookup; the view and the board page bundle it. A test checks that both tables hold the same keys, the same slots per key and no empty value.
- **Conversion**: group 7 moves every literal on `main` at that point into the catalogue: E1's, E3's and E4's view and board-page strings, with the Italian of the UX draft. A change that lands later adds its strings to both tables.
- **Widgets** take `language` and `locale` from the widget host's context, appended beside the Tree's `colorScheme`, and their entry texts from the contract (decision 2).
- **`lang`**: the board page sets `document.documentElement.lang` from the board document (`en` or `it`); `assemble` takes the language and writes it into the srcdoc's `<html lang>`. The board page's static `lang="en"` stays until the first board arrives, and the invalid-link pages stay English (B13).

### 10. The settings panel and the quick toggles (A10, B6, B11)

- **Quick toggles** sit at the right end of header row 2 (E3's `board-header.tsx`, after E4's agent pill and E3's counts): "Theme" with "System | Light | Dark", "Compact | Comfortable", then "Settings" after a separator (DESIGN, Context header). A toggle the project fixes is disabled, its description naming the file and key. They send `askboard.view.setting {key, value}`; "Settings" sends `askboard.view.open-settings`.
- **View updates**: `presentation {theme, density, contextPlacement, locked}` (appended to `ViewUpdate`), and an optional `presentation` in `BootData`, so the first render has it. In a Snapshot there is no board page: the Theme toggle sets the class locally and saves nothing, density stays compact and "Settings" is hidden (E7).
- **The panel** is board-page DOM in the side sheet (DESIGN, Settings panel): a header with "Settings" and ✕; group 1, the three segmented controls, each a WAI-ARIA radio group with arrow keys, Home and End; group 2, the Language indicator ("English (en-US)", "Italiano (it-IT)", with "· formats it-IT" or "· formati en-US" when the locale differs); group 3 under "Applies from the next session", the four read-only rows. Each row shows the value in effect in code type and, under it, `<file> · <key>`; a default reads "default" with the user file and key; a value the other file also sets adds "also in <file>: <value> (not used)"; the row's warning follows. A file not applied shows once, above group 3, with its problem. Esc or ✕ closes it and the board page asks the view to focus "Settings" (B6).
- **The side sheet** is shared with E5's reading panel; whichever change lands first builds `board-page/side-sheet.ts`, and opening one panel closes the other (B11).

### 11. Theme and density (B12)

- `theme.ts` gains `ThemePreference = "system" | "light" | "dark"` and `resolveTheme(preference, systemDark)`; the board page follows the system only under `system`, and still passes the resolved `light` or `dark` to the view, whose `.dark` class is unchanged.
- The token build emits every `-comfortable` key as the base key's value under `.comfortable` (spacing and the four heights, and the comfortable type ramp), on the view's and the board page's roots, as `.dark` re-points colours; components keep reading the base keys. `chunk-sizes.json` is re-recorded with the change named.

### 12. The asking rule (A5)

`ask-core` exposes the `askingRule` in effect; the session process passes it to E4's local-API routes, whose `rule` handler answers it instead of `"none"`. `hooks/src/asking-rules.ts` gets the `with-references` predicate: true when `hasReference` holds for any question's `question` or `header`, or any option's `label`, `description` or `preview`. The input is checked structurally; a malformed input makes the predicate false, so the call proceeds, as E4's hook does for every failure. `mod` reads no setting in this change.

### 13. The project folders (A4)

On the first accepted ask, `ask-core` calls `ensureProjectFolders()` once and reports a failure through `Report`. The adapter creates, under the session project root only, `.askboard/` and `snapshots/`, `media/`, `patches/` when missing (`mkdir` without `recursive` on the root itself, so a missing root is an error), and writes `.askboard/.gitignore` with `ASKBOARD_GITIGNORE` using an exclusive create, so an existing file is never touched. `bench/` is the benchmark's (early-benchmark design.md:190). A configured `snapshotFolder` elsewhere is created by the Snapshot writer at the first Snapshot, and AskBoard does not add it to any `.gitignore`.

### 14. Tests (B16, B17)

- **Isolation first**: the browser harness and the conformance runner give the child a temporary `HOME` and `XDG_CONFIG_HOME` and a temporary project with `CLAUDE_PROJECT_DIR`; a test that needs a configuration writes it there.
- **Unit**: the contract's schema and locale fixtures; `ask-core` against a fake `Config`; the adapter against real temporary folders, with attacks: a project `editor`, a fourth key on the protocol, a `"sepia"` theme, a symlinked user file, a symlink in place of the temporary name, a group-writable file, a read-only folder, a user file that is not JSON, a write racing a hand edit.
- **Determinism** (AD-13, B17): the contract's locale fixtures and the view's formatting fixtures re-run in subprocesses under the two time zones and `en_US.UTF-8` and `de_DE.UTF-8`, like `compute/test/determinism.test.ts`; the browser scenarios that show values run with Playwright's `locale: "de-DE"` and each `timezoneId`.
- **Browser**, in Chromium, Firefox and WebKit: the it-IT board, header row 2 at 1280 px with Italian strings, number and date entry, the panel and its keyboard use, theme and density, a project-fixed key, a failed write, an it-IT Snapshot.
- **End to end** on the real session process (E1's session-process target and the conformance runner): a project file (`defaultLanguage` `it-IT`, `editor`) and a user file (`theme` `light`, `editor`) both present; an ask without a language opens in Italian; `1.234,5` typed in a number field answers 1234.5; the board writes `theme` `dark` and a later board opens dark, with the user file changed in that key only; stderr and the Editor row say the project's `editor` is ignored, and "Open in editor" (with E5) runs the user's command.

## Until E8: the deferrals this change closes

| # | Key or item | Deferred by | Interim default | What E8 does |
| --- | --- | --- | --- | --- |
| 1 | `editor` key and its form | E5 open questions A3 and A4 (`excerpts/proposal.md:56-57`; `design.md:117`, `:231`; spine draft block 3) | No editor; "Open in editor" disabled with "No editor set"; `editorCommand: () => undefined` | Adopts A4's argument vector in the schema; user file only, project value ignored with a warning; wired to `editorCommand` (decision 5; task 5.3) |
| 2 | `contextPlacement` default | E5 A13 (`excerpts/proposal.md:66`; `design.md:232`) | "beside" on every board | Presentation key, written from the panel, given to the view; E5's per-question control still overrides it (task 8.5) |
| 3 | `.askboard/`, `media/` and `.gitignore` at the first ask | E5 hand-over (`excerpts/design.md:235`); E7 A6 (`snapshot/proposal.md:54`) | E7 creates `.askboard/` and `snapshots/` at the first Snapshot; nothing at the first ask | Created at the first ask under the project root, `.gitignore` only when created (A4; task 4.4) |
| 4 | Italian strings | E5 A14 (`excerpts/proposal.md:67`); E7 (`snapshot/proposal.md:17`); E3 (`ask-lifecycle/design.md:155`, strings at `:97`); EXPERIENCE Open Items 4 | English only | Catalogue in both languages; the UX draft's Italian column (A9; tasks 7.1, 11.2) |
| 5 | `snapshotFolder` | E7 A5 (`snapshot/proposal.md:53`; `design.md:171`) | `.askboard/snapshots/` only | Key, syntactic check, replacement with a warning, panel row; given to E7's writer (decision 5; task 4.6) |
| 6 | The Snapshot's Theme control | E7 B11 (`snapshot/proposal.md:69`; `design.md:133`) | A local System/Light/Dark control in the Snapshot header if E8's toggles are absent | The quick Theme toggle; in a Snapshot it saves nothing (task 8.3) |
| 7 | The Snapshot top line's locale | E7 B6 (`snapshot/proposal.md:64`) | en-US | The ask's locale, the viewer's time zone (task 7.3) |
| 8 | it-IT number entry | `tree-widget` open question 7 (`tree-widget/proposal.md:66`; `design.md:185`) | en-US parser only (`widgets/src/shared/number.ts`) | The contract's entry rules per locale; the Tree reads the host's locale (A8; task 9.1) |
| 9 | it-IT dates and numbers in the Gantt | `gantt-widget` (`proposal.md:22`; open question 16, `:84`; `design.md:124`, `:126`, `:187`) | en-US date parser, echo, grid and axis | The contract's date entry and formats per locale (task 9.2) |
| 10 | The configuration schema | E1 open question 7 (`e1-walking-skeleton/proposal.md:59-60`, accepted by the PO on 2026-10-30) | None | The `configuration` set at 1.0 (task 1.1) |
| 11 | en-US-only input | E1 (`e1-walking-skeleton/specs/contract/spec.md:35-37`); E3 (`ask-lifecycle/specs/contract/spec.md:7`, `:41`); `widget-answers` (`specs/contract/spec.md:6`) | `language` and `locale` `const: "en-US"` | `enum` of `en-US` and `it-IT` at the next minor (B8; task 2.1) |
| 12 | The asking rule's source and `with-references` | E4 open question 1 (`push-delivery/proposal.md:51`; `design.md:25`, `:38`, `:160`; `tasks.md:162`; `specs/board-host/spec.md:73-78`; `specs/hooks/spec.md:80`; `routes.ts:73-74`; `hooks/src/asking-rules.ts:10-13`) | `none`; `with-references` throws | The rule in effect through `/v1/rule`; the predicate (A5; tasks 4.6, 6.1) |
| 13 | The container opt-in | E1 open question 6 (`e1-walking-skeleton/proposal.md:57`) | Devcontainers get `unavailable` | Stays: the key comes with the devcontainer change (A3) |
| 14 | The grace period as a key | E3 open question 4 (`ask-lifecycle/proposal.md:52`; `design.md:155`) | `GRACE_PERIOD_MS` 120,000 | Stays a constant (A3) |
| 15 | `defaultMinimumMargin` | Spine AD-14; model-contract finding F8 (unit not fixed) | None | Named in the schema, merged, unread until the sales molecule's epic (B14) |

## Merge points

Every addition to a file another change also edits is an appended block, so the later merge keeps both sides' lines:

- **Contract**: the appended export blocks at the end of `src/index.ts`, `src/validate.ts` and `src/fixtures/index.ts` (tree-widget, E3, E4, E5 and E7 append theirs; a conflict between appended blocks keeps every line of each); the appended entries of `SCHEMA_SETS`, `SCHEMA_IDS` and `BOARD_PROTOCOL_MESSAGES` (E3's four steps); the version constants of the input format, board document and board protocol, each at the next minor after `main` at group 0; the two `enum`s in `schemas/input/ask.json`; the board document's root schema; `ASKBOARD_GITIGNORE` and `SNAPSHOT_FOLDER`, defined once by whichever of E7 and E8 lands first.
- **`ask-core`**: `CorePorts` in `src/ports.ts` gains `config?` as an appended member (E4 appended its own); the core's ask creation gains one call (language) and the first-ask hook (folders); the new folder `src/config/`.
- **Session process**: `session-process.ts` composition gains the `Config` adapter and three wirings, each its own appended block: the rule to E4's local-API routes, `editorCommand` to `board-host` (E5), the Snapshot folder to the writer (E7). `board-host/local-api/routes.ts`: the `rule` handler's body, which E4's comment hands to E8. `board-host/boards.ts`: one appended case in the page-message dispatch and one appended call in the connect sequence.
- **`hooks`**: the `with-references` entry of `PREDICATES` in `src/asking-rules.ts`.
- **View**: `view-protocol.ts` (appended types), `boot-data.ts` (one optional field), `board-page/controller.ts` (appended cases), `board-page/start.ts` (the theme preference), `shell/board-header.tsx` (the right end of row 2), `theme.ts`, `assemble/index.ts` (`lang`); the string conversion touches every file with a literal and is done on what `main` holds when group 7 starts, so it is the widest merge: a change merging later converts its own literals. `packages/view/chunk-sizes.json` is re-recorded after a merge with `bun run build:view --record-sizes`.
- **Widgets**: the widget host's context (one appended field beside `colorScheme`); `shared/number.ts` and `gantt/model/date.ts` delegate to the contract.
- **Build and tests**: `tools/build/tokens.ts` (the comfortable keys); `tools/build/validators.ts` generates the page validators from `BOARD_PROTOCOL_MESSAGES.toPage` with no edit; the two harnesses' environments.

## Risks / Trade-offs

- [A setting that fails its check silently relaxes the asking rule] → The diagnostic and the panel name the file and pointer; the rule falls to the user's or `none`, which only lets AskUserQuestion through and never returns an answer (NFR-10). A1's alternative refuses every ask instead.
- [The string conversion collides with E5's and E7's view edits] → It runs on whatever `main` holds when group 7 starts, the catalogue test makes a later change add both languages, and literals are moved, not reworded.
- [Italian strings ship provisional] → Each is marked "(to review)" in EXPERIENCE (UX draft block 1); a later wording change touches only `it-IT.ts`.
- [Two sessions write the user file at once] → Each write re-reads, so a concurrent write is lost only inside one click's window; the losing board still shows its value until it reconnects.
- [Own formatting misses a locale rule] → Only two locales, written as fixtures against EXPERIENCE's sample and the table above, and run under every time zone and locale AD-13 names.
- [`editor` is visible to a board-token holder] → It is the user's own command line and no secret; the token holder can neither change nor run it beyond the confined click E5 builds.

## Migration Plan

Nothing has been released. A user's hand-written configuration needs `"version": "1.0"`; the documentation's example carries it. Reverting the change returns the sets to their previous minors, the asking rule to `none` and the board to English.

## Handed on

- **The devcontainer change:** the container opt-in, the port range and the host-side address and port as configuration keys (A3).
- **The atoms' epics:** MoneyField, DateField and Value on the contract's formats and entry rules.
- **The sales molecule's epic:** reading `defaultMinimumMargin` and fixing `minimumMargin`'s unit (B14).
- **The skills epic:** the `with-references` description from the contract (A5).
