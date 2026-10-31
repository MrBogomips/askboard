// The contract: AskBoard's versioned schema sets, ID rules and constants for every message that
// crosses a unit boundary at run time (AD-7). Validation lives in `@askboard/contract/validate`,
// so the board page, which cannot compile schemas, never loads Ajv.

export {
  ASK_TITLE_MAX_CHARS,
  BOARD_CLOSE_CODES,
  BOARD_HOST,
  BOARD_PORT_RANGE,
  BOARD_TOKEN_BYTES,
  BOARD_TOKEN_MAX_CHARS,
  BOARD_TOKEN_MIN_BITS,
  BOARD_TOKEN_PATTERN,
  type BoardCloseCode,
  COLLECT_MAX_WAIT_MS,
  COLLECT_PROGRESS_INTERVAL_MS,
  ERROR_TEXT_MAX_CHARS,
  ID_PATTERN,
  REFUSAL_DETAIL_MAX_CHARS,
  RESULT_MAX_CHARS,
  TITLE_MAX_CHARS,
  UTC_TIME_PATTERN,
  VIEW_DIRECTORY,
  VIEW_ID_PREFIX,
  VIEW_MANIFEST_FILE,
} from "./constants.ts";
// The formula language (AD-13): grammar, whitelist, limits and error kinds.
export {
  BINARY_OPERATOR_PRECEDENCE,
  type BinaryOperator,
  CELL_PATTERN,
  FIELD_NAME_PATTERN,
  FORMULA_ERROR_KINDS,
  FORMULA_FUNCTIONS,
  FORMULA_MAX_CHARS,
  FORMULA_MAX_DEPTH,
  FORMULA_OPERATORS,
  type FormulaErrorKind,
  type FormulaFunction,
  type FormulaOperator,
  type FunctionName,
  isFieldName,
  parseCell,
  RANGE_MAX_CELLS,
  REFERENCE_WILDCARD,
  REFUSED_OPERATORS,
  SHEET_MAX_COLUMN,
  SHEET_MAX_ROW,
} from "./formula/index.ts";
export { boardPagePolicy, cspHashSource, SHA256_HEX_PATTERN } from "./hash.ts";
export {
  CHOICE_LABELS_MAX_CHARS,
  COLLECT_ASKS_MAX,
  CURSOR_PATTERN,
  EPOCH_PATTERN,
  NAME_MAX_CHARS,
} from "./limits.ts";
export {
  BOARD_RESPONSES,
  BOARD_ROUTES,
  BOARD_TOKEN_HEADER,
  BOARD_TOKEN_QUERY,
  type BoardRoute,
  boardLink,
  boardPath,
  chunkPath,
  manifestPath,
  parseBoardRoute,
  socketPath,
} from "./routes.ts";

export {
  BOARD_DOCUMENT_VERSION,
  type BoardDocument,
  type BoardQuestion,
  boardDocumentSet,
} from "./schemas/board-document/index.ts";
export {
  type AnswerCommand,
  BOARD_PROTOCOL_MESSAGES,
  BOARD_PROTOCOL_VERSION,
  type BoardMessage,
  type BoardMessageDirection,
  type BoardState,
  boardProtocol,
  type ConnectMessage,
  type DiscardedMessage,
  type HostMessage,
  type LoggedAnswer,
  type MovedMessage,
  type PageMessage,
  type QuestionStatus,
  type Receipt,
  type ReceiptMessage,
  type RefusalReason,
  type RefusedMessage,
  type StateMessage,
} from "./schemas/board-protocol/index.ts";
export {
  type AskInput,
  type ChoiceOption,
  INPUT_FORMAT_VERSION,
  inputFormat,
  type QuestionItem,
  type QuestionProps,
} from "./schemas/input/index.ts";
export {
  type AnswerEvent,
  type AskState,
  type Change,
  type DiscardedEvent,
  type DiscardReason,
  OUTPUT_FORMAT_VERSION,
  type Outcome,
  type OutputEvent,
  outputFormat,
  type UnavailableReason,
  type Warning,
} from "./schemas/output/index.ts";
export {
  type AskRequest,
  type AskResult,
  type AskUnavailableResult,
  type CollectAskEntry,
  type CollectRequest,
  type CollectResult,
  RESULT_VERSIONS,
  type ResultVersions,
  TOOL_DEFINITIONS,
  TOOL_ENVELOPES_VERSION,
  type ToolDefinition,
  toolEnvelopes,
} from "./schemas/tool-envelopes/index.ts";
export {
  type LicenceNotice,
  type ManifestChunk,
  type ManifestFile,
  VIEW_MANIFEST_VERSION,
  type ViewManifest,
  viewManifestSet,
} from "./schemas/view-manifest/index.ts";
export { SERVER_INSTRUCTIONS } from "./server-instructions.ts";
export { SCHEMA_IDS, SCHEMA_SETS } from "./sets.ts";
export {
  majorOf,
  SCHEMA_SET_OWNERS,
  type SchemaOwner,
  type SchemaSet,
  unsupportedVersion,
} from "./versions.ts";

// Widgets: the generic element diff (AD-20).
export {
  applyElementChanges,
  type ElementShape,
  elementChanges,
} from "./widgets/element-diff.ts";
// The Tree's contract (design decision 2): its checks, then its types, limits and element shape.
export { treeChangesProblems, treePropsProblems } from "./widgets/tree/checks.ts";
export {
  TREE_FIELD_PATTERN,
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_COLUMNS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_SHAPE,
  TREE_TEXT_MAX_CHARS,
  type TreeColumn,
  type TreeColumnType,
  type TreeFieldValue,
  type TreeItem,
  type TreeNode,
  type TreeOrigin,
  type TreeProps,
} from "./widgets/tree/index.ts";
export {
  type GanttOrigin,
  ganttChangesProblems,
  ganttPropsProblems,
} from "./widgets/gantt/checks.ts";
// Widgets: the Gantt (gantt-widget).
export {
  GANTT_ANSWER_DERIVED,
  GANTT_FIRST_DATE,
  GANTT_LABEL_MAX_CHARS,
  GANTT_LAST_DATE,
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
  GANTT_PLAN_ESTIMATES,
  GANTT_PLAN_SHAPE,
  GANTT_SCHEMA_IDS,
  GANTT_SHAPE,
  type GanttChange,
  type GanttItem,
  type GanttOwnTask,
  type GanttPlanEntry,
  type GanttProps,
  ganttChangesSchema,
  ganttPropsSchema,
  ganttShape,
} from "./widgets/gantt/index.ts";

// E3, the ask lifecycle: the 1.1 minors of the input format, the output format, the tool envelopes,
// the board document and the board protocol, and their constants and limits (ask-lifecycle, design
// decision 2), each exported beside E1's. E1's types above keep the shapes E1's units read where a
// 1.1 shape would change them; the `Lifecycle` types here are the full 1.1 shapes, which ask-core,
// board-host and the view move onto.

export {
  ACTION_ID_PATTERN,
  GRACE_PERIOD_MS,
  TAKEOVER_FLUSH_WAIT_MS,
} from "./lifecycle-constants.ts";
export {
  ANNOTATION_MAX_CHARS,
  DRAFT_RECORD_MAX_CHARS,
  FETCH_PAGE_MAX_CHARS,
  FOLLOW_UP_MAX_CHARS,
  NOTE_MAX_CHARS,
  OPTION_NOTE_MAX_CHARS,
  OTHER_MAX_CHARS,
  PREVIEW_MAX_CHARS,
  REPLY_MAX_CHARS,
} from "./lifecycle-limits.ts";
export type {
  BoardArea,
  BoardAreaProps,
  BoardItem,
  LifecycleBoardDocument,
} from "./schemas/board-document/index.ts";
export type {
  Act,
  ActCommand,
  AnswerAct,
  ClosedMessage,
  ClosedReason,
  CurrentAnswer,
  DeclineAct,
  DoneMessage,
  DraftMessage,
  DraftQuestion,
  DraftRecord,
  EditChoiceAct,
  FollowUpAct,
  HeldAct,
  LifecycleBoardMessage,
  LifecycleBoardState,
  LifecycleHostMessage,
  LifecyclePageMessage,
  LifecycleQuestionStatus,
  LifecycleStateMessage,
  NoteAct,
  PostponeAct,
  ReopenAct,
  ThreadEntry,
  ThreadReply,
} from "./schemas/board-protocol/index.ts";
export type {
  AddAction,
  AnswerAction,
  AreaItem,
  AreaProps,
  AskItem,
  ChangeAction,
  CloseAction,
  DeleteAction,
  LifecycleAskInput,
  ReopenAction,
  ReplyAction,
  UpdateAction,
  UpdateAnswer,
  UpdateInput,
} from "./schemas/input/index.ts";
export type {
  EditChoiceEvent,
  FollowUpEvent,
  NoteEvent,
  PostponedEvent,
  QuestionState,
  ReopenedEvent,
} from "./schemas/output/index.ts";
export type {
  AppliedAction,
  FetchAnswer,
  FetchItem,
  FetchOutcomeResult,
  FetchPage,
  FetchRequest,
  FetchResult,
  UpdateOutcomeResult,
  UpdateRequest,
  UpdateResult,
} from "./schemas/tool-envelopes/index.ts";
