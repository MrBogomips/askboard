// The Ranking's registry entry (approval-scale-ranking, design decision 1): its schemas, checks,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A Ranking edits nothing and derives nothing: it
// gives an order.

import type { WidgetType } from "../registry.ts";
import { rankingPropsProblems, rankingResultProblems, rankingResultShape } from "./checks.ts";
import { RANKING_KEYS } from "./keys.ts";
import rankingProps from "./ranking-props.json" with { type: "json" };
import rankingResult from "./ranking-result.json" with { type: "json" };
import { RANKING_EXPECTED, RANKING_FIELDS, rankingElementOf } from "./wording.ts";

export const RANKING_WIDGET: WidgetType = {
  type: "ranking",
  noun: "a Ranking",
  props: rankingProps,
  propsProblems: rankingPropsProblems,
  result: { schema: rankingResult, shape: rankingResultShape, problems: rankingResultProblems },
  wording: { expected: RANKING_EXPECTED, fields: RANKING_FIELDS, element: rankingElementOf },
  example: {
    item: {
      type: "ranking",
      id: "priorities",
      props: {
        items: [
          { id: "speed", label: "Speed" },
          { id: "cost", label: "Cost" },
          { id: "comfort", label: "Comfort" },
        ],
      },
    },
  },
  keys: RANKING_KEYS,
  help: {
    mouse:
      "Drag a row by its handle to a new place (Escape cancels the drag). Tick check boxes, or Shift+click for a range, to select rows: Move up, Move down, To top and To bottom then move the selected rows. Keep this order accepts the agent's order.",
    answer:
      "The agent receives the order you chose, with every item once. A ranking you did not touch gives no answer until you keep its order.",
  },
  skill: {
    use: "an order of 2 to 50 items the user sets by dragging or with Move up and Move down",
    notes: ["`order` lists every item ID once; an untouched Ranking gives no result."],
  },
};
