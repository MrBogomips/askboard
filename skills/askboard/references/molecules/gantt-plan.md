# `gantt-plan` molecule, version 1.0.0

Use for a schedule over a work breakdown of the same question: the user adjusts durations and dependencies, with dates and the critical path computed.
The data an agent sends for a Gantt plan: the work breakdown whose leaves are its tasks, the plan's start, and each task's finish-to-start predecessors. Each is checked by the same definitions as a Gantt's props. The plan's names, durations and order come from its work breakdown.

Send it in a question's `items` as `{type: "molecule", id, props: {molecule: "gantt-plan", data}}`; answers and `fetch` use the reference's ID.
It needs the item of `wbs-pert` in the same question, as the example shows.

## Data

- `workPackages` (required, string, matching `^[A-Za-z0-9_-]{1,64}$`): The ID of the Tree item, in the same question, whose leaves are the plan's tasks.
- `start` (required, string, matching `^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`): The plan's start: work starts on the first working day on or after it.
- `dependencies` (object, one entry for each key): Each task's predecessors, finish to start, by task ID.
- `dependencies.<key>` (list of string, matching `^[A-Za-z0-9_-]{1,64}$`, at most 50 items, each once): A task's finish-to-start predecessors, by task ID, each listed once.

## Example

```json ask
{
  "askId": "plan-x7k2",
  "items": [
    {
      "type": "question",
      "id": "q",
      "props": {
        "text": "Review the plan.",
        "items": [
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
          },
          {
            "type": "molecule",
            "id": "gantt",
            "props": {
              "molecule": "gantt-plan",
              "data": {
                "workPackages": "wbs",
                "start": "2026-11-02",
                "dependencies": {
                  "portal": [
                    "ux"
                  ]
                }
              }
            }
          }
        ]
      }
    }
  ]
}
```
