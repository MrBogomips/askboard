// The refusal of a call on an owned ask that is not its owner's (AD-5; core spec, "Only the owner
// acts on an owned ask", "Re-sending comes from the owner"): one text per refusal and tool, naming
// the ask and what the agent can do. `ask`, `update` and `fetch` refuse a whole request; `collect`,
// and the tools that later check owners, list it among the request's problems. `ownerCheck` binds a
// call on one ask and gives its refusal, for `update` and `fetch` (task 3.7).

import type { CallIdentity, OwnerRefusal } from "@askboard/core";
import type { CallContext, ToolCore } from "./ports.ts";
import { errorResult, type ToolResult } from "./results.ts";

/** The tools that act on one ask, whose refusal is the whole result. */
const ONE_ASK_TOOLS: readonly string[] = ["update", "fetch"];

/** The text of a refusal `ask-core` gave `tool`'s call on `askId`. */
export const ownerRefusalText = (kind: OwnerRefusal, askId: string, tool: string): string => {
  if (tool === "ask") {
    return kind === "other-owner"
      ? `The ask ID "${askId}" is in use in this session by another agent's ask, which sending this request again cannot get: choose a new ID for your ask and send it with that ID.`
      : `The ask "${askId}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the identical request again.`;
  }
  if (ONE_ASK_TOOLS.includes(tool)) {
    return kind === "other-owner"
      ? `The ask "${askId}" belongs to another agent, so this ${tool} was refused: send ${tool} only for asks you sent.`
      : `The ask "${askId}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the ${tool} again.`;
  }
  return kind === "other-owner"
    ? `the ask "${askId}" belongs to another agent: leave it out`
    : `the ask "${askId}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours: send the ${tool} again`;
};

const askIdOf = (args: unknown): string | undefined => {
  const askId = (args as { readonly askId?: unknown } | undefined)?.askId;
  return typeof askId === "string" ? askId : undefined;
};

/**
 * Binds a call on one ask to its agent record, and gives the refusal's result when the call may not
 * act on the ask (AD-5); undefined when it may, an unchecked ask taking any caller. A request that
 * names no ask is left to the tool's own validation.
 */
export const ownerCheck = async (
  core: Pick<ToolCore, "bind" | "ownerRefusal">,
  tool: "update" | "fetch",
  args: unknown,
  { toolUseId }: CallContext,
): Promise<ToolResult | undefined> => {
  const askId = askIdOf(args);
  if (askId === undefined) return undefined;
  const identity: CallIdentity = {
    ...(toolUseId === undefined ? {} : { toolUseId }),
    tool,
    askIds: [askId],
  };
  const refusal = core.ownerRefusal(askId, await core.bind(identity));
  return refusal === undefined ? undefined : errorResult(ownerRefusalText(refusal, askId, tool));
};

/** The unchecked mark of a result on the ask, present only while the ask has no owner (AD-5). */
export const uncheckedMark = (core: Pick<ToolCore, "ownerOf">, askId: string) =>
  core.ownerOf(askId) === undefined ? { unchecked: true as const } : {};
