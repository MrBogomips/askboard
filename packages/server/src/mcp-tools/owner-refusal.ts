// The refusal of a call on an owned ask that is not its owner's (AD-5; core spec, "Only the owner
// acts on an owned ask", "Re-sending comes from the owner"): one text per refusal and tool, naming
// the ask and what the agent can do. `ask` refuses a whole request; `collect`, and the tools that
// later check owners, list it among the request's problems.

import type { OwnerRefusal } from "@askboard/core";

/** The text of a refusal `ask-core` gave `tool`'s call on `askId`. */
export const ownerRefusalText = (kind: OwnerRefusal, askId: string, tool: string): string => {
  if (tool === "ask") {
    return kind === "other-owner"
      ? `The ask ID "${askId}" is in use in this session by another agent's ask, which sending this request again cannot get: choose a new ID for your ask and send it with that ID.`
      : `The ask "${askId}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the identical request again.`;
  }
  return kind === "other-owner"
    ? `the ask "${askId}" belongs to another agent: leave it out`
    : `the ask "${askId}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours: send the ${tool} again`;
};
