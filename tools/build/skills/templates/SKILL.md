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

## Language

Set `language` on every `ask` to the user's language: the one the user asked for, else the one your project's instructions give (CLAUDE.md or AGENTS.md, as you have them). AskBoard offers {{languages}}; for another language, or when nothing says, leave it out and AskBoard uses its configured default, else `en-US`. Write your own text in the user's language either way. Set `locale` ({{locales}}) only when the user's formats for money, dates and numbers differ from the language's. `update` changes neither: for another language, close the ask and send a new one in it.

## Items

A question (`question`) is `{type: "question", id, props: {text, header?, options?, multiSelect?, allowOther?, items?}}`. Its `items` hold context, widgets and molecule references (`molecule`), each `{type, id, props}`. Read the reference of a type before you use it:

{{itemIndex}}{{layoutNote}}{{formNote}}

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
