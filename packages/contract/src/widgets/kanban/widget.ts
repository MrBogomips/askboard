// The Kanban's registry entry (latex-kanban-timeline, design decision 4): its schemas, check,
// shape, wording, example and teaching text. It imports no runtime value of `validate.ts`,
// `sets.ts` or a schema set module (the registry's import rule). A Kanban gives no result and
// derives nothing: the user moves and orders cards, which the answer reports as `set`s of their
// column and `move`s within it.

import type { WidgetType } from "../registry.ts";
import { kanbanPropsProblems } from "./checks.ts";
import { KANBAN_SHAPE } from "./constants.ts";
import kanbanChanges from "./kanban-changes.json" with { type: "json" };
import kanbanProps from "./kanban-props.json" with { type: "json" };
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
  skill: {
    use: "cards the user moves between 2 to 12 columns and orders within them, such as statuses, priorities or owners",
    notes: [
      "Each card names its `column` by ID. The order of `cards` is each column's order, top to bottom. The user changes only the cards' columns and places.",
      "The answer's changes are `set`s of `<id>.<card>.column` and `move`s of `<id>.<card>`, applied in order to the `cards` list: a `move` puts the card right after `after` (a card of the same column), or first in the list without it.",
      "A column the user did not reorder gets no `move`. Labels and the columns themselves stay.",
    ],
  },
};
