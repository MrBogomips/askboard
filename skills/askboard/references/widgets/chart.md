# Chart

Use for a bar, line or pie chart the user reads and may highlight points on.
Item type `chart`: props are a Chart's props {kind, categories, series, title?, valueLabel?, categoryLabel?, unit?, highlights?}.

## Fields

- `kind` (required, one of "bar", "line", "pie")
- `categories` (required, list of `category`, 1 to 100 items)
- `categories[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `categories[].label` (required, string, 1 to 60 characters)
- `series` (required, list of `series`, 1 to 5 items)
- `series[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `series[].label` (required, string, 1 to 60 characters)
- `series[].values` (required, list of value, 1 to 100 items)
- `title` (string, 1 to 120 characters)
- `valueLabel` (string, 1 to 60 characters)
- `categoryLabel` (string, 1 to 60 characters)
- `unit` (string, 1 to 20 characters)
- `highlights` (one of "many", "one", "none")

## Notes

- `values` holds one number or null per category, in the categories' order; at most 5 series, and a pie takes one series of at most 5 slices.
- `highlights` is `many` (default), `one` or `none`. The result is `points`, each `{series, category}`; an untouched Chart gives no result, and with `highlights: "none"` there is no result at all, so give the question options or another item.

## In the answer

- Result: `results` holds, under the item's ID, an object with:
  - `points` (required, list of object, 1 to 500 items)
  - `points[].series` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
  - `points[].category` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.

## Keys

These are the default keys. The board's keys panel (the Keys button, or `?`) shows the keys in effect, which the user may have changed in the user configuration file.

| Action | Where | Keys (macOS) |
|---|---|---|
| Go up | plot | ↑ (↑) |
| Go down | plot | ↓ (↓) |
| Go left | plot | ← (←) |
| Go right | plot | → (→) |
| Go to the first | plot | Home (Home) |
| Go to the last | plot | End (End) |
| Highlight the point | plot | Space and Enter (Space and ↩) |

## Example

```json item
{
  "type": "chart",
  "id": "failures",
  "props": {
    "kind": "bar",
    "categories": [
      {
        "id": "fix-a",
        "label": "Fix A"
      },
      {
        "id": "fix-b",
        "label": "Fix B"
      },
      {
        "id": "fix-c",
        "label": "Fix C"
      }
    ],
    "series": [
      {
        "id": "fails",
        "label": "Failures",
        "values": [
          4,
          9,
          2
        ]
      },
      {
        "id": "reruns",
        "label": "Reruns",
        "values": [
          1,
          3,
          null
        ]
      }
    ],
    "unit": "runs"
  }
}
```
