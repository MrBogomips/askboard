# Stack

Use for items one under another in a column, as one block of a question.
Item type `stack`: props are a Stack's props {items}.

## Fields

- `items` (required, list of `layoutItem`, at least 1 item)

## Notes

- `items` hold atoms, widgets and other layouts, never excerpts, references, images or molecule references.

## In the answer

- Nothing: this type's answer has no edits, result or derived values.

## Example

```json item
{
  "type": "stack",
  "id": "arrange-stack",
  "props": {
    "items": [
      {
        "type": "text",
        "id": "arrange-stack-note",
        "props": {
          "text": "Fill in both fields."
        }
      },
      {
        "type": "text-field",
        "id": "arrange-stack-name",
        "props": {
          "label": "Name"
        }
      }
    ]
  }
}
```
