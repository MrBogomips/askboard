---
name: askboard-backlog
description: The AskBoard backlog procedure on GitHub Issues - labels (type, source, severity, area and the area map), the Issue lifecycle (duplicate search, opening, triage and needs-po questions, the in-change link to an OpenSpec change, Closes and Refs in pull requests, closing by hand) and how an end-to-end test session files its findings. Use it whenever you open, search, label, triage, comment on, link or close an Issue of MrBogomips/askboard, file a defect or a review finding, ask the PO a question, or start a change from an Issue. Not for GitHub work outside this repository.
---

# The AskBoard backlog

The Issues of `MrBogomips/askboard` are the authoritative backlog (AGENTS.md, The backlog). This skill holds the procedure; the rules that always apply (an Issue is self-contained, no board link or token, nothing of the PO's other work) are also in AGENTS.md.

## Labels

Each Issue has one type, one source and one or more areas; a defect also has one severity.

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

**Areas.** An `area:<name>` label names a product function or module the Issue is about. An Issue
takes every area it touches, the specific one rather than the general: a Gantt defect seen in
Firefox is `area:gantt`, not `area:widgets`. GitHub's label list is the authority, and each label's
description says what it covers (`gh label list --limit 200 | grep '^area:'`). The map:

| Group | Areas |
|---|---|
| The board | `area:board`, `area:revisions`, `area:context`, `area:reading-panel`, `area:snapshot`, `area:keyboard`, `area:i18n` |
| Widgets | `area:widgets` (across widgets, or a widget not built yet), `area:form`, `area:gantt`, `area:tree`, `area:timeline`, `area:kanban`, `area:table`, `area:latex`, `area:document-review`, `area:molecules`, `area:compute` |
| The agent's side | `area:mcp-tools`, `area:skills`, `area:session`, `area:hooks-mod` |
| Delivery and process | `area:tests`, `area:ci`, `area:release`, `area:benchmark`, `area:codex`, `area:repo` |

- A defect a test found takes the area of what fails; it adds `area:tests` only when the test itself
  is at fault (a flake, a timing gate, a port another run holds).
- A widget gets an area of its own, named after its folder in `packages/widgets/src/` (for example
  `area:ranking`), with the first Issue about it alone; until then it is `area:widgets`.
- When no area fits, create one rather than stretch another, named after the function or the
  package, in the same colour: `gh label create area:<name> --color BFDADC --description "<what it
  covers>"`. Add it to the map in the change that first uses it, or as a small fix on `main`.
- A change that moves a function to another area relabels the open Issues it moves.

## Lifecycle

Every `gh` command below takes `--repo MrBogomips/askboard`, left out for brevity. Write bodies and
comments to a file outside the repository and pass them with `--body-file`.

**An Issue is self-contained.** It holds, inline, the steps, the expected and the observed behaviour
and the evidence that matters (the error text, the request and the answer, the lines of a report or
a log that show the fault), so anyone can act on it without the machine it was found on. A path on
someone's machine is never the only evidence: quote what the file holds. Images go in as
attachments dragged in on GitHub, or as files on the `issue-assets` branch linked as
`https://github.com/MrBogomips/askboard/raw/issue-assets/<path>` (the Contents API: `gh api
repos/MrBogomips/askboard/contents/<path> -X PUT -f branch=issue-assets -f message=… -f content=<base64>`,
the method of the `github-issues` skill for private repositories), never as local paths. Never put a board link (it carries the token in `?t=`), a token or a session file in an Issue.
The repository is public: an Issue, a comment or an image shows nothing of the PO's other work (a
client, a project, a document, or a screenshot of one); describe the behaviour, or reproduce it on
neutral content.

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
     --label type:defect --label sev:M --label source:e2e --label area:gantt
   ```
   The title states the problem or the want, never the fix; a question starts with "Question:", a
   chore with "Chore:". The body follows the template of its kind in `.github/ISSUE_TEMPLATE/`,
   without its front matter and comments: the Origin first (test ID and commit, review finding and
   change, or the PO's words), References last, with the related Issues. One finding per Issue.
   Pass every label with `--label`, whatever the template says.
2. **Triage.** Check the type, the source, the areas and, for a defect, the severity. A decision only the PO can
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
   its severity, its areas, and the finding ID, the change and the range in its Origin. A change dropped or
   split: comment where the work went; remove `in-change` when nothing is on the Issue any more.
4. **Pull request.** The body says `Closes #n`. When one Issue spans several changes, each pull
   request says `Refs #n` and the last one says `Closes #n`. The PO's merge closes the Issue.
5. **Archive.** The archive pull request says `Refs #n`, never `Closes`, and never reopens the Issue.

An Issue that needs no change is closed by hand with the reason: `gh issue close <n> --duplicate-of
<m>`; `gh issue close <n> --reason "not planned" --comment "<why>"`; or, for a question answered
with nothing to build, `gh issue close <n> --comment "<the decision, and where it is recorded>"`.

## End-to-end test sessions

An end-to-end test session files its own findings: one self-contained Issue per finding, after the
duplicate search, labelled `source:e2e` with its type, its areas (and its severity, for a defect). The Origin
names the test ID and the commit tested; the lines of the report that show the fault are quoted and
its screenshots attached. It sends the coordinating session only the Issue numbers.

