// The Ranking's registry entry (approval-scale-ranking, design decision 1): its schemas, checks,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A Ranking edits nothing and derives nothing: it
// gives an order.

import type { WidgetType } from "../registry.ts";
import { rankingPropsProblems, rankingResultProblems } from "./checks.ts";
import rankingProps from "./ranking-props.json" with { type: "json" };
import rankingResult from "./ranking-result.json" with { type: "json" };
import { RANKING_EXPECTED, RANKING_FIELDS, rankingElementOf } from "./wording.ts";

export const RANKING_WIDGET: WidgetType = {
  type: "ranking",
  noun: "a Ranking",
  props: rankingProps,
  propsProblems: rankingPropsProblems,
  result: { schema: rankingResult, problems: rankingResultProblems },
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
  skill: {
    use: "an order of 2 to 50 items the user sets by dragging or with Move up and Move down",
    notes: ["`order` lists every item ID once; an untouched Ranking gives no result."],
  },
};
