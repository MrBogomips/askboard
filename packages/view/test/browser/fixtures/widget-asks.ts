// Test-only asks of the widget-answers browser tests (task 5.1 on): the UJ-2 question `plan` with
// its Tree and its plan as items, as the agent could send them without molecule references, sent to
// the session process as they are. The items are the contract's fixtures'.

import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";

const [{ rev: _, ...plan }] = ganttPlanBoardDocument.items;

/** The ask of the UJ-2 plan: the WBS Tree and the Gantt plan over it, in one question. */
export const planAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [plan],
} as const;
