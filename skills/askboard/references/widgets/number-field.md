# NumberField

Use for a number the user types, with optional bounds, a step and a unit.
Item type `number-field`: props are a NumberField's props {label, description?, required?, min?, max?, step?, integer?, unit?}.

## Fields

- `label` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)
- `min` (number, -1000000000000000 to 1000000000000000)
- `max` (number, -1000000000000000 to 1000000000000000)
- `step` (number, above 0, at most 2000000000000000)
- `integer` (true or false)
- `unit` (string, 1 to 20 characters)
- `required` (true or false)

## Notes

- `min` and `max` bound it, `integer` takes whole numbers, `step` (counted from `min`, else 0) fixes the grid, and `unit` is shown beside it. Use a Scale for a slider.

## In the answer

- Result: `results` holds, under the item's ID, a number from -1000000000000000 to 1000000000000000.

## Example

```json item
{
  "type": "number-field",
  "id": "days",
  "props": {
    "label": "Days of leave",
    "min": 0,
    "max": 20,
    "step": 0.5,
    "unit": "days"
  }
}
```
