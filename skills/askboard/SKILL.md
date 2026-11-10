---
name: askboard
description: Use to ask the user something complex on a visual, interactive board: many interdependent decisions, choices that cite documents by bare IDs (D-01, FR-12, ADR-7), or content better seen and worked on, such as a plan, a WBS, a schedule, UML or a state machine, a formula, or a document to review. Load it before you ask the user to decide or review something complex, in chat or with AskUserQuestion, and when the user asks for AskBoard. A simple, self-explanatory choice stays in AskUserQuestion.
---

# AskBoard

AskBoard shows your questions on a local web board and returns typed answers while you keep working. Its tools are `ask`, `update`, `collect`, `fetch` and `snapshot`; their descriptions say how to call them. This skill says when to use them and how to keep asks cheap.

## Which tool asks

AskBoard sits beside AskUserQuestion. Choose by how hard the question is to grasp and to answer, not by how many questions or options it has.

- Use AskBoard (`ask`) when seeing the question and working on it helps the user decide: many questions that depend on one another; questions that cite documents by bare IDs (D-01, FR-12, ADR-7), which the user would have to look up; content that reads better as a visual artifact, such as a plan, a WBS or a Gantt, a chart, a table, a UML diagram or a state machine, a formula, or a document to review.
- These cases are examples, not a list: judge whether a visual, interactive board helps. On the board the user sees the context beside the question, works on it and asks you follow-ups while you keep working.
- Use AskUserQuestion for a simple, self-explanatory choice, such as a yes or no.
- Never put a complex question to the user in chat prose: ask it on the board.
- A subagent cannot use AskUserQuestion: it asks every question through AskBoard.
- An asking rule, when one is in effect, overrides these choices. So does an instruction from the user about how to ask.

## Asking rules

The user may set one rule:

- `none`: No question is taken from AskUserQuestion: the agent chooses where each question goes, by how complex it is to grasp.
- `always`: Every question goes to AskBoard, whatever it holds.
- `with-references`: An AskUserQuestion call goes to AskBoard when a question, header, option label, description or preview holds an http: or https: URL, or a project-file pointer: a relative path ending in a file extension that holds a / (src/retry.ts) or is followed by # and an anchor (README.md#Install) or by : and a line (app.py:12).

Without AskBoard's hooks a rule is only advisory: nothing stops an AskUserQuestion call, so follow the rule the user set or asked for yourself.

## Keep asks cheap

- Put all the questions you have in one `ask`, never one `ask` per question.
- Point to project files instead of copying them: `path#Heading` or `path#L10-L40`. Save screenshots under `.askboard/media/` and point to them.
- Use a molecule by name for a work breakdown or a plan instead of building it from widgets.
- Never compute totals, estimates, dates or margins: AskBoard derives them and returns them with the answers.
- Choose every ID yourself. An ask ID is a task slug plus a short random suffix, such as `checkout-plan-p8r3`. An item ID is 1 to 64 characters matching `[A-Za-z0-9_-]{1,64}`, unique in the ask. Change items later by ID with `update`.
- Send content and data, never markup, colours or layout. A recommended option is only a label: the user still chooses.

## Language

Set `language` on every `ask` to the user's language: the one the user asked for, else the one your project's instructions give (CLAUDE.md or AGENTS.md, as you have them). AskBoard offers `en-US` and `it-IT`; for another language, or when nothing says, leave it out and AskBoard uses its configured default, else `en-US`. Write your own text in the user's language either way. Set `locale` (`en-US` and `it-IT`) only when the user's formats for money, dates and numbers differ from the language's. `update` changes neither: for another language, close the ask and send a new one in it.

## Items

A question (`question`) is `{type: "question", id, props: {text, header?, options?, multiSelect?, allowOther?, items?}}`. Its `items` hold context, widgets and molecule references (`molecule`), each `{type, id, props}`. Read the reference of a type before you use it:

- What each type is for, the types by what the user has to do, and a complete ask: [items](references/items.md)
- Context items, in [context](references/context.md): `excerpt`, `reference`, `image`
- Widgets: [`tree`](references/widgets/tree.md), [`gantt`](references/widgets/gantt.md), [`approval`](references/widgets/approval.md), [`scale`](references/widgets/scale.md), [`ranking`](references/widgets/ranking.md), [`latex`](references/widgets/latex.md), [`kanban`](references/widgets/kanban.md), [`timeline`](references/widgets/timeline.md), [`chart`](references/widgets/chart.md), [`text`](references/widgets/text.md), [`value`](references/widgets/value.md), [`divider`](references/widgets/divider.md), [`text-field`](references/widgets/text-field.md), [`number-field`](references/widgets/number-field.md), [`money-field`](references/widgets/money-field.md), [`date-field`](references/widgets/date-field.md), [`toggle`](references/widgets/toggle.md), [`stack`](references/widgets/stack.md), [`row`](references/widgets/row.md), [`group`](references/widgets/group.md), [`tabs`](references/widgets/tabs.md), [`pick-field`](references/widgets/pick-field.md), [`table`](references/widgets/table.md), [`document-review`](references/widgets/document-review.md)
- Molecules: [`gantt-plan`](references/molecules/gantt-plan.md), [`wbs-pert`](references/molecules/wbs-pert.md)

A question's `items` may sit in layouts (`stack`, `row`, `group`, `tabs`) that hold atoms, widgets and other layouts, four deep at most; context items and molecule references stay in the question's own `items`. Item IDs are unique at every depth.

For a form, put fields in the question, a Group per section; a `required` field must be filled.

At the top level an ask's `items` may be areas (`area`) instead of questions: `{type: "area", id, props: {title, items}}`, a titled group of questions. Once one top-level item is an area, every one is.

## After you ask

- With AskBoard's hooks, an ask belongs to the agent that sent it: only that agent can `collect`, `update`, `fetch` or `snapshot` it. A subagent's ask closes when the subagent finishes: an answer given later, such as a postponed one, is lost, and no one can collect or snapshot it.
- Ask from the agent that needs the answers. Your own asks never block you: keep working while the user answers. Never hand your questions to a subagent to ask for you: its ask closes when it finishes, and later answers are lost.
- After `ask`, the user gets a notice and a link. Never open the board or answer it yourself.
- Answers reach you by push, or call `collect` with the latest cursor you received for each ask. Call it before you finish. Never build a cursor.
- An event whose `seq` (the number after the dot in its cursor) you have already seen is a repeat: ignore it.
- Reply to a follow-up at once with `update` (`reply`, naming the question in `itemId` and the follow-up's cursor in `followUp`): the user is waiting.
- How to change an ask: add, change, reply and the rest: [updates](references/updates.md).
- When the user answers a postponed question in the terminal, record it with `update` (`answer`).
- Do not ask a declined question again in this task.
- A `discarded` ask lost its unsent answers: ask again under a new ID if you still need them.
- How to read answers, `fetch` and Snapshots: [answers](references/answers.md).
- When the user asks in the terminal how to use the board, a widget or its keys, use the `askboard-help` skill; never put the question in an ask.
- A usage question asked as a follow-up on the board is not for `askboard-help`: reply at once with `update`, without loading `askboard-help`, from the Keys section of the widget's reference in this skill, or from the files in `skills/askboard-help/references/` beside this skill's folder, read as files.

## When an ask cannot go on

When `ask` returns `unavailable`, or AskBoard's tools are absent:

- main conversation: ask through AskUserQuestion.
- subagent: end your turn and return the question to the agent that started you.
