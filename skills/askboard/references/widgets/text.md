# Text

Use for a passage of plain text or Markdown the user reads; it gives no answer.
Item type `text`: props are a Text's props {text, format?}.

## Fields

- `text` (required, string, 1 to 10000 characters)
- `format` (one of "plain", "markdown")

## Notes

- `format` is `plain` (the default) or `markdown`. Markdown is shown as data: raw HTML never renders, only http and https links open, and an image shows as a link to its source.

## In the answer

- Nothing: this type's answer has no edits, result or derived values.

## Example

```json item
{
  "type": "text",
  "id": "intro",
  "props": {
    "text": "The budget below covers **Q3** only.",
    "format": "markdown"
  }
}
```
