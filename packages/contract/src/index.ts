// The contract: AskBoard's versioned schema sets, ID rules and constants for every message that
// crosses a unit boundary at run time (AD-7). Validation lives in `@askboard/contract/validate`,
// so the board page, which cannot compile schemas, never loads Ajv.

export {
  ANSWER_EVENT_MAX_CHARS,
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
  DRAFT_RECORD_MAX_DEPTH,
  FETCH_PAGE_MAX_CHARS,
  FOLLOW_UP_MAX_CHARS,
  JSON_MAX_DEPTH,
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

// Context, E5 (excerpts, design decision 2): the pointer grammar, what resolving a pointer gives
// (the reasons it stays unresolved, the media types, a source's state) and the context limits of
// proposal B4, exported in one appended block.

// Context, E5 (excerpts, design decision 2): a question's context items in the input format, the
// pointer grammar, a web reference's URL rule, what resolving a pointer gives (the reasons it stays
// unresolved, the media types, a source's state), the context limits of proposal B4, the board
// document's resolved items, the reading panel's messages, the source view's route and policy, and
// the context items as `fetch` gives them, exported in one appended block.

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
} from "./context/limits.ts";
export {
  type InvalidPointer,
  type LineRange,
  type Pointer,
  type PointerAnchor,
  type PointerProblem,
  type PointerReading,
  readPointer,
} from "./context/pointer.ts";
export {
  EDITOR_OUTCOMES,
  type EditorOutcome,
  IMAGE_MEDIA_TYPES,
  type ImageMediaType,
  SOURCE_STATUSES,
  type SourceStatus,
  TEXT_MEDIA_TYPES,
  type TextMediaType,
  UNRESOLVED_REASONS,
  type UnresolvedReason,
} from "./context/resolution.ts";
export { type WebUrlProblem, webReferenceKind, webUrlProblem } from "./context/url.ts";
export { sourceViewPolicy } from "./hash.ts";
export { SOURCE_SCHEME_QUERY, sourcePath } from "./routes.ts";
export type {
  BoardContextItem,
  BoardExcerptProps,
  BoardImageProps,
  BoardQuestionItem,
  BoardQuestionProps,
  BoardReferenceProps,
  ContextLines,
} from "./schemas/board-document/index.ts";
export type {
  ContextHostMessage,
  ContextPageMessage,
  EditorOutcomeMessage,
  OpenEditorCommand,
  OpenSourceCommand,
  SourceStateMessage,
} from "./schemas/board-protocol/index.ts";
export type {
  ContextItem,
  ExcerptItem,
  ExcerptProps,
  ImageItem,
  ImageProps,
  MoleculeReferenceItem,
  QuestionContentItem,
  ReferenceItem,
  ReferenceProps,
  WidgetItem,
} from "./schemas/input/index.ts";
export type { FormulaWarning, UnresolvedPointerWarning } from "./schemas/output/index.ts";
export type {
  FetchContextItem,
  FetchExcerptProps,
  FetchImageProps,
  FetchQuestion,
  FetchQuestionProps,
} from "./schemas/tool-envelopes/index.ts";
// Settings and languages (E8, settings-languages design decision 2): the configuration set.
// Settings and languages (E8, settings-languages design decisions 2 and 13): the `.askboard/`
// folder and the configuration set.
// Settings and languages (E8, settings-languages design decisions 2, 8 and 13): the locale
// formats, the `.askboard/` folder and the configuration set.
// Settings and languages (E8, settings-languages design decisions 2, 8, 12 and 13): the locale
// formats, the `.askboard/` folder, the asking rule's references and the configuration set.
// Settings and languages (E8, settings-languages design decisions 2, 7, 8, 12 and 13): the locale
// formats, a board's language, the `.askboard/` folder, the asking rule's references and the configuration set.
// Settings and languages (E8, settings-languages design decisions 2, 6, 7, 8, 12 and 13): the
// locale formats, a board's language, the `.askboard/` folder, the asking rule's references, the
// configuration set and the board protocol's settings messages.

export {
  type AxisZoom,
  type BoardLanguage,
  type DateEntry,
  type DateRefusalCode,
  dateEcho,
  type FractionDigits,
  formatAxisLabel,
  formatDate,
  formatDateTime,
  formatGridDate,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTime,
  LOCALES,
  type Locale,
  languageOf,
  type NumberEntry,
  type NumberRefusalCode,
  numberEcho,
  parseDate,
  parseNumber,
  plainNumber,
} from "./locale/index.ts";

// Snapshots (E7, snapshot design decision 2): the Snapshot data set, the snapshot tool's envelopes,
// the board protocol's Snapshot messages, the file name and the JSON blocks' element IDs.

export type {
  SnapshotCommand,
  SnapshotFailedMessage,
  SnapshotReply,
  SnapshotSavedMessage,
} from "./schemas/board-protocol/index.ts";
export {
  SNAPSHOT_DATA_ID,
  SNAPSHOT_DATA_VERSION,
  type SnapshotData,
  type SnapshotEvent,
  type SnapshotExpansion,
  type SnapshotRecord,
  type SnapshotRender,
  type SnapshotRevision,
  snapshotDataSet,
} from "./schemas/snapshot-data/index.ts";
export type {
  SnapshotOutcomeResult,
  SnapshotRequest,
  SnapshotResult,
} from "./schemas/tool-envelopes/index.ts";
export {
  SNAPSHOT_DATA_ELEMENT,
  SNAPSHOT_LICENCES_ELEMENT,
  SNAPSHOT_NAME_PATTERN,
  SNAPSHOT_NAME_TRIES,
  SNAPSHOT_RANDOM,
} from "./snapshot/constants.ts";

// The `.askboard/` folder under the session project root (AD-14): E8's constants
// (settings-languages design decision 13), which E7 brings as the first of the two to land.

export {
  ASKBOARD_FOLDER,
  ASKBOARD_GITIGNORE,
  ASKBOARD_SUBFOLDERS,
  SNAPSHOT_FOLDER,
} from "./project-folder.ts";
export {
  hasReference,
  REFERENCE_PATTERNS,
  WITH_REFERENCES_DESCRIPTION,
} from "./push/references.ts";
export type {
  FileProblem,
  FileProblemCode,
  PresentationSetting,
  SettingCommand,
  SettingRow,
  SettingSource,
  SettingsFile,
  SettingsFileName,
  SettingsMessage,
  SettingsRows,
  SettingWarning,
  SettingWarningCode,
  WriteOutcome,
} from "./schemas/board-protocol/index.ts";
export {
  CONFIGURATION_DEFAULTS,
  CONFIGURATION_KEYS,
  CONFIGURATION_VERSION,
  type Configuration,
  type ConfigurationKey,
  type ConfigurationValues,
  type ContextPlacement,
  configurationSet,
  type Density,
  PRESENTATION_KEYS,
  type PresentationKey,
  type ThemePreference,
} from "./schemas/configuration/index.ts";

// Widget registry (widget-registry, design decisions 1 to 3): the registry of the widget types a
// question's items may hold, an entry's type and the registry's own check.

export {
  NON_WIDGET_ITEM_TYPES,
  type RegistryProblem,
  WIDGET_TYPES,
  type WidgetType,
  widgetTypeOf,
} from "./widgets/registry.ts";
export { widgetRegistryProblems } from "./widgets/registry-check.ts";

// Widget results (widget-registry, design decision 7): the generic result check and the
// annotation's own.

export type { Annotation, AnnotationSelector } from "./schemas/output/index.ts";
export { annotationProblems, widgetResultProblems } from "./widgets/results.ts";

// One definition of a result that holds nothing (widget-registry): shared by core, the registry's
// check and the board page.

export { resultHoldsNothing } from "./widgets/result-content.ts";

// Asking-rule texts (askboard-skills, design decision 6): one agent-facing text for each rule.

export { ASKING_RULE_TEXTS } from "./push/asking-rules.ts";

// Approval, Scale and Ranking (approval-scale-ranking, design decisions 1, 2 and 4): the three
// entries, which `WIDGET_TYPES` holds, their constants, the Approval's rule and the Scale's step
// arithmetic, and the check of what a result requires of its answer.

export {
  APPROVAL_DECISIONS,
  APPROVAL_SCHEMA_IDS,
  APPROVAL_WIDGET,
  type ApprovalDecision,
  type ApprovalItem,
  type ApprovalResult,
  approvalAnswerProblems,
  approvalNeedsReason,
  approvalResultShape,
  noteHoldsReason,
} from "./widgets/approval/index.ts";
export {
  RANKING_MAX_ITEMS,
  RANKING_MIN_ITEMS,
  RANKING_SCHEMA_IDS,
  RANKING_WIDGET,
  type RankingElement,
  type RankingItem,
  type RankingProps,
  type RankingResult,
  rankingPropsProblems,
  rankingResultProblems,
  rankingResultShape,
} from "./widgets/ranking/index.ts";
export type { WidgetAnswer } from "./widgets/registry.ts";
export { widgetAnswerProblems } from "./widgets/results.ts";
export {
  SCALE_DEFAULT_STEP,
  SCALE_DISPLAYS,
  SCALE_MAX_STEPS,
  SCALE_RATING_MAX_VALUES,
  SCALE_SCHEMA_IDS,
  SCALE_WIDGET,
  type ScaleItem,
  type ScaleProps,
  type ScaleResult,
  scalePropsProblems,
  scaleResultProblems,
  scaleResultShape,
  scaleStepCount,
  scaleStepIndex,
} from "./widgets/scale/index.ts";

// A result against the props it would be answered for (approval-scale-ranking, pre-PR reviews):
// the type's own checks alone, with no schema, for the board page's draft.

export { widgetResultFits } from "./widgets/result-fits.ts";

// The whole-field shape of the generic diff (latex-kanban-timeline, design decision 2).

export type { FieldsShape } from "./widgets/element-diff.ts";

// Changes checked against their type (latex-kanban-timeline, design decision 6).

export { widgetChangesProblems } from "./widgets/results.ts";

// LaTeX, Kanban and Timeline (latex-kanban-timeline, design decisions 1 and 3 to 5): the entries,
// with their constants and checks; the three are in `WIDGET_TYPES`.

export {
  KANBAN_CARD_DESCRIPTION_MAX_CHARS,
  KANBAN_CARD_LABEL_MAX_CHARS,
  KANBAN_COLUMN_LABEL_MAX_CHARS,
  KANBAN_MAX_CARDS,
  KANBAN_MAX_COLUMNS,
  KANBAN_MIN_CARDS,
  KANBAN_MIN_COLUMNS,
  KANBAN_SCHEMA_IDS,
  KANBAN_SHAPE,
  KANBAN_WIDGET,
  type KanbanCard,
  type KanbanChange,
  type KanbanColumn,
  type KanbanItem,
  type KanbanProps,
  kanbanPropsProblems,
} from "./widgets/kanban/index.ts";
export {
  cutLatexExpression,
  LATEX_DEFINING_COMMANDS,
  LATEX_EXPRESSION_MAX_CHARS,
  LATEX_INFIX_COMMANDS,
  LATEX_LEVEL_CLOSERS,
  LATEX_LEVEL_OPENERS,
  LATEX_NESTING_MAX_DEPTH,
  LATEX_RAW_TOKEN_COMMANDS,
  LATEX_SCHEMA_IDS,
  LATEX_SHAPE,
  LATEX_WIDGET,
  type LatexChange,
  type LatexItem,
  type LatexProps,
  type LatexScan,
  latexPropsProblems,
  scanLatex,
} from "./widgets/latex/index.ts";
export {
  TIMELINE_ENTRY_LABEL_MAX_CHARS,
  TIMELINE_LANE_LABEL_MAX_CHARS,
  TIMELINE_MAX_ENTRIES,
  TIMELINE_MAX_LANES,
  TIMELINE_MIN_ENTRIES,
  TIMELINE_MIN_LANES,
  TIMELINE_SCHEMA_IDS,
  TIMELINE_SHAPE,
  TIMELINE_WIDGET,
  type TimelineChange,
  type TimelineChangeField,
  type TimelineEntry,
  type TimelineItem,
  type TimelineLane,
  type TimelineProps,
  timelinePropsProblems,
} from "./widgets/timeline/index.ts";

// The Chart (chart-widget, design decision 1): its entry, which `WIDGET_TYPES` holds once
// registered, its constants, its props and result checks and its types.

export {
  CHART_HIGHLIGHTS,
  CHART_KINDS,
  CHART_LABEL_MAX_CHARS,
  CHART_MAX_CATEGORIES,
  CHART_MAX_POINTS,
  CHART_MAX_SERIES,
  CHART_PIE_MAX_SLICES,
  CHART_SCHEMA_IDS,
  CHART_TITLE_MAX_CHARS,
  CHART_UNIT_MAX_CHARS,
  CHART_VALUE_LIMIT,
  CHART_WIDGET,
  type ChartCategory,
  type ChartHighlights,
  type ChartItem,
  type ChartKind,
  type ChartPoint,
  type ChartProps,
  type ChartResult,
  type ChartSeries,
  chartPropsProblems,
  chartResultProblems,
  chartResultShape,
} from "./widgets/chart/index.ts";

// The amount entry (atoms, design decision 2): the MoneyField's parser, echo and comparison.

export {
  AMOUNT_MAX_INTEGER_DIGITS,
  AMOUNT_PATTERN,
  type AmountEntry,
  type AmountRefusalCode,
  amountEcho,
  compareDecimal,
  minorUnitsOf,
  parseAmount,
} from "./locale/index.ts";

// The display atoms (atoms, design decision 1): the Text, the Value and the Divider, unregistered
// until their chunks exist, and what the atoms share.

export {
  DIVIDER_SCHEMA_IDS,
  DIVIDER_WIDGET,
  type DividerItem,
  type DividerProps,
  dividerPropsProblems,
} from "./widgets/divider/index.ts";
export {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  ATOM_NUMBER_BOUND,
  ATOM_UNIT_MAX_CHARS,
  codePointCount,
} from "./widgets/shared/atoms.ts";
export {
  TEXT_FORMATS,
  TEXT_MAX_CHARS,
  TEXT_SCHEMA_IDS,
  TEXT_WIDGET,
  type TextItem,
  type TextProps,
  textPropsProblems,
} from "./widgets/text/index.ts";
export {
  VALUE_FIELDS,
  VALUE_KIND_FIELDS,
  VALUE_KINDS,
  VALUE_MAX_DAYS,
  VALUE_REQUIRED_FIELDS,
  VALUE_SCHEMA_IDS,
  VALUE_WIDGET,
  type ValueItem,
  type ValueKind,
  type ValueProps,
  valuePropsProblems,
} from "./widgets/value/index.ts";

// The TextField and the Toggle (atoms, design decision 1), unregistered until their chunks exist.

export {
  TEXT_FIELD_MAX_CHARS,
  TEXT_FIELD_SCHEMA_IDS,
  TEXT_FIELD_WIDGET,
  type TextFieldItem,
  type TextFieldProps,
  type TextFieldResult,
  textFieldPropsProblems,
  textFieldResultProblems,
  textFieldResultShape,
} from "./widgets/text-field/index.ts";
export {
  TOGGLE_SCHEMA_IDS,
  TOGGLE_WIDGET,
  type ToggleItem,
  type ToggleProps,
  type ToggleResult,
  togglePropsProblems,
  toggleResultShape,
} from "./widgets/toggle/index.ts";

// The NumberField and the DateField (atoms, design decision 1), unregistered until their chunks
// exist.

export {
  DATE_FIELD_SCHEMA_IDS,
  DATE_FIELD_WIDGET,
  type DateFieldItem,
  type DateFieldProps,
  type DateFieldResult,
  dateFieldPropsProblems,
  dateFieldResultProblems,
  dateFieldResultShape,
} from "./widgets/date-field/index.ts";
export {
  NUMBER_FIELD_SCHEMA_IDS,
  NUMBER_FIELD_STEP_MAX,
  NUMBER_FIELD_WIDGET,
  type NumberFieldItem,
  type NumberFieldProps,
  type NumberFieldResult,
  numberFieldPropsProblems,
  numberFieldResultProblems,
  numberFieldResultShape,
} from "./widgets/number-field/index.ts";

// The MoneyField (atoms, design decisions 1 and 2), unregistered until its chunk exists.

export {
  MONEY_FIELD_MAX_CURRENCIES,
  MONEY_FIELD_MIN_CURRENCIES,
  MONEY_FIELD_SCHEMA_IDS,
  MONEY_FIELD_WIDGET,
  type MoneyFieldItem,
  type MoneyFieldProps,
  type MoneyFieldResult,
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  moneyFieldResultShape,
} from "./widgets/money-field/index.ts";

// The draft record's entries (atoms, design decision 3): the longest text an input atom keeps
// that gives no value.

export { ENTRY_MAX_CHARS } from "./lifecycle-constants.ts";

// The calendar's names (atoms, task 5.5): a locale's table, whose month and weekday names the
// DateField's calendar draws in the ask's language.

export { type LocaleTable, tableOf } from "./locale/index.ts";

// The one check of a Markdown link's URL (atoms, task 5.9): the view's anchors and the board page's
// opening both call it.

export { isLinkUrl, LINK_URL_MAX_CHARS } from "./link-url.ts";

// The walker of layouts (layouts, design decision 2): which items a layout holds, and every item
// of a question at every depth.

export {
  isLayoutType,
  LAYOUT_MAX_DEPTH,
  LAYOUT_TYPES,
  type LayoutDepthProblem,
  type LayoutList,
  type LayoutType,
  layoutDepthProblem,
  layoutListsOf,
  mapNestedItems,
  type NestedItem,
  nestedItemsOf,
} from "./nested-items.ts";

// The four layouts (layouts, design decisions 1 and 3), unregistered until their components exist:
// each entry with its limits and checks, and the union their props hold.

export {
  GROUP_DESCRIPTION_MAX_CHARS,
  GROUP_MIN_ITEMS,
  GROUP_SCHEMA_IDS,
  GROUP_TITLE_MAX_CHARS,
  GROUP_WIDGET,
  type GroupItem,
  type GroupProps,
} from "./widgets/group/index.ts";
export { questionPropsOver } from "./widgets/registry-ajv.ts";
export {
  ROW_MAX_ITEMS,
  ROW_MAX_WEIGHT,
  ROW_MIN_ITEMS,
  ROW_MIN_WEIGHT,
  ROW_SCHEMA_IDS,
  ROW_WIDGET,
  type RowItem,
  type RowProps,
  rowPropsProblems,
} from "./widgets/row/index.ts";
export {
  LAYOUT_ITEM_DEFINITION,
  LAYOUT_ITEM_REF,
  type LayoutChild,
} from "./widgets/shared/layouts.ts";
export {
  STACK_MIN_ITEMS,
  STACK_SCHEMA_IDS,
  STACK_WIDGET,
  type StackItem,
  type StackProps,
} from "./widgets/stack/index.ts";
export {
  TABS_MAX_TABS,
  TABS_MIN_TABS,
  TABS_SCHEMA_IDS,
  TABS_TITLE_MAX_CHARS,
  TABS_WIDGET,
  type Tab,
  type TabsItem,
  type TabsProps,
  tabsPropsProblems,
} from "./widgets/tabs/index.ts";

// The safe subset of a TextField's pattern (form-widget, design decision 3): the one-pass check
// `ask` and `update` run, and its limits.

export {
  PATTERN_MAX_CHARS,
  PATTERN_MAX_REPEATS,
  PATTERN_TEXT_MAX_CHARS,
  patternProblem,
} from "./widgets/shared/pattern.ts";

// The field checks of the input fields (form-widget, design decision 2): the failure a value can
// have, `required` and the TextField's length and pattern, and the check through the registry.

export { dateFieldFieldCheck } from "./widgets/date-field/checks.ts";
export {
  type FieldCheckFailure,
  fieldCheckMessage,
  fieldCheckProp,
  requiredFailure,
  requiredPropProblems,
} from "./widgets/field-checks.ts";
export { moneyFieldFieldCheck } from "./widgets/money-field/checks.ts";
export { numberFieldFieldCheck } from "./widgets/number-field/checks.ts";
export {
  patternRunCount,
  textFieldFieldCheck,
  textFieldLimit,
  textFieldPatternFailure,
} from "./widgets/text-field/checks.ts";
export { toggleFieldCheck } from "./widgets/toggle/checks.ts";
export { widgetFieldCheck } from "./widgets/widget-field-check.ts";

// The PickField (form-widget, design decision 4), unregistered until its component's chunk exists:
// its entry with its limits and checks.

export {
  PICK_FIELD_MAX_OPTIONS,
  PICK_FIELD_MIN_OPTIONS,
  PICK_FIELD_SCHEMA_IDS,
  PICK_FIELD_WIDGET,
  PICK_FILTER_OVER,
  type PickFieldItem,
  type PickFieldProps,
  type PickFieldResult,
  type PickOption,
  pickFieldFieldCheck,
  pickFieldPropsProblems,
  pickFieldResultProblems,
  pickFieldResultShape,
} from "./widgets/pick-field/index.ts";

// The annotation's suggested edit (document-review, design decision 2): the longest replacement.

export { ANNOTATION_REPLACEMENT_MAX_CHARS } from "./lifecycle-limits.ts";

// The Document review (document-review, design decision 1), unregistered until its component's
// chunk exists: its entry with its limits and checks, and the one list of escaped characters its
// document is checked by.

export { isEscapedCodePoint } from "./push/notice-text.ts";
export {
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  DOCUMENT_REVIEW_MAX_CHARS,
  DOCUMENT_REVIEW_SCHEMA_IDS,
  DOCUMENT_REVIEW_TITLE_MAX_CHARS,
  DOCUMENT_REVIEW_WIDGET,
  type DocumentReviewAnnotation,
  type DocumentReviewItem,
  type DocumentReviewProps,
  type DocumentReviewQuote,
  type DocumentReviewResult,
  documentReviewPropsProblems,
  documentReviewResultProblems,
  documentReviewResultShape,
} from "./widgets/document-review/index.ts";
