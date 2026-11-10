# Kanban

Use for cards the user moves between 2 to 12 columns, such as statuses, priorities or owners.
Item type `kanban`: props are a Kanban's props {columns, cards}.

## Fields

- `columns` (required, list of `column`, 2 to 12 items)
- `columns[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `columns[].label` (required, string, 1 to 60 characters)
- `cards` (required, list of `card`, 1 to 200 items)
- `cards[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `cards[].label` (required, string, 1 to 200 characters)
- `cards[].description` (string, 1 to 500 characters)
- `cards[].column` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.

## Notes

- Each card names its `column` by ID; the answer's changes are `set`s of `<id>.<card>.column`. The user only moves cards: their order, labels and the columns stay.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.

## Keys

The board shows no keys panel for the Kanban yet, and the user's key changes do not reach it: these are its default keys.

| Action | Where | Keys (macOS) |
|---|---|---|
| Go up | board | ↑ (↑) |
| Go down | board | ↓ (↓) |
| Go left | board | ← (←) |
| Go right | board | → (→) |
| Previous tool | toolbar | ← (←) |
| Next tool | toolbar | → (→) |
| First tool | toolbar | Home (Home) |
| Last tool | toolbar | End (End) |

## Example

```json item
{
  "type": "kanban",
  "id": "tickets",
  "props": {
    "columns": [
      {
        "id": "todo",
        "label": "To do"
      },
      {
        "id": "doing",
        "label": "Doing"
      },
      {
        "id": "done",
        "label": "Done"
      }
    ],
    "cards": [
      {
        "id": "fix-login",
        "label": "Fix the login redirect",
        "column": "todo"
      },
      {
        "id": "write-docs",
        "label": "Write the guide",
        "column": "doing"
      },
      {
        "id": "release-notes",
        "label": "Release notes",
        "column": "done"
      }
    ]
  }
}
```
