// The `ask` tool (AD-6, FR-21): validates through ask-core and returns at once, without waiting for
// the user: the board link and first cursor, `unavailable` when no board can be shown, or an error
// the agent must fix.

import {
  type AskResult,
  type AskUnavailableResult,
  RESULT_VERSIONS,
  type UnavailableReason,
  type Warning,
} from "@askboard/contract";
import type { AskOutcome } from "@askboard/core";
import { failure } from "./diagnostics.ts";
import { errorResult, jsonResult, problemsResult } from "./results.ts";
import type { ToolHandler } from "./server.ts";

/**
 * E1's sessions have no hooks, so no ask has an agent record and every ask is unchecked (AD-5):
 * every `ask` result says so.
 */
export const NO_HOOKS_WARNING: Warning = {
  code: "no-hooks",
  message:
    "This session runs without AskBoard's hooks: answers are not pushed to you, ownership is not checked and there is no stop guard. Collect this ask's answers with collect before you finish.",
};

const WHY: Readonly<Record<UnavailableReason, string>> = {
  "remote-host": "Claude Code runs on a remote host",
  container: "Claude Code runs in a container, where AskBoard opens no board",
  ci: "Claude Code runs on a CI runner and BROWSER is not set",
  "no-browser": "no browser opener was found",
};

const DETAIL_MAX_CHARS = 200;

const unavailable = (
  epoch: string,
  outcome: Extract<AskOutcome, { kind: "unavailable" }>,
): AskUnavailableResult => ({
  versions: RESULT_VERSIONS,
  epoch,
  askId: outcome.askId,
  outcome: "unavailable",
  reason: outcome.reason,
  message: `No board can be shown: ${WHY[outcome.reason]} (${outcome.detail.slice(0, DETAIL_MAX_CHARS)}). Ask through AskUserQuestion instead; a subagent ends its turn and returns the question to its caller.`,
});

export const handleAsk: ToolHandler = async ({ core, diagnostics }, args) => {
  let outcome: AskOutcome;
  try {
    outcome = await core.ask(args ?? {});
  } catch (error) {
    diagnostics.write(failure("ask failed", error));
    return errorResult(
      "AskBoard failed inside and created nothing for this ask. Send it again, or ask through AskUserQuestion.",
    );
  }
  switch (outcome.kind) {
    case "invalid":
      return problemsResult(
        "The ask was not created. Fix these problems and send it again:",
        outcome.problems,
      );
    case "in-use":
      return errorResult(
        `The ask ID "${outcome.askId}" is in use in this session: give a new ask a new ID, or send the identical request again to get this ask's board.`,
      );
    case "unavailable":
      return jsonResult(unavailable(core.epoch, outcome));
    default: {
      const result: AskResult = {
        versions: RESULT_VERSIONS,
        epoch: core.epoch,
        ...outcome.ask,
        warnings: [NO_HOOKS_WARNING],
      };
      return jsonResult(result);
    }
  }
};
