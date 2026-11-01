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
// Widgets: the Gantt (gantt-widget).
export {
  type GanttOrigin,
  ganttChangesProblems,
  ganttPlanLinkProblems,
  ganttPropsProblems,
} from "./widgets/gantt/checks.ts";
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

// Push delivery (E4, design decision 1): its standalone schemas, which are in no set, and their
// types and IDs; its constants, the session folder's paths and the asking rules.

export { ASKING_RULES, type AskingRule } from "./push/asking-rules.ts";
export {
  BACKGROUND_THRESHOLD_DEFAULT_MS,
  BACKGROUND_THRESHOLD_VARIABLE,
  CLAUDE_CODE_CLIENT_NAME,
  CLAUDE_CODE_MINIMUM,
  HOOK_REQUEST_TIMEOUT_MS,
  LOCAL_API_HOST,
  LOCAL_API_MAX_BYTES,
  LOCAL_API_QUERY,
  LOCAL_API_ROUTES,
  NOTICE_TEXT_MAX_CHARS,
  noticePath,
  POLL_INTERVAL_MS,
  type PollContinuation,
  pollPath,
  RECORD_HOLD_MS,
  RECORD_TIMEOUT_MS,
  RECORDS_HELD_MAX,
  SESSION_TOKEN_BYTES,
  SESSION_TOKEN_HEADER,
  SOCKET_PATH_MAX_BYTES,
  TEAMMATE_NAME_MAX_CHARS,
  WORKING_WINDOW_MS,
} from "./push/constants.ts";
export {
  type AgentRecord,
  type AskNotice,
  type DeliveryReport,
  type EffectiveRule,
  LOCAL_API_MESSAGES,
  LOCAL_API_VERSION,
  type LocalApiAck,
  type LocalApiMessageName,
  type LocalApiMessages,
  type ModHello,
  type PendingAsk,
  type PolledAsk,
  type PolledEvent,
  type PollResponse,
  type StopDecision,
  type StopRequest,
  type TurnReport,
} from "./push/local-api/index.ts";
export {
  type AgentStatus,
  type AgentStatusMessage,
  type ClosedEvent,
  type OpenAsk,
  type OriginMessage,
  type PresenceMessage,
  PUSH_MESSAGE_PREFACE,
  type PushMessage,
  pushMessageText,
} from "./push/messages.ts";
export { PUSH_HOST_MESSAGES, PUSH_SCHEMA_IDS, PUSH_SCHEMAS } from "./push/schemas.ts";
export { SESSION_FILE_FORMAT, type SessionFile } from "./push/session-file/index.ts";
export {
  type SessionEnvironment,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
  socketPathProblem,
} from "./push/session-folder.ts";

// Push delivery (E4): agent text as a notice shows it, for the notifier, the hooks and the mod.

export { type AgentTextRun, agentTextPiece, agentTextRuns } from "./push/notice-text.ts";

// Push delivery (E4): who asked and where, the context header's first row, for board-host and
// ask-core alike.

export { originMessage, type WhoAskedFields } from "./push/origin-message.ts";

// Molecules (molecules): the reference and definition formats, their checks and JSON Pointers.

// Molecules (molecules): the reference and definition formats, their checks and JSON Pointers,
// and the Tree's PERT.

export { moleculeDefinitionProblems } from "./molecules/checks.ts";
export {
  EXPANDED_ID_SEPARATOR,
  expandedItemId,
  MOLECULE_FORMAT_VERSION,
  MOLECULE_FORMATS_SUPPORTED,
  MOLECULE_NAME_PATTERN,
  MOLECULE_VERSION_PATTERN,
  type MoleculeDefinition,
  type MoleculeFill,
  type MoleculeFillForm,
  type MoleculeItem,
  type MoleculeProps,
} from "./molecules/index.ts";
export { type Located, pointerOf, pointerTokens, valueAt } from "./molecules/pointer.ts";
export {
  TREE_PERT_ANSWER_DERIVED,
  TREE_PERT_DERIVED,
  TREE_PERT_MAX_ESTIMATE,
  type TreePertProps,
  treeDerivedFields,
} from "./widgets/tree/index.ts";

// Context, E5 (excerpts, design decision 2): the pointer grammar, the reasons a pointer stays
// unresolved and the context limits of proposal B4, exported in one appended block.

export {
  type InvalidPointer,
  type LineRange,
  type Pointer,
  type PointerAnchor,
  type PointerProblem,
  type PointerReading,
  readPointer,
} from "./context/pointer.ts";
export { UNRESOLVED_REASONS, type UnresolvedReason } from "./context/resolution.ts";
export {
  ANCHOR_FILE_MAX_BYTES,
  ASK_IMAGES_MAX_BYTES,
  CONTEXT_READS_MAX,
  CONTEXT_RESOLVE_BUDGET_MS,
  CONTEXT_TITLE_MAX_CHARS,
  EXCERPT_MAX_BYTES,
  EXCERPT_MAX_LINES,
  IMAGE_ALT_MAX_CHARS,
  IMAGE_MAX_BYTES,
  POINTER_MAX_CHARS,
  SOURCE_VIEW_MAX_BYTES,
  SOURCE_VIEW_MAX_LINES,
  URL_MAX_CHARS,
} from "./limits.ts";
