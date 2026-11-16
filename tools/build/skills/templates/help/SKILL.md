---
name: askboard-help
description: Use when the user asks in the terminal how to use the AskBoard board: what a widget does, how to edit it, its keyboard shortcuts, what Send answer, Later, Decline, Send answers or a Snapshot do, or how to change, rebind or remap a key. A question asked as a follow-up on the board is not for this skill.
disallowed-tools: {{disallowedTools}}
---

# AskBoard help

This skill answers a user's questions about using the AskBoard board. The files below hold the facts: read the one that matches the question, then answer from it.

## Rules

- Answer in the user's language, in the terminal, from these files. Do not guess a key or a behaviour they do not give.
- Never call AskBoard's tools (`ask`, `update`, `collect`, `fetch`, `snapshot`) and never open a board to show something: a question about the board is answered in text.
- When the user asks to change a key, follow [configure-keys](references/configure-keys.md): write the `keys` JSON for them. Edit the user configuration file only when the user asks you to, keeping its `version` and every other key. Never write `keys` into the project file `.askboard/config.json`: the board ignores it there.

## The board

- **Send answer.** A question's main button sends its answer. In "One by one" each goes as given and the outbox has no Send. In "All together" the button reads "Confirm" and the answer waits, "Ready, not sent", until the outbox's "Send {count} answers" sends them all. Its switch changes the mode.
- **After answering.** A setting: "Go to the next" (the default) moves on to the next question to do; "Stay here" shows "Continue" on the card.
- **Prefill recommended.** The progress row's button drafts each recommended option; nothing is sent or ready, and "Undo" clears them.
- **Later.** Postpones a question; it can be undone. One left open when the board closes is lost with the ask, and the header warns.
- **Decline and Explain.** Under "More". "Decline" closes the question as declined, with an optional reason in the note; it can be revised or undone. "Explain" asks the agent why it asks and what changes with each option.
- **Follow-up questions.** The user can ask the agent a follow-up under each question; the reply comes in the same thread, and a marker shows one out of view.
- **When the agent changes a question.** With unsent work on it, a notice offers "Keep mine" (the answer is for the earlier version) or "Reload, losing my work" (the agent's version replaces it).
- **Read-only.** An answered question, a closed or discarded ask, a board that moved to another tab and a Snapshot take no edits. {{readOnlyKeys}}
- **Snapshots.** The "Snapshot" button saves an offline, view-only copy of the board; unsent work is not in it. The agent can take one too.
- **Language and live updates.** The board shows the language the agent set; another language means a new ask. The agent can add or change questions while the board is open.
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

{{index}}

The board's own keys, and every action with its default keys: [key-actions](references/key-actions.md). Changing keys: [configure-keys](references/configure-keys.md).
