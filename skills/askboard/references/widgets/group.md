# Group

Use for a titled box around related items, read as one group.
Item type `group`: props are a Group's props {title, description?, items}.

## Fields

- `title` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)
- `items` (required, list of `layoutItem`, at least 1 item)

## Notes

- `title` names the group for the user and for assistive technology; `description` is optional. `items` hold atoms, widgets and other layouts.

## In the answer

- Nothing: this type's answer has no edits, result or derived values.

## Example

```json item
{
  "type": "group",
  "id": "arrange-group",
  "props": {
    "title": "Contact",
    "description": "How we reach you about this request.",
    "items": [
      {
        "type": "text-field",
        "id": "arrange-group-phone",
        "props": {
          "label": "Phone"
        }
      }
    ]
  }
}
```
