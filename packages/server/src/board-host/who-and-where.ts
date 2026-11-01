// The context header's messages (board-host spec, "Who asked and the agent status on the board";
// design decision 12; FR-24, AD-4): who asked and where, which the contract builds from the ask's
// origin, its agent's name, the expected answerer ask-core shows and the session project, so that
// ask-core can build the same row; and the agent status.

import {
  type AgentStatus,
  type AgentStatusMessage,
  BOARD_PROTOCOL_VERSION,
  type OriginMessage,
} from "@askboard/contract";

export { originMessage } from "@askboard/contract";

/** What `board-host` sends a board for its context header. */
export type HeaderMessage = OriginMessage | AgentStatusMessage;

export const agentMessage = (status: AgentStatus): AgentStatusMessage => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "agent",
  status,
});
