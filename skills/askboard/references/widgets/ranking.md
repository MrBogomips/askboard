# Ranking

Use for an order of 2 to 50 items the user sets by dragging or with Move up and Move down.
Item type `ranking`: props are a Ranking's props {items}.

## Fields

- `items` (required, list of `element`, 2 to 50 items)
- `items[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `items[].label` (required, string, 1 to 200 characters)
- `items[].description` (string, 1 to 500 characters)

## Notes

- `order` lists every item ID once; an untouched Ranking gives no result.

## In the answer

- Result: `results` holds, under the item's ID, an object with:
  - `order` (required, list of string, matching `^[A-Za-z0-9_-]{1,64}$`, 2 to 50 items)

## Keys

The board shows no keys panel for the Ranking yet, and the user's key changes do not reach it: these are its default keys.

| Action | Where | Keys (macOS) |
|---|---|---|
| Go up | list | ↑ (↑) |
| Go down | list | ↓ (↓) |
| Go to the first | list | Home (Home) |
| Go to the last | list | End (End) |
| Select | list | Space (Space) |
| Extend selection up | list | Shift+↑ (⇧↑) |
| Extend selection down | list | Shift+↓ (⇧↓) |
| Move up | list | Alt+Shift+↑ (⌥⇧↑) |
| Move down | list | Alt+Shift+↓ (⌥⇧↓) |
| To top | list | Alt+Shift+Home and Ctrl+Shift+↑ (⌥⇧Home and ⇧⌘↑) |
| To bottom | list | Alt+Shift+End and Ctrl+Shift+↓ (⌥⇧End and ⇧⌘↓) |
| Keep this order | list | Enter (↩) |
| Select none (with a selection) | list | Esc (Esc) |
| Show the keys | list | ? (?) |
| Previous tool | toolbar | ← (←) |
| Next tool | toolbar | → (→) |
| First tool | toolbar | Home (Home) |
| Last tool | toolbar | End (End) |

## Example

```json item
{
  "type": "ranking",
  "id": "priorities",
  "props": {
    "items": [
      {
        "id": "speed",
        "label": "Speed"
      },
      {
        "id": "cost",
        "label": "Cost"
      },
      {
        "id": "comfort",
        "label": "Comfort"
      }
    ]
  }
}
```
