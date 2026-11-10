# Timeline

Use for milestones and date ranges the user moves in time and across lanes, as in a roadmap.
Item type `timeline`: props are a Timeline's props {lanes, entries}.

## Fields

- `lanes` (required, list of `lane`, 1 to 20 items)
- `lanes[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `lanes[].label` (required, string, 1 to 60 characters)
- `entries` (required, list of `entry`, 1 to 200 items)
- `entries[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `entries[].label` (required, string, 1 to 200 characters)
- `entries[].lane` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `entries[].date` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `entries[].start` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `entries[].end` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.

## Notes

- An entry is a milestone with `date` or a range with `start` and `end` (inclusive), in a `lane`; the answer's changes are `set`s of `lane`, `date`, `start` and `end`.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.

## Keys

The board shows no keys panel for the Timeline yet, and the user's key changes do not reach it: these are its default keys.

| Action | Where | Keys (macOS) |
|---|---|---|
| Go up | entries | ↑ (↑) |
| Go down | entries | ↓ (↓) |
| Go to the first | entries | Home (Home) |
| Go to the last | entries | End (End) |
| Previous tool | toolbar | ← (←) |
| Next tool | toolbar | → (→) |
| First tool | toolbar | Home (Home) |
| Last tool | toolbar | End (End) |

## Example

```json item
{
  "type": "timeline",
  "id": "roadmap",
  "props": {
    "lanes": [
      {
        "id": "web",
        "label": "Web"
      },
      {
        "id": "mobile",
        "label": "Mobile"
      }
    ],
    "entries": [
      {
        "id": "checkout",
        "label": "New checkout",
        "lane": "web",
        "start": "2026-01-05",
        "end": "2026-02-27"
      },
      {
        "id": "launch",
        "label": "Public launch",
        "lane": "mobile",
        "date": "2026-03-02"
      }
    ]
  }
}
```
