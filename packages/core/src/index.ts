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
  StopFit,
  StopOutcome,
  Timers,
  WhoAsked,
} from "./push/ports.ts";
export { UNKNOWN_VERSION_DIAGNOSTIC } from "./push/version.ts";

// Who asked, and where, and the agent status (E4, design decision 12): the expected-answerer rule
// of the context header and the background threshold.

export { backgroundThreshold } from "./push/agent-status.ts";
export { expectedAnswerer } from "./push/answerer.ts";
