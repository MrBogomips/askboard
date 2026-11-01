// Validation of push delivery's standalone schemas (design decision 1). They are in no schema set,
// so E1's shared Ajv does not hold them. Nothing happens at import, as the package's
// `"sideEffects": false` requires: the first validation makes one Ajv with `createAjv`, which
// holds E1's schemas that these reference (ID, cursor, epoch, time, ask state, events, the collect
// entry), adds these, and compiles each on its first use. Like E1's validators, each refuses an
// unsupported major before its schema runs, and reports problems in E1's shape.

import type Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv/dist/2020";
import { createAjv } from "../compiled.ts";
import type { Checked, Problem } from "../validate.ts";
import { unsupportedVersion } from "../versions.ts";
import {
  LOCAL_API_MESSAGES,
  type LocalApiMessageName,
  type LocalApiMessages,
  localApiSchemas,
} from "./local-api/index.ts";
import {
  type AgentStatusMessage,
  type ClosedEvent,
  type OriginMessage,
  type PresenceMessage,
  type PushMessage,
  pushBoardProtocolSchemas,
  pushOutputSchemas,
} from "./messages.ts";
import { PUSH_SCHEMA_IDS, PUSH_SCHEMAS } from "./schemas.ts";
import { type SessionFile, sessionFileSchemas } from "./session-file/index.ts";

let pushAjv: Ajv2020 | undefined;

const schemaErrors = (id: string, value: unknown): readonly ErrorObject[] => {
  if (pushAjv === undefined) {
    const ajv = createAjv();
    for (const schema of PUSH_SCHEMAS) ajv.addSchema(schema);
    pushAjv = ajv;
  }
  const validate = pushAjv.getSchema(id);
  if (validate === undefined) throw new Error(`the contract has no schema ${id}`);
  return validate(value) ? [] : (validate.errors ?? []);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// E1's mapping (`validate.ts`), with `dependentRequired` read as `required`: an unknown or missing
// field joins the path.
const problemOf = ({ keyword, instancePath, params, message }: ErrorObject): Problem => {
  if (keyword === "additionalProperties") {
    const field = String(params.additionalProperty);
    return { path: `${instancePath}/${field}`, message: `unknown field "${field}"` };
  }
  if (keyword === "required" || keyword === "dependentRequired") {
    const field = String(params.missingProperty);
    return { path: `${instancePath}/${field}`, message: `missing field "${field}"` };
  }
  return { path: instancePath || "/", message: message ?? "is invalid" };
};

const refused = <T>(reason: "version" | "schema", problems: readonly Problem[]): Checked<T> => ({
  ok: false,
  reason,
  problems,
});

// The version a value names at `path`, a JSON Pointer of plain keys.
const versionAt = (value: unknown, path: string): unknown =>
  path
    .split("/")
    .slice(1)
    .reduce<unknown>((at, key) => (isRecord(at) ? at[key] : undefined), value);

type Versioned = { readonly title: string; readonly version: string; readonly path: string };

/** The major first, at the path where the message names it; then the schema, by `$id`. */
const validateStandalone = <T>(
  versioned: Versioned | undefined,
  id: string,
  value: unknown,
): Checked<T> => {
  if (versioned !== undefined) {
    const refusal = unsupportedVersion(versioned, versionAt(value, versioned.path));
    if (refusal !== undefined) {
      return refused("version", [{ path: versioned.path, message: refusal }]);
    }
  }
  const errors = schemaErrors(id, value);
  if (errors.length > 0) return refused("schema", errors.map(problemOf));
  return { ok: true, value: value as T };
};

// Where each kind of message names the version of its set.
const LOCAL_API: Versioned = { ...localApiSchemas, path: "/version" };
const SESSION_FILE: Versioned = { ...sessionFileSchemas, path: "/format" };
const OUTPUT: Versioned = { ...pushOutputSchemas, path: "/versions/output" };
const BOARD_PROTOCOL: Versioned = { ...pushBoardProtocolSchemas, path: "/version" };

// What the stop decision's schema cannot say without a combinator at its root.
const decisionProblems = ({ decision, message }: Record<string, unknown>): Problem[] => {
  if (decision === "block" && message === undefined) {
    return [{ path: "/message", message: "a block decision carries the push message" }];
  }
  if (decision === "allow" && message !== undefined) {
    return [{ path: "/message", message: "an allow decision carries no message" }];
  }
  return [];
};

/** Validates a local API message by its name, such as `recordsRequest` or `pollResponse`. */
export const validateLocalApi = <N extends LocalApiMessageName>(
  name: N,
  value: unknown,
): Checked<LocalApiMessages[N]> => {
  if (!Object.hasOwn(LOCAL_API_MESSAGES, name)) {
    throw new Error(`the local API has no message ${name}`);
  }
  const checked = validateStandalone<LocalApiMessages[N]>(
    LOCAL_API,
    LOCAL_API_MESSAGES[name],
    value,
  );
  if (!checked.ok || name !== "stopResponse") return checked;
  const problems = decisionProblems(checked.value as Record<string, unknown>);
  return problems.length === 0 ? checked : refused("schema", problems);
};

/** Validates a session file; its format's major first, at `/format`. */
export const validateSessionFile = (value: unknown): Checked<SessionFile> =>
  validateStandalone(SESSION_FILE, PUSH_SCHEMA_IDS.sessionFile, value);

/** Validates a push message; the output format's major first, at `/versions/output`. */
export const validatePushMessage = (value: unknown): Checked<PushMessage> =>
  validateStandalone(OUTPUT, PUSH_SCHEMA_IDS.pushMessage, value);

/** Validates a `closed` event, which, like every event, names no version of its own. */
export const validateClosedEvent = (value: unknown): Checked<ClosedEvent> =>
  validateStandalone(undefined, PUSH_SCHEMA_IDS.closedEvent, value);

/** Validates the board page's presence message; the board protocol's major first. */
export const validatePresence = (value: unknown): Checked<PresenceMessage> =>
  validateStandalone(BOARD_PROTOCOL, PUSH_SCHEMA_IDS.presence, value);

/** Validates `board-host`'s origin message; the board protocol's major first. */
export const validateOrigin = (value: unknown): Checked<OriginMessage> =>
  validateStandalone(BOARD_PROTOCOL, PUSH_SCHEMA_IDS.origin, value);

/** Validates `board-host`'s agent message; the board protocol's major first. */
export const validateAgentStatus = (value: unknown): Checked<AgentStatusMessage> =>
  validateStandalone(BOARD_PROTOCOL, PUSH_SCHEMA_IDS.agent, value);
