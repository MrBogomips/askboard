# TextField

Use for a short or long free text the user types, such as a name or a comment.
Item type `text-field`: props are a TextField's props {label, description?, required?, multiline?, minLength?, maxLength?, pattern?}.

## Fields

- `label` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)
- `multiline` (true or false)
- `maxLength` (whole number, 1 to 10000)
- `minLength` (whole number, 1 to 10000)
- `pattern` (string, 1 to 200 characters)
- `required` (true or false)

## Notes

- `multiline` allows line breaks; `maxLength` (up to 10,000 characters) caps the text. The result is the text itself, and an empty field gives none.
- `minLength` sets the fewest characters; `required` makes an answer wait for a value. `pattern` must be matched by the text, unanchored; a field with a `pattern` holds at most 100 characters.
- A `pattern` is a regular expression with no backreference, lookaround or repeated group holding a quantifier or a `|`, and at most 3 repetitions: each `?`, `*`, `+`, `{n,}`, `{n,m}`, group holding a `|` and a missing leading `^` counts one.

## In the answer

- Result: `results` holds, under the item's ID, a text of 1 to 10000 characters.

## Example

```json item
{
  "type": "text-field",
  "id": "reviewer",
  "props": {
    "label": "Reviewer's name",
    "description": "As it should appear in the log.",
    "maxLength": 80
  }
}
```
