// Every schema set the contract holds (AD-7). A set added later joins this list, so the schema
// checks and the validator cover it.

import { boardDocumentSet } from "./schemas/board-document/index.ts";
import { BOARD_PROTOCOL_MESSAGES, boardProtocol } from "./schemas/board-protocol/index.ts";
import { inputFormat } from "./schemas/input/index.ts";
import { viewManifestSet } from "./schemas/view-manifest/index.ts";
import type { SchemaSet } from "./versions.ts";

export const SCHEMA_SETS: readonly SchemaSet[] = [
  inputFormat,
  boardDocumentSet,
  boardProtocol,
  viewManifestSet,
];

/** The `$id` of each schema that a unit validates against by name. */
export const SCHEMA_IDS = {
  id: "urn:askboard:input:id",
  questionProps: "urn:askboard:input:question-props",
  question: "urn:askboard:input:question",
  boardDocument: "urn:askboard:board-document:board-document",
  boardState: "urn:askboard:board-protocol:board-state",
  ...BOARD_PROTOCOL_MESSAGES.toHost,
  ...BOARD_PROTOCOL_MESSAGES.toPage,
  viewManifest: "urn:askboard:view-manifest:view-manifest",
} as const;
