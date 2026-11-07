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

{{askingRules}}

Without AskBoard's hooks a rule is only advisory: nothing stops an AskUserQuestion call, so follow the rule the user set or asked for yourself.

## Keep asks cheap

- Put all the questions you have in one `ask`, never one `ask` per question.
- Point to project files instead of copying them: `path#Heading` or `path#L10-L40`. Save screenshots under `.askboard/media/` and point to them.
- Use a molecule by name for a work breakdown or a plan instead of building it from widgets.
- Never compute totals, estimates, dates or margins: AskBoard derives them and returns them with the answers.
- Choose every ID yourself. An ask ID is a task slug plus a short random suffix, such as `checkout-plan-p8r3`. An item ID is 1 to 64 characters matching `{{idPattern}}`, unique in the ask. Change items later by ID with `update`.
- Send content and data, never markup, colours or layout. A recommended option is only a label: the user still chooses.

## Items

A question (`question`) is `{type: "question", id, props: {text, header?, options?, multiSelect?, allowOther?, items?}}`. Its `items` hold context, widgets and molecule references (`molecule`), each `{type, id, props}`. Read the reference of a type before you use it:

{{itemIndex}}

At the top level an ask's `items` may be areas (`area`) instead of questions: `{type: "area", id, props: {title, items}}`, a titled group of questions. Once one top-level item is an area, every one is.

## After you ask

- With AskBoard's hooks, an ask belongs to the agent that sent it: only that agent can `collect`, `update`, `fetch` or `snapshot` it. A subagent's ask closes when the subagent finishes: an answer given later, such as a postponed one, is lost, and no one can collect or snapshot it.
- Your own asks never block you: ask yourself and keep working. Only for a side dialogue whose answers you need together when it ends, start a background subagent that asks, waits and returns them.
- Keep working after `ask`. The user gets a notice and a link. Never open the board or answer it yourself.
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
