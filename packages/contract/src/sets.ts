// Every schema set the contract holds (AD-7). A set added later joins this list, so the schema
// checks and the validator cover it.

import { boardDocumentSet } from "./schemas/board-document/index.ts";
import { BOARD_PROTOCOL_MESSAGES, boardProtocol } from "./schemas/board-protocol/index.ts";
import { configurationSet } from "./schemas/configuration/index.ts";
import { inputFormat } from "./schemas/input/index.ts";
import { outputFormat } from "./schemas/output/index.ts";
import { snapshotDataSet } from "./schemas/snapshot-data/index.ts";
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
  // E7 (snapshot, design decision 2): the Snapshot data set.
  snapshotDataSet,
  // settings-languages (E8): the configuration set (design decision 2).
  configurationSet,
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
  // E5's context items (excerpts, design decision 2).
  pointer: "urn:askboard:input:pointer",
  excerptProps: "urn:askboard:input:excerpt-props",
  referenceProps: "urn:askboard:input:reference-props",
  imageProps: "urn:askboard:input:image-props",
  boardExcerptProps: "urn:askboard:board-document:excerpt-props",
  boardReferenceProps: "urn:askboard:board-document:reference-props",
  boardImageProps: "urn:askboard:board-document:image-props",

  // E7's tool envelopes (snapshot, design decision 2).
  snapshotRequest: "urn:askboard:tool-envelopes:snapshot-request",
  snapshotResult: "urn:askboard:tool-envelopes:snapshot-result",
  snapshotOutcome: "urn:askboard:tool-envelopes:snapshot-outcome",
  // The widget and molecule schemas, set parts since widget-answers (design decision 3).
  treeProps: "urn:askboard:input:tree-props",
  treeChanges: "urn:askboard:output:tree-changes",
  ganttProps: "urn:askboard:input:gantt-props",
  ganttChanges: "urn:askboard:output:gantt-changes",
  moleculeProps: "urn:askboard:input:molecule-props",
  moleculeDefinition: "urn:askboard:input:molecule-definition",
  // settings-languages (E8): the configuration set (design decision 2).
  configuration: "urn:askboard:configuration:config",
  // widget-registry: the annotation widget results are made of (design decision 7).
  annotation: "urn:askboard:output:annotation",
} as const;
