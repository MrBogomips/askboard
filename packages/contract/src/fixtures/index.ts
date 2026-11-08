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
  ganttPlanRequestedChanges,
  ganttPlanRequestedDerived,
  ganttPlanRequestedValue,
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
// Settings and languages (E8): a configuration file with every key (settings-languages task 1.1).
// Settings and languages (E8): a configuration file with every key (settings-languages task 1.1),
// and the settings messages with their transcript (task 2.6).

export { everyKeyConfiguration } from "./configuration.ts";
export {
  type SettingsTranscriptStep,
  settingsProtocolExamples,
  settingsSaved,
  settingsTranscript,
  settingsWithEveryKey,
  themeSetting,
} from "./settings.ts";

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

// Widget answers (widget-answers, task 1.5): the UJ-2 ask's answer act, board states, fetch result,
// too-large event and recorded exchange.

export { widgetAnswerTranscript, widgetTranscripts } from "./lifecycle-transcripts.ts";
export {
  UJ2_SESSION,
  uj2WidgetActRefusal,
  uj2WidgetAnswerAct,
  uj2WidgetAnsweredState,
  uj2WidgetFetchResult,
  uj2WidgetRefusedAct,
  uj2WidgetTooLargeEvent,
  uj2WidgetWaitingState,
} from "./widget-answers.ts";

// Widget registry (widget-registry, design decision 2 and task 2.3): the test-only widget type, the
// registry that holds it and the fixtures of its results.

export {
  PROBE_SESSION,
  PROBE_TYPES,
  PROBE_WIDGET,
  probeAnswerEvent,
  probeBoardDocument,
  probeBoardState,
  probeDraftRecord,
  probeFetchItemResult,
  probeFetchResult,
  probeResultAct,
  probeSnapshotEntry,
  probeTooLargeEvent,
} from "./widget-registry.ts";

// Approval, Scale and Ranking (approval-scale-ranking, design decisions 1, 2 and 10): the helper
// that gives the registry the entries not yet in it, and the three types' items, results and answer.

export {
  APPROVAL_FIXTURE_ITEM,
  APPROVAL_RESULTS,
  approvalAct,
  approvalAnswerEvent,
  RANKING_FIXTURE_ITEM,
  RANKING_RESULT,
  RESULT_WIDGETS_RESULTS,
  RESULT_WIDGETS_SESSION,
  rankingFetchItemResult,
  resultWidgetsAct,
  resultWidgetsAnswerEvent,
  SCALE_FIXTURE_ITEMS,
  SCALE_RESULTS,
  withWidgetTypes,
} from "./approval-scale-ranking.ts";

// LaTeX, Kanban and Timeline (latex-kanban-timeline, design decisions 3 to 5): each type's items,
// the act that sends an edit, the event that logs it and the `fetch` of the item.

export {
  EDIT_WIDGETS_SESSION,
  KANBAN_CHANGES,
  KANBAN_EDITED_PROPS,
  KANBAN_FIXTURE_ITEM,
  kanbanAct,
  kanbanAnswerEvent,
  kanbanFetchItemResult,
  LATEX_CHANGES,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
  latexAct,
  latexAnswerEvent,
  latexFetchItemResult,
  NOT_A_WIDGET,
  TIMELINE_CHANGES,
  TIMELINE_EDITED_PROPS,
  TIMELINE_FIXTURE_ITEM,
  timelineAct,
  timelineAnswerEvent,
  timelineFetchItemResult,
} from "./latex-kanban-timeline.ts";

// The Chart (chart-widget, design decisions 1 and 10): its items, results, answer and fetch result.

export {
  CHART_ANSWER_RESULTS,
  CHART_FIXTURE_ITEMS,
  CHART_RESULTS,
  chartAct,
  chartAnswerEvent,
  chartFetchItemResult,
} from "./chart-widget.ts";

// The atoms (atoms, design decisions 1 and 10): the entries a test gives the registry through
// `withWidgetTypes`, and the display atoms' example items.

export {
  ATOM_TYPES,
  DATE_FIELD_FIXTURE_ITEMS,
  DATE_FIELD_RESULTS,
  DIVIDER_FIXTURE_ITEM,
  MONEY_FIELD_FIXTURE_ITEMS,
  MONEY_FIELD_RESULTS,
  NUMBER_FIELD_FIXTURE_ITEMS,
  NUMBER_FIELD_RESULTS,
  TEXT_FIELD_FIXTURE_ITEMS,
  TEXT_FIELD_RESULTS,
  TEXT_FIXTURE_ITEMS,
  TOGGLE_FIXTURE_ITEM,
  TOGGLE_RESULTS,
  VALUE_FIXTURE_ITEMS,
} from "./atoms.ts";

// URLs of Markdown links with their verdicts (atoms, task 5.9): the table the view's and the board
// page's link checks are both tested against.

export { LINK_URL_TABLE, LONGEST_LINK_URL } from "./link-urls.ts";

// The layouts' entries and a question arranged with them (layouts, task 1.2): what a test gives the
// shipped registry through `withWidgetTypes` while the layouts are not registered.

export { ARRANGED_ITEM, LAYOUT_WIDGETS } from "./layouts.ts";
