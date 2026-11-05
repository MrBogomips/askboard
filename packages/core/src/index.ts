// ask-core: asks, epochs, event logs, cursors, answers and ask states (AD-3, AD-10). It imports
// only `contract` and uses no DOM, Node-only or Bun-only API (AD-1).

// The ask lifecycle (ask-lifecycle, design decision 3): acts, updates, and what the board shows.
export type {
  ActCommandInput,
  ActOutcome,
  AnswerCommandInput,
  AnswerOutcome,
  AnswerRefusal,
  AskSummary,
  BoardView,
  FullValue,
  LoggedAnswerView,
  QuestionView,
} from "./ask.ts";
export { canonicalize } from "./canonical.ts";
export type { CloseOutcome, UpdateOutcome } from "./core.ts";
export {
  AskCore,
  type AskOutcome,
  type CoreEvent,
  type Listener,
  type ReadOutcome,
  UNKNOWN_USER,
} from "./core.ts";
export type { ActRefusal } from "./lifecycle/acts.ts";
export type { UpdateRefusal } from "./lifecycle/updates.ts";
export type {
  AnswerView,
  KeptRevision,
  KeptRevisions,
  LifecycleBoardView,
  LifecycleQuestionView,
  ThreadView,
} from "./lifecycle/views.ts";
export type { Clock } from "./ports.ts";
export {
  type BoardAddress,
  BoardSetupError,
  type BoardShowing,
  type CorePorts,
  type Identity,
  type Randomness,
  type Report,
  type Showing,
} from "./ports.ts";
export { cursorOf, deriveTitle, EPOCH_LENGTH, isRealUtcTime, parseCursor } from "./text.ts";

// Push delivery (E4, design decisions 4 and 5): its ports, what its commands return, and the
// version gate's diagnostic.

export type {
  AgentRecords,
  AskOverview,
  Binding,
  CallIdentity,
  ClientVersionSource,
  DeliveredOutcome,
  Diagnose,
  HeaderPorts,
  Notice,
  Notices,
  Origin,
  OwnerRefusal,
  PushAskOutcome,
  PushReadOutcome,
  StopAsk,
  StopBlock,
  StopCandidates,
  StopEnd,
  StopFit,
  StopOutcome,
  WhoAsked,
} from "./push/ports.ts";
export { UNKNOWN_VERSION_DIAGNOSTIC } from "./push/version.ts";

// Who asked, and where, and the agent status (E4, design decision 12): the expected-answerer rule
// of the context header and the background threshold.

export { backgroundThreshold } from "./push/agent-status.ts";
export { expectedAnswerer } from "./push/answerer.ts";

// Molecules (molecules): the fill forms of the definition format.

// Molecules (molecules): the fill forms of the definition format, the expansion map and
// reference addressing.

// Molecules (molecules): expanding molecule references through the MoleculeSource port, the fill
// forms of the definition format, the expansion map and reference addressing.

export {
  type AddressedAnswer,
  answerInReferenceAddressing,
  type ReferenceAddressing,
  referenceAddressing,
} from "./molecules/addressing.ts";
export {
  type Expansion,
  type ExpansionProblem,
  expandMolecules,
} from "./molecules/expand.ts";
export { type ExpandedIds, type Filled, fillItem } from "./molecules/fills.ts";
export {
  type ExpansionEntry,
  type ExpansionMap,
  type ExpansionRecord,
  expansionEntries,
} from "./molecules/map.ts";
export type { MoleculeLookup, MoleculeSource } from "./molecules/source.ts";

// Context, E5 (excerpts, design decisions 3 and 4): the SourceFiles port, exported in one appended
// block.

export type {
  EditorTarget,
  ExcerptResolution,
  ImageResolution,
  ReferenceResolution,
  SourceFiles,
  SourceState,
  SourceText,
  SourceUnavailable,
  UnresolvedPointer,
} from "./context/ports.ts";
export { rootOf } from "./context/root.ts";
export type { EditorLaunchTarget, Source } from "./context/source.ts";
// Settings and languages (E8, settings-languages design decisions 3 and 4): the configuration's
// port and the settings in effect.
// Settings and languages (E8, settings-languages design decisions 3, 4 and 6): the configuration's
// port, the settings in effect and the view a board receives.

export type {
  Config,
  FileRead,
  FolderResult,
  RefusalCode,
  Replace,
  WriteResult,
} from "./config/ports.ts";
export type { EffectiveValues, SettingsInEffect } from "./config/settings.ts";
export type { SettingsView } from "./config/view.ts";

// Snapshots (E7, snapshot design decision 3): the port `snapshot` implements, and its error.

// Snapshots (E7, snapshot design decision 3): the port `snapshot` implements, its error, E7's
// `CorePorts` field, and the `snapshot` command's request and outcomes.

export type { SnapshotOutcome, SnapshotRequester } from "./snapshot/command.ts";
export {
  PROJECT_ROOT_VARIABLE,
  SNAPSHOT_NO_PROJECT_ROOT,
  type SnapshotPorts,
  SnapshotWriteError,
  type SnapshotWriter,
} from "./snapshot/writer.ts";
