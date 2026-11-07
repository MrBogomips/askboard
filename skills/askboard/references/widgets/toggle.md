# Toggle

Use for an on or off choice the user sets, such as a switch or a yes or no.
Item type `toggle`: props are a Toggle's props {label, description?}.

## Fields

- `label` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)

## Notes

- The result is `true` or `false`; `false` is an answer. A Toggle the user leaves untouched gives no result.

## In the answer

- Result: `results` holds, under the item's ID, `true` or `false`.

## Example

```json item
{
  "type": "toggle",
  "id": "notify",
  "props": {
    "label": "Notify me when it ships"
  }
}
```
