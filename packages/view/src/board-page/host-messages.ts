// How the board page reads what `board-host` sends over the WebSocket (AD-7, AD-10): the text is
// parsed, the version checked first, then the message's own `type` picks its schema, as the
// contract's `validateBoardMessage` does on the other side. A message that fails is never acted on.
// Push delivery's origin and agent messages are read the same way (design decision 12), and so are
// the settings (settings-languages, design decision 6).

import {
  type AgentStatusMessage,
  BOARD_PROTOCOL_VERSION,
  type ContextHostMessage,
  type LifecycleHostMessage,
  type OriginMessage,
  type SettingsMessage,
  unsupportedVersion,
} from "@askboard/contract";
import type { Checked, Problem } from "@askboard/contract/validate";
import type { ErrorObject } from "ajv";
import { hostMessageSchemas } from "./validators.ts";

// The set as `unsupportedVersion` names it; the set itself would bring its schemas into the page.
const BOARD_PROTOCOL = { title: "board protocol", version: BOARD_PROTOCOL_VERSION };

/**
 * Every message `board-host` sends a board: protocol 1.1's, push delivery's origin and agent, and
 * the reading panel's source state and editor outcome (excerpts).
 * protocol 1.2's settings.
 */
export type BoardHostMessage =
  | LifecycleHostMessage
  | OriginMessage
  | AgentStatusMessage
  | ContextHostMessage;
  | SettingsMessage;

const refused = (path: string, message: string): Checked<BoardHostMessage> => ({
  ok: false,
  reason: "schema",
  problems: [{ path, message }],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A problem names the field it is about, as the contract's validation reports it.
const problemOf = ({ keyword, instancePath, params, message }: ErrorObject): Problem => {
  if (keyword === "additionalProperties") {
    const field = String(params.additionalProperty);
    return { path: `${instancePath}/${field}`, message: `unknown field "${field}"` };
  }
  if (keyword === "required") {
    const field = String(params.missingProperty);
    return { path: `${instancePath}/${field}`, message: `missing field "${field}"` };
  }
  return { path: instancePath || "/", message: message ?? "is invalid" };
};

const parsed = (data: unknown): { ok: true; value: unknown } | { ok: false } => {
  if (typeof data !== "string") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(data) };
  } catch {
    return { ok: false };
  }
};

/** A WebSocket message from `board-host`, checked against the board protocol. */
export const readHostMessage = (data: unknown): Checked<BoardHostMessage> => {
  const text = parsed(data);
  if (!text.ok) return refused("/", "a board-protocol message is JSON text");
  const value = text.value;
  if (!isRecord(value)) return refused("/", "a board-protocol message is a JSON object");
  const unsupported = unsupportedVersion(BOARD_PROTOCOL, value.version);
  if (unsupported !== undefined) {
    return { ok: false, reason: "version", problems: [{ path: "/version", message: unsupported }] };
  }
  // An own property only: an inherited name such as `constructor` names no message.
  const type = value.type;
  if (typeof type !== "string" || !Object.hasOwn(hostMessageSchemas, type)) {
    return refused("/type", `${JSON.stringify(type ?? null)} is not a message board-host sends`);
  }
  const check = hostMessageSchemas[type as keyof typeof hostMessageSchemas];
  if (check(value)) return { ok: true, value: value as BoardHostMessage };
  return { ok: false, reason: "schema", problems: (check.errors ?? []).map(problemOf) };
};
