// The Kanban's registry entry (latex-kanban-timeline, design decision 4): its schemas, check,
// shape, wording, example and teaching text. It imports no runtime value of `validate.ts`,
// `sets.ts` or a schema set module (the registry's import rule). A Kanban gives no result and
// derives nothing: the user moves cards, which the answer reports as `set`s of their column.

import type { WidgetType } from "../registry.ts";
import { kanbanPropsProblems } from "./checks.ts";
import { KANBAN_SHAPE } from "./constants.ts";
import kanbanChanges from "./kanban-changes.json" with { type: "json" };
import kanbanProps from "./kanban-props.json" with { type: "json" };
import { KANBAN_KEYS } from "./keys.ts";
import { KANBAN_EXPECTED, KANBAN_FIELDS, kanbanElementOf } from "./wording.ts";

export const KANBAN_WIDGET: WidgetType = {
  type: "kanban",
  noun: "a Kanban",
  props: kanbanProps,
  propsProblems: kanbanPropsProblems,
  edits: { changes: kanbanChanges, shape: () => KANBAN_SHAPE },
  wording: { expected: KANBAN_EXPECTED, fields: KANBAN_FIELDS, element: kanbanElementOf },
  example: {
    item: {
      type: "kanban",
      id: "tickets",
      props: {
        columns: [
          { id: "todo", label: "To do" },
          { id: "doing", label: "Doing" },
          { id: "done", label: "Done" },
        ],
        cards: [
          { id: "fix-login", label: "Fix the login redirect", column: "todo" },
          { id: "write-docs", label: "Write the guide", column: "doing" },
          { id: "release-notes", label: "Release notes", column: "done" },
        ],
      },
    },
  },
  keys: KANBAN_KEYS,
  help: {
    mouse:
      "Drag a card to another column (Escape cancels the drag), or make a card current and use Move to\u2026 to pick its column.",
    answer:
      "The agent receives the cards you moved and the column each one is in now; their order and the columns stay as they were.",
  },
  skill: {
    use: "cards the user moves between 2 to 12 columns, such as statuses, priorities or owners",
    notes: [
      "Each card names its `column` by ID; the answer's changes are `set`s of `<id>.<card>.column`. The user only moves cards: their order, labels and the columns stay.",
    ],
  },
};
