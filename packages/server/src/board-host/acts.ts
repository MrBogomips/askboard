// What `board-host` answers to an act command and a draft (ask-lifecycle, design decision 5): an
// acknowledgement or a refusal naming the command's action ID, the refused act and why (AD-20); and
// the problems of a draft record its ask's board document cannot hold, checked before ask-core
// holds it, since ask-core does not check it.

import type {
  ActCommand,
  DraftRecord,
  LifecycleBoardDocument,
  LifecycleHostMessage,
} from "@askboard/contract";
import { draftRecordProblems } from "@askboard/contract/validate";
import type { ActOutcome } from "@askboard/core";
import {
  actRefusedMessage,
  closedRefusedMessage,
  doneMessage,
  problemsDetail,
  refusedMessage,
} from "./messages.ts";

/** `done` for a command ask-core applied, now or before; else the refusal of the whole command. */
export const actReply = (command: ActCommand, outcome: ActOutcome): LifecycleHostMessage => {
  const { actionId, acts } = command;
  if (outcome.ok) return doneMessage(actionId);
  const { refusal, detail, index } = outcome;
  if (refusal === "closed") return closedRefusedMessage(actionId, detail);
  // An act refusal names the act; the board protocol's schema has checked that every act names
  // its question, so the refused act's item stands in when ask-core names none.
  const itemId = outcome.itemId ?? (index === undefined ? undefined : acts[index]?.itemId);
  if (index === undefined || itemId === undefined) return refusedMessage("message", detail);
  return actRefusedMessage(actionId, index, itemId, detail);
};

/** Why a draft record cannot be held for this board document, or undefined when it can. */
export const draftRefusal = (
  record: DraftRecord,
  document: LifecycleBoardDocument,
): LifecycleHostMessage | undefined => {
  const problems = draftRecordProblems(record, document);
  return problems.length === 0 ? undefined : refusedMessage("message", problemsDetail(problems));
};
