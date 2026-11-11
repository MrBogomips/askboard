# Value

Use for a figure the user reads: a number, percentage, amount, date or duration.
Item type `value`: props are a Value's props {label?, kind, and the kind's fields: value and unit? for number, value for percent, amount and currency for money, date, days}.

## Fields

- `label` (string, 1 to 200 characters)
- `kind` (required, one of "number", "percent", "money", "date", "duration")
- `value` (number, -1000000000000000 to 1000000000000000)
- `unit` (string, 1 to 20 characters)
- `amount` (string, matching `^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$`)
- `currency` (string, matching `^[A-Z]{3}$`)
- `date` (string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): An RFC 3339 full-date; whether the day exists is a check.
- `days` (whole number, 0 to 100000)

## Notes

- `kind` is `number` or `percent` with `value` (a percentage is a ratio: 0.185 shows 18.5%), `money` with `amount` and `currency`, `date` with `date`, or `duration` with `days`. It gives no answer.

## In the answer

- Nothing: this type's answer has no edits, result or derived values.

## Example

```json item
{
  "type": "value",
  "id": "forecast",
  "props": {
    "label": "Budget",
    "kind": "money",
    "amount": "12480.50",
    "currency": "EUR"
  }
}
```
