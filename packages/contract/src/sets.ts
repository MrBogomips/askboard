// Every schema set the contract holds (AD-7). A set added later joins this list, so the schema
// checks and the validator cover it.

import { boardDocumentSet } from "./schemas/board-document/index.ts";
import { BOARD_PROTOCOL_MESSAGES, boardProtocol } from "./schemas/board-protocol/index.ts";
import { inputFormat } from "./schemas/input/index.ts";
import { outputFormat } from "./schemas/output/index.ts";
import { toolEnvelopes } from "./schemas/tool-envelopes/index.ts";
import { viewManifestSet } from "./schemas/view-manifest/index.ts";
import type { SchemaSet } from "./versions.ts";

export const SCHEMA_SETS: readonly SchemaSet[] = [
  inputFormat,
  outputFormat,
  toolEnvelopes,
  boardDocumentSet,
  boardProtocol,
  viewManifestSet,
];

/** The `$id` of each schema that a unit validates against by name. */
export const SCHEMA_IDS = {
  id: "urn:askboard:input:id",
  questionProps: "urn:askboard:input:question-props",
  question: "urn:askboard:input:question",
  ask: "urn:askboard:input:ask",
  epoch: "urn:askboard:output:epoch",
  cursor: "urn:askboard:output:cursor",
  answerEvent: "urn:askboard:output:answer-event",
  discardedEvent: "urn:askboard:output:discarded-event",
  warning: "urn:askboard:output:warning",
  outcome: "urn:askboard:output:outcome",
  unavailableReason: "urn:askboard:output:unavailable-reason",
  askRequest: "urn:askboard:tool-envelopes:ask-request",
  collectRequest: "urn:askboard:tool-envelopes:collect-request",
  askResult: "urn:askboard:tool-envelopes:ask-result",
  askUnavailable: "urn:askboard:tool-envelopes:ask-unavailable",
  collectResult: "urn:askboard:tool-envelopes:collect-result",
  boardDocument: "urn:askboard:board-document:board-document",
  boardState: "urn:askboard:board-protocol:board-state",
  ...BOARD_PROTOCOL_MESSAGES.toHost,
  ...BOARD_PROTOCOL_MESSAGES.toPage,
  viewManifest: "urn:askboard:view-manifest:view-manifest",
  // E3's schemas (ask-lifecycle, design decision 2); its board-protocol messages are above, by type.
  area: "urn:askboard:input:area",
  update: "urn:askboard:input:update",
  updateRequest: "urn:askboard:tool-envelopes:update-request",
  fetchRequest: "urn:askboard:tool-envelopes:fetch-request",
  askState: "urn:askboard:output:ask-state",
  questionState: "urn:askboard:output:question-state",
  postponedEvent: "urn:askboard:output:postponed-event",
  reopenedEvent: "urn:askboard:output:reopened-event",
  noteEvent: "urn:askboard:output:note-event",
  followUpEvent: "urn:askboard:output:follow-up-event",
  editChoiceEvent: "urn:askboard:output:edit-choice-event",
  updateResult: "urn:askboard:tool-envelopes:update-result",
  updateOutcome: "urn:askboard:tool-envelopes:update-outcome",
  fetchResult: "urn:askboard:tool-envelopes:fetch-result",
  fetchPage: "urn:askboard:tool-envelopes:fetch-page",
  fetchOutcome: "urn:askboard:tool-envelopes:fetch-outcome",
  draftRecord: "urn:askboard:board-protocol:draft-record",
  // Push delivery's closed event, in the output format's 1.1 since the ask lifecycle (task 14.5).
  closedEvent: "urn:askboard:output:closed-event",
} as const;
