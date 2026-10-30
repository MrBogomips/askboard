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
