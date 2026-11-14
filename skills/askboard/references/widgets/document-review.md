# Document review

Use for a Markdown document the user comments on and suggests edits to.
Item type `document-review`: props are a Document review's props {markdown, title?}.

## Fields

- `markdown` (required, string, 1 to 10000 characters)
- `title` (string, 1 to 120 characters)

## Notes

- `markdown` is the document, at most 10,000 characters with no control or bidirectional formatting character (such as U+200E, U+200F, U+061C) but line feeds and tabs; send a longer one as one item per section. `title` is optional.
- The result is `annotations`, each a `quote` selector (`exact`, `prefix`, `suffix`) and a body with `text` (a comment), `replacement` (a suggested edit) or both. A quote is the text as the board shows it, Markdown marks removed.
- `replacement` replaces `exact`, and an empty one deletes it. If you cannot find a quote in your Markdown, ask the user; never guess.
- An untouched item gives no result, so give the question options or another widget that answers.

## In the answer

- Result: `results` holds, under the item's ID, an object with:
  - `annotations` (required, list of value, 1 to 100 items)

## Example

```json item
{
  "type": "document-review",
  "id": "release-notes",
  "props": {
    "markdown": "## Release 0.2\n\nThe board **remembers** drafts.",
    "title": "Release notes"
  }
}
```
