# Tabs layout

Use for 2 to 8 titled tabs, each holding items.
Item type `tabs`: props are a Tabs layout's props {tabs}.

## Fields

- `tabs` (required, list of `tab`, 2 to 8 items)
- `tabs[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `tabs[].title` (required, string, 1 to 80 characters)
- `tabs[].items` (required, list of `layoutItem`, at least 1 item)

## Notes

- Each tab is `{id, title, items}` with an ID unique in the Tabs; its items hold atoms, widgets and other layouts. The user sees one tab at a time, and every tab keeps its answers.

## In the answer

- Nothing: this type's answer has no edits, result or derived values.

## Example

```json item
{
  "type": "tabs",
  "id": "arrange-tabs",
  "props": {
    "tabs": [
      {
        "id": "costs",
        "title": "Costs",
        "items": [
          {
            "type": "number-field",
            "id": "arrange-tabs-cost",
            "props": {
              "label": "Cost"
            }
          }
        ]
      },
      {
        "id": "notes",
        "title": "Notes",
        "items": [
          {
            "type": "text-field",
            "id": "arrange-tabs-note",
            "props": {
              "label": "Note"
            }
          }
        ]
      }
    ]
  }
}
```
