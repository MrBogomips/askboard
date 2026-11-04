// Shared fixtures (`@askboard/contract/fixtures`): the interface both sides of E1 test against
// instead of each other's code (design decision 13). Tests only; no shipped unit imports them.

export { plainChoiceBoardDocument } from "./board-document.ts";
// The Gantt's fixtures (gantt-widget).
export {
  type GanttBoardDocument,
  type GanttPlanBoardDocument,
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
  ganttPlanChanges,
  ganttPlanDerived,
  ganttPlanEditedValue,
} from "./gantt.ts";
export {
  boardProtocolExamples,
  duplicateAnswerTranscript,
  notConnectFirstTranscript,
  PLAIN_CHOICE,
  plainChoiceTranscript,
  resendAfterDropTranscript,
  restartTranscript,
  schemaRefusalTranscript,
  type Transcript,
  type TranscriptStep,
  transcripts,
  versionRefusalTranscript,
} from "./transcript.ts";
// Widgets: the Tree's fixtures, the UJ-2 work breakdown (tree-widget design decision 4).
export {
  type TreeBoardDocument,
  treeAnswer,
  treeBoardDocument,
  treeEditedValue,
} from "./tree.ts";
export { fixtureViewFiles, fixtureViewManifest } from "./view-build.ts";

// E3, the ask lifecycle (ask-lifecycle, design decisions 2 and 8): the lifecycle ask's fixtures,
// its board-protocol messages and its transcripts, kept beside E1's `transcripts`.

export {
  LIFECYCLE,
  lifecycleAsk,
  lifecycleBoardDocument,
  lifecycleCollectResult,
  lifecycleDraftRecord,
  lifecycleFetchPage,
  lifecycleFetchResult,
  lifecycleUpdate,
  lifecycleUpdateResult,
} from "./lifecycle.ts";
export { lifecycleProtocolExamples } from "./lifecycle-messages.ts";
export {
  closedAskTranscript,
  type LifecycleTranscript,
  type LifecycleTranscriptStep,
  lifecycleTranscripts,
  restoredDraftTranscript,
  staleSubmitTranscript,
  submitTranscript,
  takeoverDraftTranscript,
} from "./lifecycle-transcripts.ts";

// Push delivery (E4): agent records, a teammate's included, the session file, push and stop
// messages, the pending asks, the closed event, and the board's presence, origin and agent messages.

export {
  agentFinishedEvent,
  fixturePendingAsks,
  fixturePollResponse,
  fixtureSessionFile,
  mainAgentRecord,
  plainChoicePushMessage,
  subagentOrigin,
  subagentRecord,
  subagentStopBlock,
  teammateOrigin,
  teammateRecord,
  uncheckedOrigin,
  waitingAgentStatus,
  workingPresence,
} from "./push-delivery.ts";

// Molecules (molecules, design decision 9): the UJ-2 question as the expansion gives it.

export {
  type TreePertItem,
  type Uj2ExpandedBoardDocument,
  type Uj2ExpandedQuestion,
  uj2ExpandedBoardDocument,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
  uj2ExpandedQuestion,
} from "./molecules.ts";

// Context, E5 (excerpts, design decision 2): a board document with every status of every context
// item type.

// Context, E5 (excerpts, design decisions 2 and 5): a board document with every status of every
// context item type, and the reading panel's recorded exchange.

export {
  type ContextBoardDocument,
  type ContextBoardQuestion,
  contextBoardDocument,
  ONE_PIXEL_PNG,
} from "./context.ts";
export {
  CONTEXT,
  type ContextBoardMessage,
  type ContextTranscript,
  type ContextTranscriptStep,
  contextProtocolExamples,
  contextWaiting,
  readingPanelTranscript,
} from "./context-transcripts.ts";

// Snapshots (E7, snapshot design decision 2): the Snapshot data of an agent's Snapshot of the
// lifecycle ask, the snapshot result naming its file, and the board protocol's Snapshot messages
// with their recorded exchange.

export { lifecycleSnapshotData, lifecycleSnapshotResult } from "./snapshot.ts";
export {
  closedAskSnapshotTranscript,
  discardSnapshotTranscript,
  type SnapshotTranscript,
  type SnapshotTranscriptStep,
  snapshotProtocolExamples,
  snapshotTranscript,
  snapshotTranscripts,
  takeoverSnapshotTranscript,
} from "./snapshot-transcripts.ts";
