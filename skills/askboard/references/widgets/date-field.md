# DateField

Use for a calendar day the user types or picks, optionally within a range.
Item type `date-field`: props are a DateField's props {label, description?, required?, min?, max?}.

## Fields

- `label` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)
- `min` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `max` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `required` (true or false)

## Notes

- `min` and `max` are full-dates (`2026-03-02`) that bound the days offered. The result is a full-date.

## In the answer

- Result: `results` holds, under the item's ID, a date as `YYYY-MM-DD`.

## Example

```json item
{
  "type": "date-field",
  "id": "start",
  "props": {
    "label": "Start date",
    "min": "2026-01-01"
  }
}
```
