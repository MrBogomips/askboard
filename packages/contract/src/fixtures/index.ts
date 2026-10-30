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
export { fixtureViewFiles, fixtureViewManifest } from "./view-build.ts";
