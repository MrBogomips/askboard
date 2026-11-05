// The `snapshot` tool (AD-6, AD-15, FR-26; snapshot design decision 7): a Snapshot of an open or
// closed ask, saved by ask-core's writer under the session project root, whose result names the
// file's absolute path and never holds its content. It raises no `received` and returns no event
// (AD-3). A discarded ask, and one this epoch does not hold, is a typed result, never an error
// (AD-10). ask-core checks the discard before the owner, so the tool binds the call and hands the
// binding over, instead of running `ownerCheck` (AD-5).

import {
  RESULT_VERSIONS,
  type SnapshotOutcomeResult,
  type SnapshotResult,
} from "@askboard/contract";
import { validateSnapshotRequest } from "@askboard/contract/validate";
import { BoardSetupError, type CallIdentity, type SnapshotOutcome } from "@askboard/core";
import { failure } from "./diagnostics.ts";
import { ownerRefusalText } from "./owner-refusal.ts";
import { errorResult, jsonResult, problemsResult, type ToolResult } from "./results.ts";
import type { ToolHandler } from "./server.ts";

const REFUSED = "The snapshot request was refused. Fix these problems and send it again:";

// Calling again cannot help: every Snapshot fails the same way until AskBoard is rebuilt or
// reinstalled, as every ask does (the `ask` tool's text for a damaged view build).
const SETUP_FAILED =
  "AskBoard cannot take Snapshots: its view build is missing or damaged, so nothing was written. Do not call snapshot again: tell the user to rebuild or reinstall AskBoard.";

const notTaken = (askId: string, why: string) =>
  errorResult(`No Snapshot was taken of the ask "${askId}": ${why}`);

const resultOf = (epoch: string, askId: string, outcome: SnapshotOutcome): ToolResult => {
  switch (outcome.outcome) {
    case "saved": {
      const { state, path, unchecked } = outcome;
      const result: SnapshotResult = {
        versions: RESULT_VERSIONS,
        epoch,
        askId,
        state,
        path,
        ...(unchecked ? { unchecked: true as const } : {}),
      };
      return jsonResult(result);
    }
    case "discarded": {
      const typed: SnapshotOutcomeResult = {
        versions: RESULT_VERSIONS,
        epoch,
        askId,
        outcome: "discarded",
      };
      return jsonResult(typed);
    }
    case "refused":
      return errorResult(ownerRefusalText(outcome.why, askId, "snapshot"));
    case "no-project-root":
      return notTaken(
        askId,
        `${outcome.variable} is not set in this session, and AskBoard saves Snapshots only under the project folder it names. Nothing was written; tell the user, if they asked for the Snapshot.`,
      );
    default:
      return notTaken(
        askId,
        `the Snapshot folder ${outcome.folder} could not take the file (${outcome.code}), and nothing was left in it. Tell the user, who can fix the folder, then call snapshot again.`,
      );
  }
};

/**
 * `snapshot`: validates the request with the contract, so a `path` is refused by name; binds the
 * call to its agent record as `collect` does; then has ask-core take the Snapshot for the agent.
 */
export const handleSnapshot: ToolHandler = async ({ core, diagnostics }, args, context) => {
  const checked = validateSnapshotRequest(args ?? {});
  if (!checked.ok) return problemsResult(REFUSED, checked.problems);
  const { askId } = checked.value;
  const { toolUseId } = context;
  const identity: CallIdentity = {
    ...(toolUseId === undefined ? {} : { toolUseId }),
    tool: "snapshot",
    askIds: [askId],
  };
  const caller = await core.bind(identity);
  let outcome: SnapshotOutcome;
  try {
    outcome = await core.snapshot(askId, {
      takenBy: "agent",
      ...(caller === undefined ? {} : { caller }),
    });
  } catch (error) {
    // Any other failure is the tool server's to report.
    if (!(error instanceof BoardSetupError)) throw error;
    diagnostics.write(failure("snapshot failed", error));
    return errorResult(SETUP_FAILED);
  }
  return resultOf(core.epoch, askId, outcome);
};
