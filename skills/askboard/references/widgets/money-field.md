# MoneyField

Use for an amount of money the user types, in one currency or one picked from a list.
Item type `money-field`: props are a MoneyField's props {label, description?, required?, currency or currencies, min?, max?}.

## Fields

- `label` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)
- `currency` (string, matching `^[A-Z]{3}$`)
- `currencies` (list of string, matching `^[A-Z]{3}$`, 2 to 10 items, each once)
- `min` (string, matching `^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$`)
- `max` (string, matching `^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$`)
- `required` (true or false)

## Notes

- Give `currency`, or `currencies` (2 to 10 codes) for the user to pick from, never both. `min` and `max` are decimal strings. The result is `{amount, currency}` with `amount` a decimal string.

## In the answer

- Result: `results` holds, under the item's ID, an object with:
  - `amount` (required, string, matching `^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$`)
  - `currency` (required, string, matching `^[A-Z]{3}$`)

## Example

```json item
{
  "type": "money-field",
  "id": "fee",
  "props": {
    "label": "Budget",
    "currency": "EUR",
    "min": "0"
  }
}
```
