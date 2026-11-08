# AskBoard: rules for coding agents

These rules bind every coding agent (Claude Code, Codex) that works in this repository; `CLAUDE.md`
imports this file. Read `CLAUDE.md` as well: it holds the project overview and status, the design
documents, the invariants every change respects, the stack, the development commands and CI. This
file does not repeat them. Write Issues, comments, commits, pull requests and artifacts in English.

## The backlog: GitHub Issues

The Issues of `MrBogomips/askboard` are the authoritative backlog: the PO's requests, defects, and
the decisions that belong to the PO. Session notes, agent memory, chat transcripts and `drafts/` are
not: an item kept only there is lost to the next session. Hand work between sessions as Issue
numbers, never as lists in a message.

**GitHub tool:** _to be set by the coordinator_. Until it is, agents use the GitHub CLI `gh`, as below.

### Labels

Each Issue has one type and one source; a defect also has one severity.

| Label | Meaning |
|---|---|
| `type:feature` | A capability the PO wants |
| `type:defect` | Behaviour that differs from the specs or the PO's intent |
| `type:question` | A decision that belongs to the PO |
| `type:chore` | Maintenance, cleanup, tooling |
| `sev:H` | High: a wrong or lost answer, security, data loss |
| `sev:M` | Medium: a requirement or scenario not met |
| `sev:L` | Low: wording, records, minor gaps |
| `source:po` | Asked by the PO |
| `source:e2e` | Found in an end-to-end test session |
| `source:review` | Found by a spec or security review, or during a change's work |
| `needs-po` | Waiting for a PO decision |
| `in-change` | An OpenSpec change is working on it |

The severities are the scale of the review findings (S-n, X-n): a finding rated M becomes `sev:M`.
GitHub's default labels and `full-ci` are not backlog labels.

### Lifecycle

Every `gh` command below takes `--repo MrBogomips/askboard`, left out for brevity. Write bodies and
comments to a file outside the repository and pass them with `--body-file`.

**An Issue is self-contained.** It holds, inline, the steps, the expected and the observed behaviour
and the evidence that matters (the error text, the request and the answer, the lines of a report or
a log that show the fault), so anyone can act on it without the machine it was found on. A path on
someone's machine is never the only evidence: quote what the file holds. Images go in as
attachments or as links to files in the repository, never as local paths (`gh` cannot attach a
file). Never put a board link (it carries the token in `?t=`), a token or a session file in an Issue.

1. **Deduplicate, then open.** Search open and closed Issues with two or three wordings (the widget
   or tool name, the symptom, the API name):
   ```sh
   gh issue list --state all --search "<key words> in:title,body"
   ```
   An open match gets what is new as a comment (`gh issue comment <n> --body-file <file>`). A closed
   one that came back gets a new Issue whose Origin says "Regression of #n"; never reopen it.
   Otherwise:
   ```sh
   gh issue create --title "<what is wrong, or what is wanted>" --body-file <file> \
     --label type:defect --label sev:M --label source:e2e
   ```
   The title states the problem or the want, never the fix; a question starts with "Question:", a
   chore with "Chore:". The body follows the template of its kind in `.github/ISSUE_TEMPLATE/`,
   without its front matter and comments: the Origin first (test ID and commit, review finding and
   change, or the PO's words), References last, with the related Issues. One finding per Issue.
   Pass every label with `--label`, whatever the template says.
2. **Triage.** Check the type, the source and, for a defect, the severity. A decision only the PO can
   take gets `needs-po` and one comment: the question, the options with their consequences, and the
   proposed default with its reason. A question separate from any Issue is its own Issue
   (`type:question`, `needs-po`).
   ```sh
   gh issue edit <n> --add-label needs-po
   gh issue comment <n> --body-file <question.md>
   ```
   The PO answers in a comment, then the label comes off (`gh issue edit <n> --remove-label
   needs-po`). A proposed default is not an answer: work that depends on it waits for the PO; an
   unattended run that takes a default records it and leaves the label on.
3. **Change.** The OpenSpec proposal cites `Issue: #n`. Once the change exists, the Issue gets a
   comment naming the change and its branch, and the `in-change` label:
   ```sh
   gh issue comment <n> --body "OpenSpec change \`<id>\`, branch \`<branch>\`."
   gh issue edit <n> --add-label in-change
   ```
   Task notes and commit bodies name the Issue (`Refs #n`). A review finding deferred, or a defect
   found during the work and not fixed in the same change, becomes a new Issue with `source:review`,
   its severity, and the finding ID, the change and the range in its Origin. A change dropped or
   split: comment where the work went; remove `in-change` when nothing is on the Issue any more.
4. **Pull request.** The body says `Closes #n`. When one Issue spans several changes, each pull
   request says `Refs #n` and the last one says `Closes #n`. The PO's merge closes the Issue.
5. **Archive.** The archive pull request says `Refs #n`, never `Closes`, and never reopens the Issue.

An Issue that needs no change is closed by hand with the reason: `gh issue close <n> --duplicate-of
<m>`; `gh issue close <n> --reason "not planned" --comment "<why>"`; or, for a question answered
with nothing to build, `gh issue close <n> --comment "<the decision, and where it is recorded>"`.

### End-to-end test sessions

An end-to-end test session files its own findings: one self-contained Issue per finding, after the
duplicate search, labelled `source:e2e` with its type (and its severity, for a defect). The Origin
names the test ID and the commit tested; the lines of the report that show the fault are quoted and
its screenshots attached. It sends the coordinating session only the Issue numbers.

## OpenSpec

- OpenSpec 1.15.0, schema `spec-driven`. Always run it pinned, as
  `npx --yes @fission-ai/openspec@1.15.0 <command>`, never a global install of another version. CI
  runs `npx --yes @fission-ai/openspec@1.15.0 validate --all --strict --no-interactive`.
- Create, change and archive its artifacts only through its workflow: propose, apply, verify,
  archive, under `openspec/changes/<id>/`; `openspec/specs/` changes only through sync or archive.
  Never hand-edit the generated tooling (`.claude/commands/opsx/`, `.claude/skills/openspec-*`).
- Without the project's OpenSpec commands, follow the same steps with the CLI: `new change <id>`,
  `instructions <artifact> --change <id>` (each artifact's template and the project's rules),
  `status --change <id>`, `validate <id> --strict`, `instructions apply --change <id>`,
  `archive <id>`.
- The project's rules for the artifacts are in `openspec/config.yaml` (`context`, `rules`,
  `operations`), which the workflow reads.
- A proposal cites `Issue: #n` beside the FR, NFR and AD IDs it serves, one line per Issue it
  resolves.
- Archive a change only after its pull request is merged.

## Git and pull requests

- Work on a branch in a worktree based on `origin/main`: one change, one worktree, one branch.
  Location and names are in `CLAUDE.md` (Git / PR Working Policy); without a worktree command of
  your own: `git worktree add .claude/worktrees/feature-<slug> -b worktree-feature-<slug> origin/main`.
- Agents never merge into `main` or push to it: every change goes through a pull request, which the PO merges. The one exception is a small fix (documents, typos, configuration) that the PO commits on `main` or asks to have committed there (CLAUDE.md, Git / PR Working Policy).
- Conventional commits: `<type>(<scope>): <description>`, type `feat`, `fix`, `refactor`, `docs`,
  `test`, `chore`, `perf` or `ci`, the scope optional (a package or a change). A commit body may say
  `Refs #n`; only a pull request body says `Closes #n`.
- Before a pull request, run the checks `CLAUDE.md` lists for what the change touches. The body says
  what changed and why, the checks run and their results, the `Closes` or `Refs` line, and what is
  left for the PO.
- No AI attribution of any kind: no tool, model or vendor named as author, co-author or generator;
  no co-author or session trailers; no links to an assistant's sessions or service; no "generated
  with" notes or badges. This holds for commits, pull requests, Issues, comments, code comments and
  documents.
