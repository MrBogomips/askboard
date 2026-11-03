// Push delivery's messages outside the local API (design decisions 1, 8 and 12): the push message
// of the output format (owner `contract`), whose `closed` event joined the output format's own set
// with the ask lifecycle (task 14.5), and the board protocol's presence, origin and agent messages
// (owner `board-host`). Their schemas are standalone: each group below names the set it will join
// and that set's version, and is in no set until then.

import { BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import { type AskState, OUTPUT_FORMAT_VERSION } from "../schemas/output/index.ts";
import type { CollectAskEntry } from "../schemas/tool-envelopes/index.ts";
import type { SchemaSet } from "../versions.ts";
import agent from "./agent.json" with { type: "json" };
import origin from "./origin.json" with { type: "json" };
import presence from "./presence.json" with { type: "json" };
import pushMessage from "./push-message.json" with { type: "json" };

/** The output format's new schemas, at the output format's version. */
export const pushOutputSchemas: SchemaSet = {
  name: "output",
  title: "output format",
  owner: "contract",
  version: OUTPUT_FORMAT_VERSION,
  schemas: [pushMessage],
};

/** The board protocol's new messages, at the board protocol's version. */
export const pushBoardProtocolSchemas: SchemaSet = {
  name: "board-protocol",
  title: "board protocol",
  owner: "board-host",
  version: BOARD_PROTOCOL_VERSION,
  schemas: [presence, origin, agent],
};

/** The line before every push message's JSON, whatever the path (design decision 8). */
export const PUSH_MESSAGE_PREFACE =
  "AskBoard: the user acted on your ask. Skip any event whose seq you have seen.";

/** A stop block's list of the subagent's open asks. */
export type OpenAsk = { readonly askId: string; readonly state: AskState; readonly cursor: string };

export type PushMessage = {
  readonly versions: { readonly output: string };
  readonly epoch: string;
  /** Each entry as `collect` returns it. */
  readonly asks: readonly CollectAskEntry[];
  readonly openAsks?: readonly OpenAsk[];
};

/** The text a push, a catch-up submit or a stop block carries: the preface, then the JSON. */
export const pushMessageText = (message: PushMessage): string =>
  `${PUSH_MESSAGE_PREFACE}\n${JSON.stringify(message)}`;

/** The closed event, the output format's since the ask lifecycle (task 14.5). */
export type { ClosedEvent } from "../schemas/output/index.ts";

/** Board page to `board-host`: the board's working signal (AD-2). */
export type PresenceMessage = {
  readonly version: string;
  readonly type: "presence";
  readonly working: boolean;
};

/** `board-host` to board page: who asked and where (FR-24). */
export type OriginMessage = {
  readonly version: string;
  readonly type: "origin";
  readonly who: { readonly label: string; readonly name?: string; readonly ordinal?: number };
  readonly forUser?: string;
  readonly project?: string;
  readonly directory?: string;
  readonly branch?: string;
  readonly worktree?: string;
};

export type AgentStatus = "working" | "waiting";

/** `board-host` to board page: the agent pill's status (AD-4, FR-24). */
export type AgentStatusMessage = {
  readonly version: string;
  readonly type: "agent";
  readonly status: AgentStatus;
};
