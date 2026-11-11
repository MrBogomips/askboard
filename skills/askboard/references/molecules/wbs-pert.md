# `wbs-pert` molecule, version 1.0.0

Use for a work breakdown with three-point estimates that the user reviews and edits, with expected effort and spread computed per package and rolled up.
The data an agent sends for a work breakdown with PERT: its work packages, nested, each with three-point estimates in working days, and how many levels open at first. AskBoard derives each package's expected effort and spread, and their roll-ups.

Send it in a question's `items` as `{type: "molecule", id, props: {molecule: "wbs-pert", data}}`; answers and `fetch` use the reference's ID.

## Data

- `nodes` (required, list of `node`): The top-level work packages, in order.
- `nodes[].id` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): An ask, item or child ID the agent chooses.
- `nodes[].label` (required, string, 1 to 200 characters)
- `nodes[].children` (list of `node`, at least 1 item): Each as `node` above.
- `nodes[].optimistic` (number, 0 to 100000): Working days, from 0 to 100,000.
- `nodes[].mostLikely` (number, 0 to 100000): Working days, from 0 to 100,000.
- `nodes[].pessimistic` (number, 0 to 100000): Working days, from 0 to 100,000.
- `nodes[].excerpt` (string, 1 to 1000 characters): Where in the project the package comes from, as path#Heading or path#L10-L40.
- `depth` (whole number, 1 to 8): How many levels open when the board first shows the work breakdown: 2 when left out.

## Example

```json item
{
  "type": "molecule",
  "id": "wbs",
  "props": {
    "molecule": "wbs-pert",
    "data": {
      "nodes": [
        {
          "id": "design",
          "label": "Design",
          "children": [
            {
              "id": "ux",
              "label": "UX design",
              "optimistic": 3,
              "mostLikely": 5,
              "pessimistic": 10
            },
            {
              "id": "api",
              "label": "API design",
              "optimistic": 2,
              "mostLikely": 4,
              "pessimistic": 6
            }
          ]
        },
        {
          "id": "build",
          "label": "Build",
          "children": [
            {
              "id": "portal",
              "label": "Portal",
              "optimistic": 8,
              "mostLikely": 12,
              "pessimistic": 20
            }
          ]
        }
      ]
    }
  }
}
```
