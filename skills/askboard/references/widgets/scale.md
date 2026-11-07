# Scale

Use for a number on a slider, a range between two numbers, or a rating of up to 11 values.
Item type `scale`: props are a Scale's props {min, max, step?, range?, display?, minLabel?, maxLabel?, unit?}.

## Fields

- `min` (required, number, -1000000000 to 1000000000)
- `max` (required, number, -1000000000 to 1000000000)
- `step` (number, at most 2000000000)
- `range` (true or false)
- `display` (one of "slider", "rating")
- `minLabel` (string, 1 to 60 characters)
- `maxLabel` (string, 1 to 60 characters)
- `unit` (string, 1 to 20 characters)

## Notes

- Nothing is set until the user sets it: the result is `value`, or `low` and `high` with `range`.

## In the answer

- Result: `results` holds, under the item's ID, an object with:
  - `value` (number, -1000000000 to 1000000000)
  - `low` (number, -1000000000 to 1000000000)
  - `high` (number, -1000000000 to 1000000000)

## Example

```json item
{
  "type": "scale",
  "id": "confidence",
  "props": {
    "min": 1,
    "max": 5,
    "display": "rating",
    "minLabel": "Low",
    "maxLabel": "High"
  }
}
```
