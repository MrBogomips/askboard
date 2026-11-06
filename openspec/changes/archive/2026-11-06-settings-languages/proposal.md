# Proposal

## Why

AskBoard reads no configuration and speaks only English. E1 refuses an `it-IT` ask (its open question 7 sent the configuration schema to E8), and every epic since has parked a setting with an interim default until E8: E4's asking rule is always `none`, E5's "Open in editor" has no command and every board starts with its context beside the question, E7 writes Snapshots only into the default folder, and the Tree and the Gantt read numbers and dates in en-US only. E8, configuration and languages (PRD §4.10), gives the board its Italian interface and formats (FR-34) and its settings panel (FR-35), reads the two configuration files once per session through one `Config` port (AD-14), and closes every one of those defaults in one place (design, "Until E8"). A project file can be written by an agent, so configuration is a security surface: the board writes only three presentation keys, a project file never supplies a command, and a file that fails its check is never half-applied (AD-8, AD-14, NFR-10).

## What Changes

- **`contract`**, appended blocks only (design decision 2):
  - the `configuration` schema set at `1.0`, owned by `ask-core` (AD-7): `version`; the presentation keys `theme`, `density`, `contextPlacement`; the behaviour keys `defaultLanguage`, `askingRule`, `snapshotFolder`, `editor` (an argument vector with `{file}` and `{line}`, as E5's A4 drafts it); the molecule default `defaultMinimumMargin` (AD-14);
  - `language` and `locale` accept `en-US` and `it-IT` in the input format, and the board document names the ask's resolved language and locale, each at its next minor;
  - two board-protocol messages, `settings` (host to page) and `setting` (page to host, the three presentation keys only), by E3's four appended steps;
  - the locale formats: AskBoard's own en-US and it-IT tables and pure functions for numbers, money, percentages, dates and times, with number and date entry and their ambiguity rules, never `Intl` or the browser's number input (AD-7, AD-13).
- **`ask-core`**: the `Config` port, which reads the two files' text and replaces the user file; parsing, validation, the key-by-key merge with project keys winning, `editor` from the user file only, `snapshotFolder` kept inside the project, the presentation keys read again when a board opens, the write rules, the ask's language resolved at creation (ask, then `defaultLanguage`, then `en-US`) and `.askboard/` created at the session's first ask (AD-12, AD-14).
- **Session process**: the file adapter beside `identity.ts` (the XDG path, atomic replacement, file modes, symlinks), wired to E4's `/v1/rule`, E5's editor command and E7's Snapshot folder.
- **`board-host`**: the effective settings sent to a board at connect; a presentation write accepted only for the three keys and their schema values, refused otherwise; the local API reports the configured asking rule.
- **`hooks`**: the `with-references` predicate, which E4 left throwing (AD-16).
- **`view`**: a string catalogue in en-US and it-IT used by the view and the board page, with the document's `lang`; values shown and typed in the ask's locale; the settings panel on the board page with its three groups (DESIGN, Settings panel); the header's quick toggles; the theme preference (System, Light, Dark); the comfortable density; the context-placement default; the Language indicator (EXPERIENCE, Localization; Preferences and Settings).
- **`widgets`**: the Tree's number columns and the Gantt's dates read and show the ask's locale, through the contract's formats (tree-widget open question 7, gantt-widget open question 16).
- **Tests**, each written first: the schema, the merge and the refusals; attacks on the write path (a project `editor`, a fourth key, an invalid value, a symlink, an invalid user file); locale fixtures under extreme time zones and `de-DE`; browser scenarios in Chromium, Firefox and WebKit; one end-to-end scenario on the real session process; a security review.
- **Documents**: `spine-update-draft.md` (AD-14, AD-16, the Consistency Conventions, the Deferred table) and `ux-update-draft.md` (EXPERIENCE: Voice and Tone's Italian column, Localization, Input atoms, Read-only setting, Preferences and Settings, State Patterns, Open Items 4 and 20; DESIGN: Settings panel, Language indicator, Open Items 5). Each block applies only after the PO's answer to its question. No PRD change.
- **Not in this change** (each an open question below): the operations keys (port range, container opt-in, host-side address, grace period, record timeout; A3); languages beyond en-US and it-IT, a translation pipeline, right-to-left text and any language switch on the board (FR-34 rules the switch out); the notifier's, the terminal's and the hooks' texts (B13).

## Capabilities

### New Capabilities

None: configuration belongs to `contract` and `core` (SOLUTION-DESIGN §3.1, AD-14), languages to `contract` and `view-and-widgets`.

### Modified Capabilities

- `contract`: the configuration schema set; `language` and `locale` in the input format and the board document; the `settings` and `setting` board-protocol messages; the locale formats and the number and date entry rules.
- `core`: the two files, reading on first use, the merge, failing closed on an invalid file, `editor` from the user file only, the Snapshot folder kept inside the project, presentation reads and writes, the ask's language, `.askboard/` at the first ask.
- `board-host`: settings at connect, the presentation write and its refusals, the configured asking rule in the local API, the configured editor command.
- `hooks`: the `with-references` predicate.
- `view-and-widgets`: the interface in the ask's language, values in its locale, number and date entry in it-IT, the settings panel, the quick toggles, theme, density and the context-placement default.

The deltas add to requirements that E1, `ask-lifecycle` (E3), `push-delivery` (E4) and, where they have merged, `excerpts` (E5), `snapshot` (E7), `tree-widget` and `gantt-widget` hold, so this change is archived only after those.

## Impact

- **Depends on, before apply** (task group 0): E3 and E4 merged to `main`; the branch rebases and group 0 checks every name it borrows, stopping for `/opsx:update` if one differs. It reads E5, E7, `tree-widget`, `gantt-widget`, `molecules` and `widget-answers`; design decision 1 says which tasks need which of them and how each works if E8 lands first.
- **Code:** `packages/contract`, `packages/core`, `packages/server` (the entry point, `board-host`), `packages/hooks`, `packages/view`, `packages/widgets`, `tools/build/` (the comfortable tokens), `packages/view/chunk-sizes.json`; tests under `packages/*/test/`, `packages/view/test/browser/` and `packages/server/test/conformance/`. Every addition to a file another change edits is an appended block (design, Merge points).
- **Dependencies:** none added. No i18n library, no `Intl` formatting.
- **CI:** no new job; the e2e job grows by the settings and language scenarios, and the locale fixtures run under the time zones and locales AD-13 names.
- **Requirements served:** FR-34, FR-35; FR-9's editor end to end with E5; FR-13's board-wide placement; FR-27's configured folder with E7; FR-30's asking rules with E4; NFR-1 (`language` stays optional), NFR-3 and NFR-4 (no new listener; the write rides the board token), NFR-5, NFR-9 (nothing leaves the machine), NFR-10 (no half-applied file), NFR-12 (the panel and toggles work from the keyboard).

## Open questions for the PO

The PO is away and asked every session to keep working. Each question records the narrowest choice that still meets FR-34 and FR-35, which the change proceeds with, and why. An answer that reverses one stops the work at task 0.3 for `/opsx:update`. The PO answered on 2026-11-01 (decisions-5) and accepted every open question as proposed.

### A. The PRD, the ADs and the UX documents

1. **A configuration file that fails its check** (AD-14, NFR-10). AD-14 ignores a file with an unsupported major version and warns on an unknown key, and says nothing of a file that is not JSON or holds a wrong value. *Default:* such a file is not applied at all, never in part: no key of it counts, so the other file and the defaults apply. The session process writes a diagnostic to stderr naming the file, the JSON pointer and the problem, and every board's settings panel shows the file as not applied with that message. The board never writes into a user file that fails its check: the write is refused, naming the file, so a hand edit is never overwritten. This is AD-14's rule for an unsupported major, extended (spine draft block 1). *Alternative:* refuse every ask until the file is fixed; or add a typed warning to every `ask` result.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
2. **When and how the files are read** (AD-14, AD-2). *Default:* each file names its `version` (`major.minor`), required as AD-7 asks of every document. The user file is `$XDG_CONFIG_HOME/askboard/config.json` when that variable is set to an absolute path, else `$HOME/.config/askboard/config.json`; a relative `XDG_CONFIG_HOME` is ignored, as the XDG specification says, and without `HOME` no user file is read. The project file is read only under the real path of `CLAUDE_PROJECT_DIR` (AD-12). Both are read once, the first time the session process needs a setting, never before its first request, so the probe sibling reads nothing (AD-2); that read is the session's "start" (spine draft block 1). *Alternative:* `version` optional, read as `1.0`.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
3. **The operations keys stay out** (spine Deferred, third row: "the keys are named in the configuration schema"; AD-11's configurable port range; NFR-3's opt-in; E1 open question 6; E3 open question 4). *Default:* E8 names only AD-14's keys. The port range, the container opt-in, the host-side address and port, the grace period and the record timeout stay `contract` constants; each key joins the schema, as a minor, with the change that needs it, and devcontainers keep returning `unavailable` until that change (spine draft block 5). *Alternative:* name them all now, unread.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
4. **`.askboard/` at the first ask** (AD-14, Project folders; E5's and E7's hand-over). *Default:* when a session's first ask is accepted, the session process creates, under the session project root only, `.askboard/` with `snapshots/`, `media/` and `patches/` when missing, and `.askboard/.gitignore` with AD-14's four lines only when it creates that file. It creates no `bench/` (the benchmark writes its own, with its own `.gitignore`), nothing in a subagent's worktree (Claude Code removes an unchanged worktree, and an `.askboard/` there would keep it), and nothing without `CLAUDE_PROJECT_DIR`. A failure is a diagnostic and never refuses the ask (spine draft block 2). *Alternative:* also in each ask's root.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
5. **What `with-references` sends to AskBoard** (FR-30, AD-16; E4 open question 1). Nothing defines the predicate. *Default:* an AskUserQuestion call goes to AskBoard when any of its questions' `question` or `header`, or any option's `label`, `description` or `preview`, holds an `http:` or `https:` URL or a project-file pointer as the Consistency Conventions write it: a relative path ending in a file extension that holds a `/` or is followed by `#` and an anchor or by `:` and a line, so `src/retry.ts`, `README.md#Install` and `app.py:12` count and "Node.js" does not. The patterns live in `contract`, so the skills describe the rule the hook applies (spine draft block 3). *Alternative:* URLs only.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
6. **Locale formats are AskBoard's own code in `contract`** (AD-7, AD-13, Consistency Conventions). *Default:* the en-US and it-IT formats are tables and pure functions in `contract`, used by the view, the board page, the widgets and Snapshots, and nothing formats through `Intl`, `toLocaleString` or the runtime's locale. `Intl`'s output differs across engines and ICU versions (spaces, the euro's place), which would break AD-13's determinism runs, and `contract` is the one place AD-1 lets both `view` and `widgets` import (spine draft block 4). *Alternative:* `Intl` with pinned options, in `view`.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
7. **The it-IT formats** (EXPERIENCE, Localization: "€ 12.480,00 · 27/10/2026 · margine 18,5% · 1.240 h"). *Default:* numbers `1.234,5`; money with the symbol first and a space, `€ 12.480,00`, as EXPERIENCE's sample writes it (CLDR puts it last); dates `27/10/2026` with two-digit day and month; long dates `mer 28 ott 2026`; times on 24 hours, `16:12`; percentages `18,5%`. en-US keeps `1,234.5`, `€12,480.00`, `10/27/2026`, `Wed, Oct 28, 2026`, `4:12 PM` and `18.5%`. Times show in the viewer's time zone; calendar dates never pass through a time zone (UX draft block 3). *Alternative:* CLDR's patterns.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
8. **it-IT number and date entry** (EXPERIENCE, Input atoms: "input that is ambiguous in that locale is refused"). *Default:* the mirror of the Tree's en-US rules: `,` is the one decimal mark and `.` stands only between groups of three digits, so `1.234,5` is 1234.5, `1.234` is 1234 and `1234.5` or `1.23` is refused with a reason in Italian; the echo writes the value without grouping, `= 1234,5`. Dates are `G/M/AAAA` or `AAAA-MM-GG`, echoed as `= mer 28 ott 2026` (UX draft block 4). *Alternative:* refuse a grouped entry with no decimal part, `1.234`, as ambiguous.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
9. **The Italian strings** (EXPERIENCE, Voice and Tone; Open Items 4). Every Italian string but one is missing. *Default:* E8 writes the Italian column for every row, and for the strings E3, E5 and E7 add, all marked "(to review)", and ships them; a test fails when a string exists in one language only, so a later change adds both (UX draft blocks 1, 2 and 8). *Alternative:* none: FR-34 ships it-IT in the first release.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
10. **What the settings panel shows** (FR-35; EXPERIENCE, Read-only setting, Preferences and Settings, Open Items 20; DESIGN, Settings panel, Language indicator). *Default:* each row shows the value in effect and, under it, the file and key that set it. A key set in neither file shows its default, marked as such, with the user file and key to set it. When both files set a key, the row adds the other file's value as not used, so both levels show. A presentation key set in the project file shows read-only, and its header toggle is disabled with the file and key as its description. The asking rule's and the Snapshot folder's rows name their keys, which AD-14 now gives. The Language indicator adds the formats when they differ from the language ("English (en-US) · formats it-IT"). A file not applied, an unknown key, a project `editor` ignored and a Snapshot folder replaced each show on the row or file they concern (UX draft blocks 5 to 9). *Alternative:* the value in effect only.
    - **Answer (PO, 2026-11-01):** accepted as proposed.

### B. Implementation choices

1. **The port's shape.** *Default:* `Config` in `ask-core` reads the two files' text, replaces the user file through a pure transform that `ask-core` supplies, and creates the project folders; parsing, validation, merging and every rule stay in `ask-core`, with no Node API. The adapter lives beside `identity.ts` in the session process (AD-1's entry-point files) and does only file I/O. `CorePorts` gains it as an optional member, as E4 added its ports, and without it every key takes its default. *Alternative:* the adapter in `board-host`.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
2. **Unknown keys.** *Default:* the schema leaves the root open and the reader warns on a key outside the contract's list, so a session on an older minor reads a newer file (AD-14, "Sessions on mixed versions"). Every known key's value is closed.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
3. **The atomic write.** *Default:* re-read the user file, refuse if it fails its check, change only that key and keep every other key, unknown ones included, in their order; write a temporary file in the same folder, `fsync` it, rename it over the file. A symlinked file is written through to its target, so a dotfiles link survives. A missing folder is created `0700` and a new file `0600`. No lock: the window between re-read and rename is a click's.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
4. **A user file others can write.** *Default:* an `editor` from a user file, or a folder, that another user can write, or that the user does not own, is ignored with a warning, as SSH treats its keys; the other keys still apply.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
5. **Board-protocol messages.** *Default:* `settings {keys, files, warnings, write?}` to the page at connect, before `board`, and after every write, each key with its value, the file it came from and whether the board may write it; `setting {key, value}` to the host, whose schema admits only the three keys and their values, so any other write is refused as a `message` before it reaches the session process, which checks again. The board protocol takes its next minor at merge.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
6. **View messages.** *Default:* `askboard.view.setting {key, value}` from the quick toggles, `askboard.view.open-settings`, a `presentation` view update, and an optional `presentation` in the boot data so the view's first render has it; on close, the board page asks the view to focus "Settings".
   - **Answer (PO, 2026-11-01):** accepted as proposed.
7. **The board document.** *Default:* `language` and `locale` at its root, always written by `ask-core`; an absent pair reads as en-US, so an older Snapshot still opens.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
8. **The input format.** *Default:* `language` and `locale` move from `const` to an `enum` of the two, at the next minor; another value is refused, naming the field, as E1 does now.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
9. **The string catalogue.** *Default:* typed keys in `packages/view/src/strings/`, one table per language, plural forms `one` and `other`, named slots filled as text only, used by the view and the board page. Widgets take the language and locale from the widget host's context, as the Tree takes `colorScheme`, and the formats from `contract`.
   - **Answer (PO, 2026-11-01):** accepted as proposed.
10. **Applying a write.** *Default:* the board page applies the change at once and sends it; if the write fails, the change stays on that board and the panel shows the error with the path. Other open boards keep their settings until they reload or reconnect.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
11. **The panel's build.** *Default:* DOM on the board page, with the segmented controls as WAI-ARIA radio groups (arrow keys, Home, End). The side sheet is shared with E5's reading panel: whichever change lands first builds it, and one sheet shows at a time.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
12. **Density.** *Default:* a `comfortable` class on the view's and the board page's roots re-points the spacing and type variables, as `.dark` does for colours; the token build stops dropping the `-comfortable` keys, and `chunk-sizes.json` is re-recorded.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
13. **Text outside the board.** *Default:* the invalid-link pages, the notifier's notification, the terminal link's text, the hooks' messages and the mod's toast stay in English: they name no ask whose language is known, or speak to the agent. Before the first `board` message arrives, the board page's banners are in English.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
14. **`defaultMinimumMargin`.** The unit of `minimumMargin` is not fixed yet (model contract finding F8). *Default:* a number from 0 to 100, a percentage, merged like the other keys, not shown in the panel, read by the sales molecule's epic. *Alternative:* left out until that epic.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
15. **The Snapshot folder's check.** *Default:* `ask-core` accepts a relative path with no `~`, no backslash, and no `..` that leaves the project once normalised; anything else is replaced by `.askboard/snapshots/` with a warning (AD-14). The real-path check at write time stays with E7's writer, which refuses a folder outside the project.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
16. **Isolated tests.** *Default:* the browser harness and the conformance runner give the session process a temporary `HOME` and `XDG_CONFIG_HOME`, so a developer's own configuration never reaches a test, and the conformance check that `HOME` stays empty at `server/discover` keeps holding.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
17. **CI runs.** *Default:* the contract's and the view's locale fixtures run under `TZ=Pacific/Kiritimati` and `TZ=America/Adak` and the locales `en-US` and `de-DE`, as `compute`'s determinism test does (AD-13); the browser scenarios set Playwright's `locale` and `timezoneId` the same way. No new job.
    - **Answer (PO, 2026-11-01):** accepted as proposed.
