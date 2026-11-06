# Gantt

Use for a schedule the user adjusts: tasks, durations, dependencies, with dates and the critical path computed.
Item type `gantt`: props are a Gantt's props {start, tasks, workPackages?}.

## Fields

- `start` (required, string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `workPackages` (string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `tasks` (required, one of: `ownTasks`; `planTasks`)
- `tasks[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `tasks[].label` (required, string, 1 to 200 characters)
- `tasks[].duration` (required, whole number, 1 to 2000)
- `tasks[].start` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `tasks[].dependencies` (list of string, matching `^[A-Za-z0-9_-]{1,64}$`, at most 50 items, each once): A task's finish-to-start predecessors, by task ID, each listed once.
- `tasks.<key>` (object)
- `tasks.<key>.duration` (whole number, 1 to 2000)
- `tasks.<key>.start` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `tasks.<key>.dependencies` (list of string, matching `^[A-Za-z0-9_-]{1,64}$`, at most 50 items, each once): A task's finish-to-start predecessors, by task ID, each listed once.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.
- Derived: `derived` carries the plan's finish and criticalPath, by address; never compute them.

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
