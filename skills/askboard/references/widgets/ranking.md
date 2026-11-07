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
