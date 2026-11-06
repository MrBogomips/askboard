# Spine update draft: settings-languages (E8)

Six blocks: five for the proposal's open questions A1 to A6, and the front matter. A block applies only if the PO accepts the choice made there; a question the PO reverses leaves its block unapplied, and the change is revised with `/opsx:update`. Each block quotes the current text exactly, then gives the replacement. ADs are amended in place; none is added or renumbered.

**Accepted, not applied yet.** The PO accepted every block on 2026-11-01 (decisions-5: open questions A1 to A6, as proposed); task 11.1 applies them.

File: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md`. SOLUTION-DESIGN.md needs no change: its §4.4 "Settings (AD-14)" says nothing these blocks contradict.

How to apply: replace each quoted passage, set the spine's `updated:` to the apply date and add a `sources` line for this change in its front matter (block 6), then run `openspec validate --all --strict --no-interactive` and `bun run check`. E5's spine draft also edits the Deferred row (its block 3.2); if it is applied first, block 5 below quotes its replacement instead.

## Block 1: AD-14, reading the files and a file that fails its check (open questions A1 and A2)

### 1.1 Rule, Configuration, the user file

Current:

```text
      - user: `$XDG_CONFIG_HOME/askboard/config.json`, by default `~/.config/askboard/`.
```

Replacement:

```text
      - user: `$XDG_CONFIG_HOME/askboard/config.json`, by default `~/.config/askboard/`. A relative `XDG_CONFIG_HOME` is ignored, as the XDG specification says; without an absolute `HOME` either, no user file is read.
    - Each file names its `version`, `major.minor`, as every document does (AD-7).
```

### 1.2 Rule, Configuration, when the session process reads them

Current:

```text
    - Only the session process reads them, through one `Config` port in `ask-core`: once at start, and the user configuration's presentation keys again whenever it opens a board. It merges them key by key, project keys winning, and changes take effect from the next session, except the board's presentation writes below.
```

Replacement:

```text
    - Only the session process reads them, through one `Config` port in `ask-core`: once at start, and the user configuration's presentation keys again whenever it opens a board. Start is the first time it needs a setting, never before its first request after `server/discover` (AD-2). It merges them key by key, project keys winning, and changes take effect from the next session, except the board's presentation writes below.
```

### 1.3 Rule, Configuration, unknown keys and versions

Current:

```text
    - An unknown key is a warning. A file with an unsupported major version is ignored, with a diagnostic.
```

Replacement:

```text
    - An unknown key is a warning. A file with an unsupported major version is ignored, with a diagnostic, and so is a file that cannot be read, is not JSON or fails the configuration schema: none of its keys applies, never part of them, and the settings panel shows the file as not applied, with the problem. The session process never writes a presentation key into a user configuration that fails its check.
```

## Block 2: AD-14, the project folders at the first ask (open question A4)

Current:

```text
    - At a session's first ask, the session process creates `.askboard/` and any missing subfolder. It writes `.askboard/.gitignore`, listing `snapshots/`, `media/`, `patches/` and `bench/`, only when it creates that file, so a user's choice to commit holds (FR-27).
```

Replacement:

```text
    - At a session's first ask, the session process creates `.askboard/` under the session project root, with `snapshots/`, `media/` and `patches/` when missing; `bench/` is created only by `bench`. It writes `.askboard/.gitignore`, listing `snapshots/`, `media/`, `patches/` and `bench/`, only when it creates that file, so a user's choice to commit holds (FR-27). It creates nothing in another root: an `isolation: worktree` subagent's worktree is removed only while it holds no change (AD-12). A failure is a diagnostic and never refuses the ask.
```

## Block 3: AD-16, what `with-references` sends to AskBoard (open question A5)

Current:

```text
    - Asking rules are a closed set defined in `contract`: `none`, `always`, `with-references`. Each has one predicate over an AskUserQuestion input, implemented once in `hooks`; the skills' texts are generated from `contract` (AD-6).
```

Replacement:

```text
    - Asking rules are a closed set defined in `contract`: `none`, `always`, `with-references`. Each has one predicate over an AskUserQuestion input, implemented once in `hooks`; the skills' texts are generated from `contract` (AD-6).
    - `with-references` sends a call to AskBoard when any question's `question` or `header`, or any option's `label`, `description` or `preview`, holds an `http:` or `https:` URL or a project-file pointer: a relative path ending in a file extension that holds a `/` or is followed by `#` and an anchor or by `:` and a line. `contract` holds both patterns.
```

## Block 4: Consistency Conventions, locale formats (open question A6)

Current:

```text
| Time and identity | RFC 3339 timestamps in UTC. `when` is the time of the user's answer action, stamped by the view; for an answer the agent records, the core's time. `who` is declared: the ask's named user, else the git user name, else the OS login name (FR-19). |
```

Replacement (the row stays; one row follows it):

```text
| Time and identity | RFC 3339 timestamps in UTC. `when` is the time of the user's answer action, stamped by the view; for an answer the agent records, the core's time. `who` is declared: the ask's named user, else the git user name, else the OS login name (FR-19). |
| Locale formats | The en-US and it-IT formats for numbers, money, percentages, dates and times, and number and date entry, are AskBoard's own tables and pure functions in `contract`, used by the view, the board page, the widgets and Snapshots. Nothing formats through `Intl`, `toLocaleString` or the runtime's locale. A calendar date never passes through a time zone; a time shows in the viewer's time zone. Strings live in the view's catalogue, one table per language, and every string exists in both (FR-34). |
```

## Block 5: Deferred, third row (open question A3)

Current (as on `main`):

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the reconnect grace period, the record timeout, where the file path and line sit in the user's `editor` command | AD-5, AD-8, AD-11 and AD-21 fix the rules; the keys are named in the configuration schema | Implementation |
```

Or, if E5's block 3.2 was applied first:

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the reconnect grace period, the record timeout | AD-5, AD-8, AD-11 and AD-21 fix the rules; the keys are named in the configuration schema | Implementation |
```

Replacement (keeps E5's removal of the editor phrase, which this change's schema also settles):

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the reconnect grace period, the record timeout | AD-5, AD-8, AD-11 and AD-21 fix the rules; until then each stays a `contract` constant, and its configuration key joins the schema, as a minor, with the change that needs it | Implementation |
```

## Block 6: the front matter

Current:

```text
updated: '2026-10-31'
```

Replacement (the apply date):

```text
updated: '<apply date>'
```

And after the last `sources` entry, add:

```text
  - 'OpenSpec change settings-languages, proposal.md, open questions A1 to A6: configuration files, the first-ask folders, `with-references` and locale formats (accepted by the PO, 2026-11-01)'
```
