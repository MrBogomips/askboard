// Every standalone schema of push delivery, grouped as the sets they will join (design decision
// 1). No group is in `SCHEMA_SETS`; the follow-up that joins them moves each group there.

import type { SchemaSet } from "../versions.ts";
import { localApiSchemas } from "./local-api/index.ts";
import { pushBoardProtocolSchemas, pushOutputSchemas } from "./messages.ts";
import { sessionFileSchemas } from "./session-file/index.ts";

export const PUSH_SCHEMA_GROUPS: readonly SchemaSet[] = [
  localApiSchemas,
  sessionFileSchemas,
  pushOutputSchemas,
  pushBoardProtocolSchemas,
];

/**
 * The JSON schema objects, for a build that generates standalone validators: add them to an Ajv
 * made by `createAjv`, which holds E1's schemas they reference.
 */
export const PUSH_SCHEMAS: readonly object[] = PUSH_SCHEMA_GROUPS.flatMap((group) => group.schemas);

/** The `$id` of each standalone schema outside the local API. */
export const PUSH_SCHEMA_IDS = {
  sessionFile: "urn:askboard:session-file:session-file",
  pushMessage: "urn:askboard:output:push-message",
  closedEvent: "urn:askboard:output:closed-event",
  presence: "urn:askboard:board-protocol:presence",
  origin: "urn:askboard:board-protocol:origin",
  agent: "urn:askboard:board-protocol:agent",
} as const;

/**
 * The board protocol's host messages push delivery adds, by type, with their `$id`s, as E1's
 * `BOARD_PROTOCOL_MESSAGES.toPage` names its own: for the board page's validators (design decision
 * 12).
 */
export const PUSH_HOST_MESSAGES = {
  origin: PUSH_SCHEMA_IDS.origin,
  agent: PUSH_SCHEMA_IDS.agent,
} as const;
