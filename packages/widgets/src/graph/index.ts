// The board graph's library chunk `board-graph` (molecules, design decision 13): the entry every
// widget that computes imports the board's graph through, by this file's path, which the view
// build maps to the chunk's one module instance, so that the WBS and the plan on a board read one
// live graph per draft update and one graph of the board as sent. Its modules are imported only
// through here, except as types. The rules that carry a Tree's edits into the plans over it come
// through here too (design decision 12).

export { type BoardGraph, liveGraph, sentGraph } from "./board-graph.ts";
export {
  afterAdd,
  afterDelete,
  dependentsOf,
  type LinkedPlan,
  type LinkedValues,
  linkedEdit,
  linkedPlans,
  type PlanEdit,
  type PlanRefusal,
} from "./plan-link.ts";
