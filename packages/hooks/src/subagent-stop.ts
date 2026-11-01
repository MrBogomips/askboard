// The stop guard (design decisions 2, 6 and 8; AD-3, AD-10): a subagent's stop is posted to the
// session process, which decides and acts in the same call, raising `received` for what a block
// carries or telling ask-core the subagent finished. A block becomes Claude Code's block output,
// whose reason, the push message after its preface with the subagent's open asks, is the
// subagent's next input. An allow gives no output; so does anything the hook cannot read, since
// a stop the guard cannot decide goes through.

import {
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  pushMessageText,
  type StopRequest,
} from "@askboard/contract";
import { validatePushMessage } from "@askboard/contract/validate";
import { HookFailure } from "./failure.ts";
import type { HookInput } from "./input.ts";
import type { HookHandler } from "./runner.ts";

/** The stop the hook posts, from Claude Code's SubagentStop input. */
export const stopOf = (input: HookInput): StopRequest => {
  const agentId = input.agent_id;
  if (typeof agentId !== "string" || agentId === "") {
    throw new HookFailure("the hook input names no agent");
  }
  return {
    version: LOCAL_API_VERSION,
    agent_id: agentId,
    // Claude Code's side agents give an empty one, which the session process has no record of.
    ...(typeof input.agent_type === "string" ? { agent_type: input.agent_type } : {}),
    stop_hook_active: input.stop_hook_active === true,
  };
};

export const subagentStop: HookHandler = async ({ input, localApi }) => {
  const { method, path } = LOCAL_API_ROUTES.stop;
  const decision = await localApi.exchange({ method, path, body: stopOf(input) }, "stopResponse");
  if (decision.decision === "allow") return {};
  const checked = validatePushMessage(decision.message);
  if (!checked.ok) {
    throw new HookFailure("the local API gave POST /v1/stop an answer that is not the contract's");
  }
  return { output: { decision: "block", reason: pushMessageText(checked.value) } };
};
