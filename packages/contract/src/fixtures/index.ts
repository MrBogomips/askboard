// Shared fixtures (`@askboard/contract/fixtures`): the interface both sides of E1 test against
// instead of each other's code (design decision 13). Tests only; no shipped unit imports them.

export { plainChoiceBoardDocument } from "./board-document.ts";
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
