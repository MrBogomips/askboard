# Tree

Use for a work breakdown or any hierarchy the user edits: add, move, rename, remove nodes, adjust estimates.
Item type `tree`: props are a Tree's props {columns?, nodes, pert?, openDepth?}.

## Fields

- `columns` (list of `column`, at most 8 items)
- `columns[].field` (required, string, matching `^(?!(?:id|label|children)$)[a-z][A-Za-z0-9]{0,63}$`)
- `columns[].label` (required, string, 1 to 200 characters)
- `columns[].type` (required, one of "text", "number")
- `nodes` (required, list of `node`)
- `nodes[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `nodes[].label` (required, string, 1 to 200 characters)
- `nodes[].children` (list of `node`, at least 1 item): Each as `node` above.
- `nodes[].<field>` (the key matches `^(?!(?:id|label|children)$)[a-z][A-Za-z0-9]{0,63}$`, one of: string, 1 to 1000 characters; number): A field's value: text of 1 to 1,000 characters or a number, by its column's type.
- `pert` (always true): A work breakdown: the columns declare optimistic, mostLikely and pessimistic as numbers, every estimate is 0 to 100,000 working days, and every node and the item get the derived fields expected and spread.
- `openDepth` (whole number, 1 to 8): With pert only, the levels open when the board first shows the work breakdown; a Tree without pert opens fully expanded.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.
- Derived: `derived` carries the item totals and each node's expected and spread, with pert, by address, none in an answer naming an earlier revision (see answers); never compute them.

## Example

```json item
{
  "type": "tree",
  "id": "wbs",
  "props": {
    "nodes": [
      {
        "id": "design",
        "label": "Design",
        "children": [
          {
            "id": "ux",
            "label": "UX"
          }
        ]
      }
    ]
  }
}
```
