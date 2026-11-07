import { describe, expect, expectTypeOf, test } from "bun:test";
import type * as Fixtures from "../src/fixtures/index.ts";
import * as fixtures from "../src/fixtures/index.ts";
import type * as Contract from "../src/index.ts";
import * as contract from "../src/index.ts";

// E3's public names, which live in their own modules and are exported from the package entries
// (`@askboard/contract` and `@askboard/contract/fixtures`) by statements appended after E1's
// (design decision 2). The lists hold every one, so a move between modules cannot drop a name.

const ENTRY_VALUES = [
  "ACTION_ID_PATTERN",
  "GRACE_PERIOD_MS",
  "TAKEOVER_FLUSH_WAIT_MS",
  "ANNOTATION_MAX_CHARS",
  "DRAFT_RECORD_MAX_CHARS",
  "FETCH_PAGE_MAX_CHARS",
  "FOLLOW_UP_MAX_CHARS",
  "JSON_MAX_DEPTH",
  "NOTE_MAX_CHARS",
  "OPTION_NOTE_MAX_CHARS",
  "OTHER_MAX_CHARS",
  "PREVIEW_MAX_CHARS",
  "REPLY_MAX_CHARS",
] as const;

// The typecheck fails on any name the entry stops exporting.
type EntryTypes = [
  Contract.BoardArea,
  Contract.BoardAreaProps,
  Contract.BoardItem,
  Contract.LifecycleBoardDocument,
  Contract.Act,
  Contract.ActCommand,
  Contract.AnswerAct,
  Contract.ClosedMessage,
  Contract.ClosedReason,
  Contract.CurrentAnswer,
  Contract.DeclineAct,
  Contract.DoneMessage,
  Contract.DraftMessage,
  Contract.DraftQuestion,
  Contract.DraftRecord,
  Contract.EditChoiceAct,
  Contract.FollowUpAct,
  Contract.HeldAct,
  Contract.LifecycleBoardMessage,
  Contract.LifecycleBoardState,
  Contract.LifecycleHostMessage,
  Contract.LifecyclePageMessage,
  Contract.LifecycleQuestionStatus,
  Contract.LifecycleStateMessage,
  Contract.NoteAct,
  Contract.PostponeAct,
  Contract.ReopenAct,
  Contract.ThreadEntry,
  Contract.ThreadReply,
  Contract.AddAction,
  Contract.AnswerAction,
  Contract.AreaItem,
  Contract.AreaProps,
  Contract.AskItem,
  Contract.ChangeAction,
  Contract.CloseAction,
  Contract.DeleteAction,
  Contract.LifecycleAskInput,
  Contract.ReopenAction,
  Contract.ReplyAction,
  Contract.UpdateAction,
  Contract.UpdateAnswer,
  Contract.UpdateInput,
  Contract.EditChoiceEvent,
  Contract.FollowUpEvent,
  Contract.NoteEvent,
  Contract.PostponedEvent,
  Contract.QuestionState,
  Contract.ReopenedEvent,
  Contract.AppliedAction,
  Contract.FetchAnswer,
  Contract.FetchItem,
  Contract.FetchOutcomeResult,
  Contract.FetchPage,
  Contract.FetchRequest,
  Contract.FetchResult,
  Contract.UpdateOutcomeResult,
  Contract.UpdateRequest,
  Contract.UpdateResult,
];

const FIXTURE_VALUES = [
  "LIFECYCLE",
  "lifecycleAsk",
  "lifecycleBoardDocument",
  "lifecycleCollectResult",
  "lifecycleDraftRecord",
  "lifecycleFetchPage",
  "lifecycleFetchResult",
  "lifecycleUpdate",
  "lifecycleUpdateResult",
  "lifecycleProtocolExamples",
  "closedAskTranscript",
  "lifecycleTranscripts",
  "restoredDraftTranscript",
  "staleSubmitTranscript",
  "submitTranscript",
  "takeoverDraftTranscript",
] as const;

// The typecheck fails on any name the fixtures entry stops exporting.
type FixtureTypes = [Fixtures.LifecycleTranscript, Fixtures.LifecycleTranscriptStep];

const missing = (module: object, names: readonly string[]) =>
  names.filter((name) => !Object.hasOwn(module, name));

describe("E3's names in the package entries", () => {
  test("@askboard/contract exports each of E3's constants and limits", () => {
    expect(missing(contract, ENTRY_VALUES)).toEqual([]);
  });

  test("@askboard/contract/fixtures exports each of E3's fixtures and transcripts", () => {
    expect(missing(fixtures, FIXTURE_VALUES)).toEqual([]);
  });

  test("both entries export each of E3's types", () => {
    expectTypeOf<EntryTypes>().toBeArray();
    expectTypeOf<FixtureTypes>().toBeArray();
  });
});
