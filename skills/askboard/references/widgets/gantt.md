# Gantt

Use for a schedule the user adjusts: tasks, durations, dependencies, with dates and the critical path computed.
Item type `gantt`: props are a Gantt's props {start, tasks, workPackages?}.

## Fields

- `start` (required, string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `workPackages` (string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `tasks` (required, one of: `ownTasks` (at most 500 items); `planTasks` (at most 500 entries))
- `tasks[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `tasks[].label` (required, string, 1 to 200 characters)
- `tasks[].duration` (required, whole number, 1 to 2000)
- `tasks[].start` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `tasks[].dependencies` (list of string, matching `^[A-Za-z0-9_-]{1,64}$`, at most 50 items, each once): A task's finish-to-start predecessors, by task ID, each listed once.
- `tasks.<key>` (object)
- `tasks.<key>.duration` (whole number, 1 to 2000)
- `tasks.<key>.start` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `tasks.<key>.dependencies` (list of string, matching `^[A-Za-z0-9_-]{1,64}$`, at most 50 items, each once): A task's finish-to-start predecessors, by task ID, each listed once.

## Notes

- Without `workPackages`, `tasks` is a list of tasks, each with its label and duration. With `workPackages`, the ID of a Tree item in the same question whose leaves are the tasks, `tasks` maps a leaf ID to its requested `duration`, `start` or `dependencies`.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.
- Derived: `derived` carries the plan's finish and criticalPath, by address, none in an answer naming an earlier revision (see answers); never compute them.

## Keys

These are the default keys. The board's keys panel (the Keys button, or `?`) shows the keys in effect, which the user may have changed in the user configuration file.

| Action | Where | Keys (macOS) |
|---|---|---|
| Go up | grid | ↑ (↑) |
| Go down | grid | ↓ (↓) |
| Go left | grid | ← (←) |
| Go right | grid | → (→) |
| Go to the first | grid | Home (Home) |
| Go to the last | grid | End (End) |
| Edit | grid | Enter and F2 (↩ and F2) |
| Clear the cell | grid | Delete and Backspace (⌦ and ⌫) |
| Confirm the edit | editor | Enter (↩) |
| Cancel the edit | editor | Esc (Esc) |
| Previous tool | zoom | ← (←) |
| Next tool | zoom | → (→) |
| First tool | zoom | Home (Home) |
| Last tool | zoom | End (End) |
| Narrower column | edge | ← (←) |
| Wider column | edge | → (→) |
| Much narrower column | edge | Shift+← (⇧←) |
| Much wider column | edge | Shift+→ (⇧→) |
| Narrowest column | edge | Home (Home) |
| Widest column | edge | End (End) |
| Fit the column to its content | edge | Enter (↩) |
| Go up | panel | ↑ (↑) |
| Go down | panel | ↓ (↓) |
| Done | panel | Enter (↩) |
| Cancel the edit | panel | Esc (Esc) |
| Toggle a predecessor (a control's own keys, not changeable) | panel | Space (Space) |
| Previous tool | switch | ← (←) |
| First tool | switch | Home (Home) |
| Critical path (a control's own keys, not changeable) | switch | Space (Space) |

## Example

```json item
{
  "type": "gantt",
  "id": "plan",
  "props": {
    "start": "2026-01-05",
    "tasks": [
      {
        "id": "build",
        "label": "Build",
        "duration": 5
      }
    ]
  }
}
```
