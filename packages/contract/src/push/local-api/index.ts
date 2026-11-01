// The local API (owner `board-host`, AD-5, AD-7; design decision 2): what the hooks and the mod
// send the session process over its Unix socket, and what it answers. Every message names the
// local API's version. Claude Code's fields keep Claude Code's names (`agent_id`, `agent_type`,
// `tool_use_id`, `tool_name`, `stop_hook_active`); every other field is camelCase. A GET route's
// request is its query, so only POST routes have a request schema.

import type { AskState, OutputEvent } from "../../schemas/output/index.ts";
import type { SchemaSet } from "../../versions.ts";
import type { AskingRule } from "../asking-rules.ts";
import type { PollContinuation } from "../constants.ts";
import type { ClosedEvent, PushMessage } from "../messages.ts";
import ack from "./ack.json" with { type: "json" };
import agentId from "./agent-id.json" with { type: "json" };
import agentType from "./agent-type.json" with { type: "json" };
import deliveredRequest from "./delivered-request.json" with { type: "json" };
import modHelloRequest from "./mod-hello-request.json" with { type: "json" };
import modTurnRequest from "./mod-turn-request.json" with { type: "json" };
import noticeResponse from "./notice-response.json" with { type: "json" };
import pollResponse from "./poll-response.json" with { type: "json" };
import recordsRequest from "./records-request.json" with { type: "json" };
import ruleResponse from "./rule-response.json" with { type: "json" };
import stopRequest from "./stop-request.json" with { type: "json" };
import stopResponse from "./stop-response.json" with { type: "json" };
import version from "./version.json" with { type: "json" };

export const LOCAL_API_VERSION = "1.0";

/** The local API's schemas, at its version; in no set until the follow-up of design decision 1. */
export const localApiSchemas: SchemaSet = {
  name: "local-api",
  title: "local API",
  owner: "board-host",
  version: LOCAL_API_VERSION,
  schemas: [
    version,
    agentId,
    agentType,
    ack,
    recordsRequest,
    stopRequest,
    stopResponse,
    ruleResponse,
    noticeResponse,
    modHelloRequest,
    modTurnRequest,
    pollResponse,
    deliveredRequest,
  ],
};

const schemaId = (name: string) => `urn:askboard:local-api:${name}`;

/** Each message of the local API, by route and direction, with the `$id` of its schema. */
export const LOCAL_API_MESSAGES = {
  recordsRequest: schemaId("records-request"),
  recordsResponse: schemaId("ack"),
  stopRequest: schemaId("stop-request"),
  stopResponse: schemaId("stop-response"),
  ruleResponse: schemaId("rule-response"),
  noticeResponse: schemaId("notice-response"),
  modHelloRequest: schemaId("mod-hello-request"),
  modHelloResponse: schemaId("ack"),
  modTurnRequest: schemaId("mod-turn-request"),
  modTurnResponse: schemaId("ack"),
  pollResponse: schemaId("poll-response"),
  deliveredRequest: schemaId("delivered-request"),
  deliveredResponse: schemaId("ack"),
} as const;

export type LocalApiMessageName = keyof typeof LOCAL_API_MESSAGES;

/** A PreToolUse hook's record of one AskBoard call (AD-5). */
export type AgentRecord = {
  readonly version: string;
  /** Absent for the main conversation. */
  readonly agent_id?: string;
  readonly agent_type?: string;
  readonly cwd: string;
  readonly tool_use_id?: string;
  readonly tool_name: string;
  readonly askIds: readonly string[];
  /** RFC 3339 UTC: when the hook ran. */
  readonly timestamp: string;
};

/** The answer to a record, a hello, a turn report or a delivery report. */
export type LocalApiAck = { readonly version: string };

export type StopRequest = {
  readonly version: string;
  readonly agent_id: string;
  readonly agent_type?: string;
  readonly stop_hook_active: boolean;
};

export type StopDecision =
  | { readonly version: string; readonly decision: "allow" }
  | { readonly version: string; readonly decision: "block"; readonly message: PushMessage };

export type EffectiveRule = {
  readonly version: string;
  readonly rule: AskingRule;
  /** Whether a board can be shown, by AD-18's rule. */
  readonly showable: boolean;
};

export type AskNotice = { readonly version: string; readonly title: string; readonly link: string };

export type ModHello = {
  readonly version: string;
  readonly client: { readonly name: string; readonly version: string };
};

export type TurnReport = {
  readonly version: string;
  readonly agent_id?: string;
  readonly running: boolean;
};

/** What a poll lists of an ask's events: E1's events and the `closed` event. */
export type PolledEvent = OutputEvent | ClosedEvent;

export type PolledAsk = {
  readonly askId: string;
  /** The owner's agent ID; absent for the main conversation. */
  readonly agent_id?: string;
  readonly state: AskState;
  readonly cursor: string;
  readonly events: readonly PolledEvent[];
};

/** One line of the pending-asks list (EXPERIENCE, Counting). */
export type PendingAsk = {
  readonly askId: string;
  readonly title: string;
  readonly label: string;
  readonly agentName?: string;
  readonly openQuestions: number;
  readonly link: string;
  readonly agent_id?: string;
};

export type PollResponse = {
  readonly version: string;
  readonly epoch: string;
  readonly asks: readonly PolledAsk[];
  readonly pending: readonly PendingAsk[];
  /** With `continuation`: the events did not fit under the response limit. */
  readonly more?: true;
  readonly continuation?: PollContinuation;
};

export type DeliveryReport = {
  readonly version: string;
  readonly askId: string;
  readonly cursor: string;
  readonly via: "append" | "submit";
};

/** The type of each message, by name. */
export type LocalApiMessages = {
  readonly recordsRequest: AgentRecord;
  readonly recordsResponse: LocalApiAck;
  readonly stopRequest: StopRequest;
  readonly stopResponse: StopDecision;
  readonly ruleResponse: EffectiveRule;
  readonly noticeResponse: AskNotice;
  readonly modHelloRequest: ModHello;
  readonly modHelloResponse: LocalApiAck;
  readonly modTurnRequest: TurnReport;
  readonly modTurnResponse: LocalApiAck;
  readonly pollResponse: PollResponse;
  readonly deliveredRequest: DeliveryReport;
  readonly deliveredResponse: LocalApiAck;
};
