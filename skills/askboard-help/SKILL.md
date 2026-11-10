---
name: askboard-help
description: Use when the user asks in the terminal how to use the AskBoard board: what a widget does, how to edit it, which keys it takes, what Answer, Postpone, Decline, Submit or a Snapshot do, or how to change a key. A question asked as a follow-up on the board is not for this skill. It never asks anything on a board.
disallowed-tools: mcp__plugin_askboard_askboard__ask mcp__plugin_askboard_askboard__update mcp__plugin_askboard_askboard__collect mcp__plugin_askboard_askboard__fetch mcp__plugin_askboard_askboard__snapshot
---

# AskBoard help

This skill answers a user's questions about using the AskBoard board. The files below hold the facts: read the one that matches the question, then answer from it.

## Rules

- Answer in the user's language, in the terminal, from these files. Do not guess a key or a behaviour they do not give.
- Never call AskBoard's tools (`ask`, `update`, `collect`, `fetch`, `snapshot`) and never open a board to show something: a question about the board is answered in text.
- When the user asks to change a key, follow [configure-keys](references/configure-keys.md): write the `keys` JSON for them. Edit the user configuration file only when the user asks you to, keeping its `version` and every other key. Never write `keys` into the project file `.askboard/config.json`: the board ignores it there.

## The board

- **Answer.** Each question has its own "Answer" button; it sends that question's answer. In submitted delivery the answers wait, and "Submit" in the bottom bar sends them all at once; in immediate delivery each goes as it is given. A bar switch changes the mode.
- **Postpone.** Marks a question as not answered yet; it can be undone. A postponed question left open when the board closes is lost with the ask, and the bottom bar warns of it.
- **Decline and Explain.** Under "More" on each question. "Decline" closes the question as declined, with an optional reason in the note; it can be revised or undone. "Explain" sends the agent the ready-made follow-up "Why are you asking, and what changes with each option?".
- **Follow-up questions.** Under each question, the user can ask the agent a follow-up; the agent's reply arrives in the same thread, and a marker shows a reply that came while the question was out of view.
- **When the agent changes a question.** If the agent updates a question where the user has unsent work, a notice says so and offers "Keep mine" (the user's work stays, and the answer is sent for the earlier version) or "Reload, losing my work" (the agent's version replaces it).
- **Read-only.** An answered question, a closed or discarded ask, a board that moved to another tab and a Snapshot do not take edits. Only the keys that move around, and those that open the keys panel of a widget that has one, still act there.
- **Snapshots.** The "Snapshot" button saves an offline, view-only copy of the board to a file; unsent work is not in it. The agent can take one too.
- **Language and live updates.** The board shows the language the agent set for the ask; it offers no switch, and another language means a new ask. The agent can add or change questions while the board is open, and the board shows them at once.
- **Note for the agent.** Every question has an optional free-text note.

## Keys of the options and fields

- A single choice is a radio group: Arrow keys move the focus among the options without choosing, Space or Enter chooses the focused one, Home and End go to the first and the last. Tab leaves the group.
- A multiple choice (a question's options): Arrow keys, Home and End move the focus, Space or Enter ticks or clears the focused option.
- A multiple pick field (a form field): one Tab stop per box, so Tab moves among the boxes and Space ticks or clears the focused one.
- A toggle: Space or Enter switches it. A check box: Space only.
- The date field's calendar (react-day-picker): ← and → move by a day, ↑ and ↓ by a week, Shift with ← and → by a month, Shift with ↑ and ↓ by a year, Home and End to the start and end of the week, Page Up and Page Down by a month (Shift: a year), Enter or Space picks the day.
- Menus and other controls take their usual keys: arrows to move, Enter or Space to choose, Escape to close.

A widget with a Keys button shows the keys in effect in its keys panel (the button, or `?`), which the user may have changed; a widget's reference below says whether the board shows one for it, and lists its default keys either way.

## References

Each reference says what a type is for, how to edit it with the mouse, what the agent receives and, where it has them, the keys.

- Widgets: [`tree`](references/widgets/tree.md), [`gantt`](references/widgets/gantt.md), [`approval`](references/widgets/approval.md), [`scale`](references/widgets/scale.md), [`ranking`](references/widgets/ranking.md), [`latex`](references/widgets/latex.md), [`kanban`](references/widgets/kanban.md), [`timeline`](references/widgets/timeline.md), [`chart`](references/widgets/chart.md), [`text`](references/widgets/text.md), [`value`](references/widgets/value.md), [`divider`](references/widgets/divider.md), [`text-field`](references/widgets/text-field.md), [`number-field`](references/widgets/number-field.md), [`money-field`](references/widgets/money-field.md), [`date-field`](references/widgets/date-field.md), [`toggle`](references/widgets/toggle.md), [`stack`](references/widgets/stack.md), [`row`](references/widgets/row.md), [`group`](references/widgets/group.md), [`tabs`](references/widgets/tabs.md), [`pick-field`](references/widgets/pick-field.md), [`table`](references/widgets/table.md), [`document-review`](references/widgets/document-review.md)
- Molecules: [`gantt-plan`](references/molecules/gantt-plan.md), [`wbs-pert`](references/molecules/wbs-pert.md)

Changing keys: [configure-keys](references/configure-keys.md). Every action a key can be given and its default keys: [key-actions](references/key-actions.md).
