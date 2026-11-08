# Row

Use for 2 to 4 items side by side; a narrow board stacks them.
Item type `row`: props are a Row's props {items, widths?}.

## Fields

- `items` (required, list of `layoutItem`, 2 to 4 items)
- `widths` (object, one entry for each key)
- `widths.<key>` (whole number, 1 to 4)

## Notes

- `widths` gives weights from 1 to 4, keyed by item ID; an item with none weighs 1. Put wide widgets (a Tree, a Gantt, a schedule or a board view) in a Stack or a tab, not a Row.

## In the answer

- Nothing: this type's answer has no edits, result or derived values.

## Example

```json item
{
  "type": "row",
  "id": "arrange-row",
  "props": {
    "items": [
      {
        "type": "number-field",
        "id": "arrange-row-qty",
        "props": {
          "label": "Quantity",
          "min": 0
        }
      },
      {
        "type": "text-field",
        "id": "arrange-row-unit",
        "props": {
          "label": "Unit"
        }
      }
    ],
    "widths": {
      "arrange-row-qty": 2
    }
  }
}
```
