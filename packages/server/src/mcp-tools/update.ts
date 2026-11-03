// The `update` tool (AD-6, FR-6; ask-lifecycle, design decision 4): the agent's changes to an ask it
// sent, applied through ask-core in order, all or none. It returns at once, with no cursor, so the
// agent's cursor still covers every event it has not collected (AD-3). A closed or discarded ask,
// and one this epoch does not hold, is a typed result, never an error (AD-10).

import { RESULT_VERSIONS, type UpdateOutcomeResult, type UpdateResult } from "@askboard/contract";
import type { UpdateOutcome } from "@askboard/core";
import { ownerCheck, uncheckedMark } from "./owner-refusal.ts";
import { errorResult, jsonResult, problemsResult, type ToolResult } from "./results.ts";
import type { ToolHandler } from "./server.ts";

const INVALID = "The update was not applied. Fix these problems and send it again:";

type Refused = Extract<UpdateOutcome, { kind: "refused" }>;

/**
 * A refusal as one line the agent acts on: the action's index, its item, why, and the cursor of
 * the logged answer that stops it, when there is one (AD-20).
 */
export const refusalText = ({ index, itemId, cursor, detail }: Refused): string => {
  const item = itemId === undefined ? "" : ` on "${itemId}"`;
  const answer = cursor === undefined || detail.includes(cursor) ? "" : ` (cursor ${cursor})`;
  return `The update was refused and nothing was changed: actions[${index}]${item}: ${detail}${answer}.`;
};

const resultOf = (
  epoch: string,
  outcome: UpdateOutcome,
  unchecked: { readonly unchecked?: true },
): ToolResult => {
  switch (outcome.kind) {
    case "invalid":
      return problemsResult(INVALID, outcome.problems);
    case "refused":
      return errorResult(refusalText(outcome));
    case "closed":
    case "discarded": {
      const typed: UpdateOutcomeResult = {
        versions: RESULT_VERSIONS,
        epoch,
        askId: outcome.askId,
        outcome: outcome.kind,
      };
      return jsonResult(typed);
    }
    default: {
      const result: UpdateResult = {
        versions: RESULT_VERSIONS,
        epoch,
        askId: outcome.askId,
        state: outcome.state,
        applied: outcome.applied,
        ...unchecked,
      };
      return jsonResult(result);
    }
  }
};

/**
 * `update`: only the owner's call goes on (AD-5); ask-core validates the request with the contract,
 * then applies it (AD-6).
 */
export const handleUpdate: ToolHandler = async ({ core }, args, context) => {
  const refused = await ownerCheck(core, "update", args, context);
  if (refused !== undefined) return refused;
  const outcome = await core.update(args ?? {});
  return resultOf(
    core.epoch,
    outcome,
    "askId" in outcome ? uncheckedMark(core, outcome.askId) : {},
  );
};
