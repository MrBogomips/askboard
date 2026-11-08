# Table

Use for a grid of typed columns to edit, with totals and formula columns.
Item type `table`: props are a Table's props {columns, rows, label?, fixedRows?}.

## Fields

- `label` (string, 1 to 200 characters)
- `fixedRows` (always true)
- `columns` (required, list of `column`, 1 to 10 items)
- `columns[].field` (required, string, matching `^(?!id$)[a-z][A-Za-z0-9]{0,63}$`)
- `columns[].label` (required, string, 1 to 200 characters)
- `columns[].type` (required, one of "text", "number", "money", "date", "toggle")
- `columns[].formula` (string, 1 to 500 characters)
- `columns[].total` (always "sum")
- `rows` (required, list of `row`, at most 200 items)
- `rows[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `rows[].<field>` (the key matches `^(?!id$)[a-z][A-Za-z0-9]{0,63}$`, one of: string, 1 to 500 characters; number, -1000000000000000 to 1000000000000000; true or false): A cell's value, by its column's type: a string of 1 to 500 characters (text; a money amount; a date), a number within a quadrillion either way, or a boolean.

## Notes

- Columns (1 to 10, unique lower-case `field`): `text` (`maxLength`), `number` (`min`, `max`, `step`, `integer`, `unit`), `money` (`currency`; `min`, `max` as decimal strings), `date` (`min`, `max`), `toggle`. A row is `{id, <field>: value}`; money is a decimal string; leave an empty cell out.
- A column with a `formula` is computed and read-only: no value for it in a row. `[@field]` reads that field of the same row; a formula reads single fields only (no `*`, no range), at most 500 characters. `total: "sum"` on a number or money column adds a total that formulas read as `[item.field]`.
- `fixedRows: true` keeps your rows: the user edits cells but adds and deletes none. At most 200 rows. The answer gives the changes (`set` of `item.row.field`, `add`, `remove`) and the derived values: each total and the formula cells of rows that moved.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.
- Derived: `derived` carries each total, `item.field`, and each formula column's field of a row, `item.row.field`, by address; never compute them.

## Example

```json item
{
  "type": "table",
  "id": "costs",
  "props": {
    "label": "Roles",
    "columns": [
      {
        "field": "role",
        "label": "Role",
        "type": "text"
      },
      {
        "field": "days",
        "label": "Days",
        "type": "number",
        "min": 0,
        "total": "sum"
      },
      {
        "field": "rate",
        "label": "Rate",
        "type": "money",
        "currency": "USD"
      },
      {
        "field": "amount",
        "label": "Amount",
        "type": "money",
        "currency": "USD",
        "formula": "[@days] * [@rate]",
        "total": "sum"
      }
    ],
    "rows": [
      {
        "id": "pm",
        "role": "Project manager",
        "days": 18,
        "rate": "1040.00"
      },
      {
        "id": "dev",
        "role": "Developer",
        "days": 72,
        "rate": "720.00"
      }
    ]
  }
}
```
