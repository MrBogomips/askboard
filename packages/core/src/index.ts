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
  LoggedAnswerView,
  QuestionView,
} from "./ask.ts";
export { canonicalize } from "./canonical.ts";
export type { UpdateOutcome } from "./core.ts";
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
