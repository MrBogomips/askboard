# PickField

Use for one or several options picked from a list, as in a form.
Item type `pick-field`: props are a PickField's props {label, description?, required?, options, multiple?, minItems?, maxItems?}.

## Fields

- `label` (required, string, 1 to 200 characters)
- `description` (string, 1 to 1000 characters)
- `required` (true or false)
- `options` (required, list of `option`, 2 to 50 items)
- `options[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `options[].label` (required, string, 1 to 200 characters)
- `options[].description` (string, 1 to 1000 characters)
- `multiple` (true or false)
- `minItems` (whole number, 1 to 50)
- `maxItems` (whole number, 1 to 50)

## Notes

- Options are `{id, label, description?}`, 2 to 50. `multiple` allows several, with `minItems` and `maxItems`; the result is an option ID, or a list of IDs. An enum of an MCP form is a PickField, a string a TextField, a number a NumberField, a boolean a Toggle.

## In the answer

- Result: `results` holds, under the item's ID, an option ID, or a list of option IDs.

## Example

```json item
{
  "type": "pick-field",
  "id": "region",
  "props": {
    "label": "Region",
    "options": [
      {
        "id": "eu",
        "label": "Europe"
      },
      {
        "id": "us",
        "label": "North America"
      },
      {
        "id": "apac",
        "label": "Asia-Pacific",
        "description": "Includes Oceania."
      }
    ]
  }
}
```
