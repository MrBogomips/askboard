// The short numbers in the draft record (answering-flow-visual, task 1.1, design decision D6): the
// lifecycle ask's draft record holding the numbers the board gave its questions, one removed since
// (the gap), and `nextNumber` above every number held.

import type { DraftRecord } from "../schemas/board-protocol/index.ts";
import { lifecycleDraftRecord } from "./lifecycle.ts";

/** The numbers by question ID: Q3 was removed, so 3 is never given again. */
export const answeringFlowVisualNumbers: Readonly<Record<string, number>> = {
  region: 1,
  payment: 2,
  analytics: 4,
  rollout: 5,
};

/** The lifecycle draft record with its numbers and the next one to give. */
export const answeringFlowVisualDraftRecord: DraftRecord = {
  ...lifecycleDraftRecord,
  numbers: answeringFlowVisualNumbers,
  nextNumber: 6,
};
