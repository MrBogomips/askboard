---
name: askboard
description: Use when you need to ask the user something and AskBoard's tools (ask, update, collect, fetch, snapshot) are available. It says which questions go to AskBoard and which to AskUserQuestion, how to build asks that stay cheap, which item types and molecules a question can hold, how to collect answers, and what to do when no board can be shown.
---

# AskBoard

AskBoard shows your questions on a local web board and returns typed answers while you keep working. Its tools are `ask`, `update`, `collect`, `fetch` and `snapshot`; their descriptions say how to call them. This skill says when to use them and how to keep asks cheap.

## Which tool asks

- Use AskBoard (`ask`) for a question that has references (a project file, an excerpt, an image, a link), needs a widget, has more than four options, or comes with several questions in the same task.
- Use AskUserQuestion for a yes or no or a short choice without references.
- A subagent cannot use AskUserQuestion: it asks every question through AskBoard.
- An asking rule, when one is in effect, overrides these choices. So does an instruction from the user about how to ask.

## Asking rules

The user may set one rule:

- `none`: No question is taken from AskUserQuestion: the agent chooses, question by question, where it goes.
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

## Items

A question (`question`) is `{type: "question", id, props: {text, header?, options?, multiSelect?, allowOther?, items?}}`. Its `items` hold context, widgets and molecule references (`molecule`), each `{type, id, props}`. Read the reference of a type before you use it:

- `excerpt`: a passage of a project file beside the question: a pointer, which AskBoard resolves when the ask is sent, or text you wrote, never both → [context](references/context.md)
- `reference`: a file or a web page the user opens in one click: a pointer or an http or https URL, never both → [context](references/context.md)
- `image`: a screenshot or picture saved as a project file, with the text that describes it → [context](references/context.md)
- a Tree (`tree`): a work breakdown or any hierarchy the user edits: add, move, rename, remove nodes, adjust estimates → [tree](references/widgets/tree.md)
- a Gantt (`gantt`): a schedule the user adjusts: tasks, durations, dependencies, with dates and the critical path computed → [gantt](references/widgets/gantt.md)
- an Approval (`approval`): a decision on its question's content: approve, approve with changes or reject; put it last in the question it approves → [approval](references/widgets/approval.md)
- a Scale (`scale`): a number on a slider (the Slider), a range between two numbers, or a rating of up to 11 values → [scale](references/widgets/scale.md)
- a Ranking (`ranking`): an order of 2 to 50 items the user sets by dragging or with Move up and Move down → [ranking](references/widgets/ranking.md)
- a LaTeX (`latex`): one mathematical expression in LaTeX that the user reads and corrects, with a live preview → [latex](references/widgets/latex.md)
- a Kanban (`kanban`): cards the user moves between 2 to 12 columns, such as statuses, priorities or owners → [kanban](references/widgets/kanban.md)
- a Timeline (`timeline`): milestones and date ranges the user moves in time and across lanes, as in a roadmap → [timeline](references/widgets/timeline.md)
- a Chart (`chart`): a bar, line or pie chart the user reads and may highlight points on → [chart](references/widgets/chart.md)
- a Text (`text`): a passage of plain text or Markdown the user reads; it gives no answer → [text](references/widgets/text.md)
- a Value (`value`): a figure the user reads: a number, percentage, amount, date or duration → [value](references/widgets/value.md)
- a Divider (`divider`): a rule that separates the items of a question; its props are empty → [divider](references/widgets/divider.md)
- a TextField (`text-field`): a short or long free text the user types, such as a name or a comment → [text-field](references/widgets/text-field.md)
- a NumberField (`number-field`): a number the user types, with optional bounds, a step and a unit → [number-field](references/widgets/number-field.md)
- a MoneyField (`money-field`): an amount of money the user types, in one currency or one picked from a list → [money-field](references/widgets/money-field.md)
- a DateField (`date-field`): a calendar day the user types or picks, optionally within a range → [date-field](references/widgets/date-field.md)
- a Toggle (`toggle`): an on or off choice the user sets, such as a switch or a yes or no → [toggle](references/widgets/toggle.md)
- a Stack (`stack`): items one under another in a column, as one block of a question → [stack](references/widgets/stack.md)
- a Row (`row`): 2 to 4 items side by side; a narrow board stacks them → [row](references/widgets/row.md)
- a Group (`group`): a titled box around related items, read as one group → [group](references/widgets/group.md)
- `gantt-plan`: a schedule over a work breakdown of the same question: the user adjusts durations and dependencies, with dates and the critical path computed → [gantt-plan](references/molecules/gantt-plan.md)
- `wbs-pert`: a work breakdown with three-point estimates that the user reviews and edits, with expected effort and spread computed per package and rolled up → [wbs-pert](references/molecules/wbs-pert.md)

A question's `items` may sit in layouts (`stack`, `row`, `group`) that hold atoms, widgets and other layouts, four deep at most; context items and molecule references stay in the question's own `items`. Item IDs are unique at every depth.

At the top level an ask's `items` may be areas (`area`) instead of questions: `{type: "area", id, props: {title, items}}`, a titled group of questions. Once one top-level item is an area, every one is.

## After you ask

- With AskBoard's hooks, an ask belongs to the agent that sent it: only that agent can `collect`, `update`, `fetch` or `snapshot` it. A subagent's ask closes when the subagent finishes: an answer given later, such as a postponed one, is lost, and no one can collect or snapshot it.
- Ask from the agent that needs the answers. Your own asks never block you: keep working while the user answers. Never hand your questions to a subagent to ask for you: its ask closes when it finishes, and later answers are lost.
- After `ask`, the user gets a notice and a link. Never open the board or answer it yourself.
- Answers reach you by push, or call `collect` with the latest cursor you received for each ask. Call it before you finish. Never build a cursor.
- An event whose `seq` (the number after the dot in its cursor) you have already seen is a repeat: ignore it.
- Reply to a follow-up at once with `update` (`reply`): the user is waiting.
- When the user answers a postponed question in the terminal, record it with `update` (`answer`).
- Do not ask a declined question again in this task.
- A `discarded` ask lost its unsent answers: ask again under a new ID if you still need them.
- How to read answers, `fetch` and Snapshots: [answers](references/answers.md).

## When an ask cannot go on

When `ask` returns `unavailable`, or AskBoard's tools are absent:

- main conversation: ask through AskUserQuestion.
- subagent: end your turn and return the question to the agent that started you.
