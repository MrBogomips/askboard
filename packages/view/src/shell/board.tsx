// The board in the view (ask-lifecycle, design decision 6; EXPERIENCE.md, Board anatomy and
// Presentations): the context header, then the questions in the presentation the ask requests,
// beside the rail. One question is the single-question board, whatever the ask requests: the header
// with the title and the ask state, and one card, with no rail, count, jump, delivery switch or Send
// (FR-22). Two or more show their areas, or their questions as one group, as sections (the default)
// or tabs, or one question per view under the question navigator (FR-2), each beside the rail: the
// outline navigator over the outbox, with the delivery switch and Send (answering-flow-visual,
// design decisions 2 and 3). The feedback tray shows under the header (decision 11). There is no
// bottom action bar. Hidden tabs and hidden questions stay mounted, so
// that they report ready (AD-9). The question in view is the lifecycle draft's, so a reload or a
// takeover comes back to it (What a reload keeps); when the agent deletes it, one question per
// view says "Question removed by the agent" and shows the next one (task 6.7). It renders from the
// latest board document and what the board page last sent: the state, the lock, which makes the
// board read-only while it moved, once it is discarded or closed (AD-21, FR-6), and whether the
// connection is lost, which stops Submit. Later changes' stores come in one record, the shell's
// extras: the header also shows who asked and where and the agent status, from push delivery's
// store (design decision 12).

import { type LifecycleBoardState, QUESTION_NUMBER_MAX } from "@askboard/contract";
import { Tabs } from "radix-ui";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { questionTextId, useLanguage, useStrings } from "../catalog/port.ts";
import { IconAreaDone } from "../icons/index.ts";
import {
  areaOf,
  questionsOf,
  type ViewArea,
  type ViewDocument,
  type ViewQuestion,
} from "../view-document.ts";
import type { ViewLock } from "../view-protocol.ts";
import { changePending, type KeptChoices, readOnlyOfBoard, shownOfBoard } from "./agent-change.ts";
import type { AttentionSnapshot } from "./attention.ts";
import type { BoardDraftState } from "./board-draft.ts";
import { BoardHeader, type HeaderCounts } from "./board-header.tsx";
import { useBoardKeys } from "./board-keys-listener.ts";
import { useBoardPanel } from "./board-keys-panel.tsx";
import {
  askPillOf,
  endedOf,
  type Group,
  groupsOf,
  type Ladder,
  markOf,
  nextOpenFrom,
  openCountOf,
  openLabelOf,
  postponedCountOf,
  postponedWarningOf,
  presentationOf,
  previousOpenFrom,
  shownQuestionOf,
  tabOpenCount,
} from "./board-view.ts";
import { CARD_ACTS } from "./card-acts.ts";
import { entriesWithCells } from "./cell-entries.ts";
import { type Completion, completionOf, receiptCountsOf, shownCompletionOf } from "./completion.ts";
import { COMPLETION_HEADING, CompletionPanel } from "./completion-panel.tsx";
import { createDeliveredGate } from "./delivered-messages.ts";
import type { DraftStore } from "./draft-store.ts";
import { FeedbackTray } from "./feedback-tray.tsx";
import { goTargetOf, type Tray } from "./feedback-tray-store.ts";
import { createFlow, type Flow, type FlowView } from "./flow.ts";
import {
  allAnsweredMessagesOf,
  allReadyMessageOf,
  prefillUndoneMessageOf,
} from "./flow-messages.ts";
import { nextOfFlow } from "./guided-flow.ts";
import type { HeaderData } from "./header-data.ts";
import { type HeadingRequest, requestFocusTo, requestHeading } from "./heading-request.ts";
import type { HeldKeyGuard } from "./held-key-guard.ts";
import { ledgerOf } from "./ledger.ts";
import { type EntryMarks, Outline, QuestionNavigator } from "./navigators.tsx";
import { Outbox } from "./outbox.tsx";
import { outboxLineOf } from "./outbox-line.ts";
import type { PresentationControls } from "./presentation-controls.ts";
import { ProgressStrip } from "./progress-strip.tsx";
import { stripOf } from "./progress-strip-model.ts";
import { type CardContext, QuestionCard } from "./question-card.tsx";
import { numbersOf } from "./question-numbers.ts";
import { Rail } from "./rail.tsx";
import type { RemovedNumber } from "./removed-numbers.ts";
import { revealAndFocus } from "./reveal.ts";
import { revisingOfBoard } from "./revising.ts";
import { type SnapshotControl, snapshotOfferOf } from "./snapshot-control.ts";
import { SnapshotTopLine } from "./snapshot-top-line.tsx";
import type { StatusMessages } from "./status-messages.ts";
import { StatusRegion } from "./status-region.tsx";
import type { Store } from "./store.ts";
import { FOCUS_RING, INFO_BADGE } from "./styles.ts";
import {
  type PrefillBatch,
  prefillCountOf,
  releaseFailed,
  selectRecommended,
  submitStateOf,
  undoPrefill,
} from "./submit.ts";
import { useBoardKeyTable } from "./use-board-keys.ts";
import { useHeaderHeight } from "./use-header-height.ts";
import { useHeldKeyGuard } from "./use-held-key-guard.ts";
import { useQuestionInView } from "./use-question-in-view.ts";
import { useScrollPadding } from "./use-scroll-padding.ts";

/** What the board page last told the view, with the latest board document. */
export type BoardView = {
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
  readonly lock?: ViewLock | undefined;
  readonly connection?: "lost" | undefined;
};

type Shared = {
  /** The ladder's inputs, one for every surface of the board (answering-flow-guidance, decision 1). */
  readonly ladder: Ladder;
  /** What follows an act: the move or the footer (decision 3). */
  readonly flow: Flow;
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
  readonly lock: ViewLock | undefined;
  readonly draft: BoardDraftState;
  readonly context: CardContext;
  /** The questions' short numbers (design decision 6). */
  readonly numbers: ReadonlyMap<string, number>;
};

/** A request to move focus to a question's heading, numbered so that each runs once. */
/** What the board needs beyond the cards: focus moves and the removed-question line. */
export type BoardContext = CardContext & {
  readonly focus: Store<HeadingRequest | undefined>;
  /** The agent deleted the question in view, in one question per view (F-55). */
  readonly removed: Store<boolean>;
  /** What the board says to a screen reader (answering-flow-fixes, #182). */
  readonly status: StatusMessages;
  /** Keeps a held key's repeats from the card the board moved to (decision 3; NFR-10). */
  readonly guard: HeldKeyGuard;
  /** The numbers of the questions the agent removed while the page is open (design decision 6). */
  readonly removedNumbers: Store<readonly RemovedNumber[]>;
};

/**
 * The stores later changes add to the board, one member each, which the shell passes in one
 * literal (review M5).
 */
export type BoardExtras = {
  /** Who asked and where, and the agent status (push delivery, design decision 12). */
  readonly header: Store<HeaderData>;
  /** The quick toggles' presentation, and what they ask for (settings-languages, design 10). */
  readonly presentation: PresentationControls;
  /** The ask row's Snapshot (snapshot task 7.1). */
  readonly snapshot: SnapshotControl;
  /** The feedback tray's messages (answering-flow-visual, design decision 11). */
  readonly tray: Tray;
};

// Questions the agent changed under the user's work, made on an earlier revision, that wait for
// the user's choice (task 6.7).
const changedOf = (
  document: ViewDocument,
  draft: BoardDraftState,
  kept: KeptChoices,
): ReadonlySet<string> =>
  new Set(
    questionsOf(document)
      .filter((question) => changePending(question, draft.questions.get(question.id), kept))
      .map((question) => question.id),
  );

const Card = ({
  question,
  shared,
  level,
}: {
  readonly question: ViewQuestion;
  readonly shared: Shared;
  readonly level?: 2 | 3;
}) => (
  <QuestionCard
    question={question}
    state={shared.state}
    lock={shared.lock}
    delivery={presentationOf(shared.document) === "single" ? "immediate" : shared.draft.delivery}
    single={presentationOf(shared.document) === "single"}
    level={level ?? 2}
    context={shared.context}
    ladder={shared.ladder}
    flow={shared.flow}
    numbers={shared.numbers}
  />
);

const AREA_HEADING = "border-b border-border pb-1 text-body-lg font-semibold text-foreground";

// One area, or the board's questions when it has none, as a labelled section.
const Section = ({ group, shared }: { readonly group: Group; readonly shared: Shared }) => {
  const headingId = group.id === undefined ? undefined : `${group.id}:area`;
  return (
    <section
      aria-labelledby={headingId}
      data-askboard-area={group.id}
      className="flex flex-col gap-lg"
    >
      {group.title === undefined ? null : (
        <h2 id={headingId} className={AREA_HEADING}>
          {group.title}
        </h2>
      )}
      {group.questions.map((question) => (
        <Card
          key={question.id}
          question={question}
          shared={shared}
          level={group.title === undefined ? 2 : 3}
        />
      ))}
    </section>
  );
};

const TabsBody = ({
  groups,
  active,
  onActivate,
  shared,
  unseen,
}: {
  readonly groups: readonly Group[];
  readonly active: string;
  readonly onActivate: (areaId: string) => void;
  readonly shared: Shared;
  readonly unseen: ReadonlySet<string>;
}) => {
  const text = useStrings();
  const headerHeight = useHeaderHeight();
  return (
    <Tabs.Root value={active} onValueChange={onActivate} className="flex flex-col gap-lg">
      <Tabs.List
        aria-label={text("areas.label")}
        data-askboard-tab-strip=""
        style={{ top: headerHeight }}
        className="sticky z-[5] flex gap-1 overflow-x-auto border-b border-border bg-background"
      >
        {groups.map((group) => {
          const area = shared.document.items.find((item) => item.id === group.id) as ViewArea;
          const open = tabOpenCount(area, shared.state, shared.draft.questions, shared.ladder);
          const fresh = group.questions.some((question) => unseen.has(question.id));
          return (
            <Tabs.Trigger
              key={group.id}
              value={group.id ?? ""}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-md py-1.5 text-control text-muted-foreground data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary-text ${FOCUS_RING}`}
            >
              <span className="max-w-48 truncate" title={group.title}>
                {group.title}
              </span>
              {open === 0 ? (
                <>
                  <IconAreaDone data-askboard-tab-done="" className="size-3.5 shrink-0" />
                  <span className="sr-only">{text("areas.done")}</span>
                </>
              ) : (
                <span className="text-badge">{text("areas.open", { count: open })}</span>
              )}
              {fresh ? <span className={INFO_BADGE}>{text("mark.new")}</span> : null}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
      {groups.map((group) => (
        <Tabs.Content
          key={group.id}
          value={group.id ?? ""}
          forceMount
          className="flex flex-col gap-lg data-[state=inactive]:hidden"
        >
          {group.questions.map((question) => (
            <Card key={question.id} question={question} shared={shared} />
          ))}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};

const OneQuestionBody = ({
  questions,
  current,
  shared,
  navigator,
}: {
  readonly questions: readonly ViewQuestion[];
  readonly current: string;
  readonly shared: Shared;
  readonly navigator: ReactNode;
}) => (
  <div className="flex flex-col gap-md">
    {navigator}
    {questions.map((question) => {
      const area = areaOf(shared.document, question.id);
      return (
        <div key={question.id} hidden={question.id !== current} className="flex flex-col gap-md">
          {area === undefined ? null : <p className={AREA_HEADING}>{area.props.title}</p>}
          <Card question={question} shared={shared} />
        </div>
      );
    })}
  </div>
);

// How long a request for the completion panel's heading waits for the panel, in milliseconds.
const PANEL_WAIT_MS = 10_000;

// Focus moves to a question's heading once the navigation has rendered (Accessibility Floor), or to
// the send button; a request for the completion panel's heading waits until the panel shows (the
// receipts are logged then, decision 6) and is dropped when the user has moved focus off the card
// the act was taken on, so the move never takes a focus the user chose.
const useHeadingFocus = (focus: Store<HeadingRequest | undefined>, panelShown: boolean) => {
  const target = useSyncExternalStore(focus.subscribe, focus.get);
  const waiting = useRef<HeadingRequest | undefined>(undefined);
  useEffect(() => {
    if (target === undefined) return;
    if (target.to === "completion") {
      waiting.current = target;
      const timer = window.setTimeout(() => {
        if (waiting.current === target) waiting.current = undefined;
      }, PANEL_WAIT_MS);
      return () => window.clearTimeout(timer);
    }
    waiting.current = undefined;
    if (target.to === "send") {
      const send = document.querySelector("[data-askboard-submit]");
      if (send instanceof HTMLElement) revealAndFocus(send);
      return;
    }
    const heading = document.getElementById(questionTextId(target.id));
    if (heading !== null) revealAndFocus(heading, { smooth: target.smooth === true });
  }, [target]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `target` re-runs it when a request lands
  useEffect(() => {
    const request = waiting.current;
    if (request === undefined || !panelShown) return;
    waiting.current = undefined;
    const card = document
      .getElementById(questionTextId(request.id))
      ?.closest("[data-askboard-question]");
    const active = document.activeElement;
    const held = active === null || active === document.body || card?.contains(active) === true;
    const heading = document.querySelector(COMPLETION_HEADING);
    if (held && heading instanceof HTMLElement) revealAndFocus(heading);
  }, [panelShown, target]);
  return (id: string) => requestHeading(focus, id);
};

// Whether a question's card can take "Select recommended" now (AD-9, AD-10).
const takesSelection = (
  context: CardContext,
  question: ViewQuestion,
  draft: BoardDraftState,
  kept: KeptChoices,
  lock: ViewLock | undefined,
): boolean =>
  lock === undefined &&
  context.tracker.questionStatus(question.id) === "visible" &&
  context.acts.of(question.id, CARD_ACTS) === undefined &&
  !changePending(question, draft.questions.get(question.id), kept);

const NO_SUBSCRIBE = () => () => {};
const NO_REVISING_SET: () => ReadonlySet<string> = (() => {
  const none: ReadonlySet<string> = new Set();
  return () => none;
})();
const NO_RECORD = (() => {
  const none = new Map();
  return () => none;
})();

// The board redraws when a store of values changes: a first draft shows as Draft at once.
const useRecord = (store: DraftStore | undefined) =>
  useSyncExternalStore(store?.subscribe ?? NO_SUBSCRIBE, store?.record ?? NO_RECORD);

export const Board = ({
  view,
  context,
  extras,
}: {
  readonly view: Store<BoardView>;
  readonly context: BoardContext;
  readonly extras: BoardExtras;
}) => {
  const { document, state, lock, connection } = useSyncExternalStore(view.subscribe, view.get);
  const language = useLanguage();
  const draft = useSyncExternalStore(context.board.subscribe, context.board.get);
  const kept = useSyncExternalStore(context.kept.subscribe, context.kept.get);
  const removed = useSyncExternalStore(context.removed.subscribe, context.removed.get);
  // The acts held for Submit wait while their questions' commands are on their way.
  useSyncExternalStore(context.acts.subscribe, context.acts.version);
  const attention: AttentionSnapshot = useSyncExternalStore(
    context.attention.subscribe,
    context.attention.get,
  );
  // The ladder's inputs, once for every surface: the card's command in flight, and whether a
  // question holds answer work, from the board's revising set and the stores a first draft sits in.
  const revisingSet = useSyncExternalStore(
    context.revisingSnapshot?.subscribe ?? NO_SUBSCRIBE,
    context.revisingSnapshot?.get ?? NO_REVISING_SET,
  );
  useRecord(context.draft);
  useRecord(context.results);
  useRecord(context.entries);
  useRecord(context.cellEntries);
  const ladder: Ladder = {
    flightOf: (questionId) => {
      const flight = context.acts.of(questionId, CARD_ACTS);
      if (flight === undefined) return undefined;
      const act = flight.acts.find(
        (each) => each.itemId === questionId && CARD_ACTS.includes(each.type),
      );
      return { outcome: flight.outcome, act: act?.type };
    },
    revisingOf: revisingOfBoard(context, revisingSet, { document, state }),
  };
  const presentation = presentationOf(document);
  const questions = questionsOf(document);
  // The completion panel, or "All ready" beside Send, from the receipts and the work (decision 6).
  const completion: Completion = shownCompletionOf(
    completionOf(
      document,
      state,
      draft.questions,
      ladder.flightOf,
      (question) => ladder.revisingOf(question.id),
      presentation === "single" ? "immediate" : draft.delivery,
    ),
    { locked: lock !== undefined, snapshot: context.opened !== undefined },
  );
  const panelShown = completion.kind === "done" || completion.kind === "postponed";
  const focusHeading = useHeadingFocus(context.focus, panelShown);
  const announced = useRef(completion.kind);
  useEffect(() => {
    const before = announced.current;
    announced.current = completion.kind;
    if (before === completion.kind) return;
    if (completion.kind === "done") {
      for (const message of allAnsweredMessagesOf(completion)) context.status.announce(message);
    } else if (completion.kind === "send-all") context.status.announce(allReadyMessageOf());
  }, [completion, context.status]);
  // The delivered count, said at most once every five seconds, from receipts alone (decision 6).
  const gate = useMemo(() => createDeliveredGate(), []);
  const opened = context.opened !== undefined;
  useEffect(() => {
    if (opened) return;
    gate.observe(receiptCountsOf(document, state), Date.now());
    const due = gate.dueAt();
    if (due === undefined) return;
    const timer = window.setTimeout(
      () => {
        const message = gate.due(Date.now());
        if (message !== undefined) context.status.announce(message);
      },
      Math.max(0, due - Date.now()) + 25,
    );
    return () => window.clearTimeout(timer);
  }, [document, state, gate, opened, context.status]);
  // What follows an act, asked at the act of the card (answering-flow-guidance, decision 3): the
  // flow reads the board as it stands then, through a ref the render keeps current, and the work
  // afresh from the store, which the act has just changed.
  const setting = useSyncExternalStore(
    extras.presentation.presentation.subscribe,
    () => extras.presentation.presentation.get().afterAnswer,
  );
  const latest = useRef<Omit<FlowView, "work"> | undefined>(undefined);
  latest.current = {
    document,
    state,
    ladder,
    unseen: attention.unseen,
    setting,
    delivery: presentation === "single" ? "immediate" : draft.delivery,
    single: presentation === "single",
  };
  const flow = useMemo(
    () =>
      createFlow({
        view: () => ({
          ...(latest.current as Omit<FlowView, "work">),
          work: context.board.get().questions,
        }),
        footer: context.footer,
        recorded: context.recorded,
        focus: context.focus,
        removed: context.removed,
        show: (id) => context.board.setInView(id),
        status: context.status,
        guard: context.guard,
      }),
    [context],
  );
  useHeldKeyGuard(context.guard);
  // The footer of "Stay here" goes when the board no longer holds the question it names.
  const footer = useSyncExternalStore(context.footer.subscribe, context.footer.get);
  const footerGone = footer !== undefined && !questions.some((each) => each.id === footer.target);
  useEffect(() => {
    if (footerGone) context.footer.set(undefined);
  }, [footerGone, context.footer]);
  // Numbers follow board order when the board first shows, and are held from then on: the draft
  // holds them (and the record mirrors them), so a reload or a takeover keeps each question's.
  const numbered = numbersOf(
    draft.numbers !== undefined && draft.nextNumber !== undefined
      ? { byId: draft.numbers, next: draft.nextNumber }
      : undefined,
    questions.map((question) => question.id),
    QUESTION_NUMBER_MAX,
  );
  const numbers = numbered.byId;
  const numbersKey = `${numbered.next}:${[...numbered.byId].map(([id, n]) => `${id}=${n}`).join(",")}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `numbersKey` stands for `numbered`
  useEffect(() => {
    context.board.setNumbers(numbered);
  }, [numbersKey, context.board]);
  const removedNumbers = useSyncExternalStore(
    context.removedNumbers.subscribe,
    context.removedNumbers.get,
  );
  const shared: Shared = { ladder, flow, document, state, lock, draft, context, numbers };
  // Submit waits for a held act's question that is loading or failed (Issue #103): the board
  // redraws when any question's status changes, whatever else it reads of the tracker.
  const statuses = useSyncExternalStore(context.tracker.subscribe, () =>
    questions.map((question) => context.tracker.questionStatus(question.id)).join(),
  );
  // A question whose item failed takes no part in Submit: its held acts are released and its work
  // stays in the draft, also when a restore or a later act holds one again (Appendix row 44).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `statuses` and `draft` are the triggers
  useEffect(() => {
    releaseFailed(document, context.board, context.tracker.questionStatus);
  }, [statuses, draft, document, context]);
  const groups = groupsOf(document);
  const changed = changedOf(document, draft, kept);
  const known = questions.some((question) => question.id === draft.inView);
  const current = known ? draft.inView : undefined;
  // Brings a question into view and leaves the focus to the caller.
  const show = (questionId: string) => {
    context.removed.set(false);
    context.board.setInView(questionId);
  };
  const go = (questionId: string) => {
    show(questionId);
    focusHeading(questionId);
  };
  // The jumps start at the question the board shows (shownQuestionOf).
  const viewing = shownQuestionOf(document, current);
  const target = nextOpenFrom(document, state, draft.questions, ladder, attention.unseen, viewing);
  const nextOpen = target === undefined ? undefined : () => go(target);
  const before = previousOpenFrom(document, state, draft.questions, ladder, viewing);
  const previousOpen = before === undefined ? undefined : () => go(before);
  // One measurement of the header's height, which the rail, the tray and the strip of tabs read.
  const headerHeight = useHeaderHeight();
  // The tray: a Snapshot's outcome shows there while the control has one, and a message about
  // questions the agent added ends once every one of them has been seen.
  const snapshotState = useSyncExternalStore(extras.snapshot.subscribe, extras.snapshot.get);
  useEffect(() => {
    if (snapshotState.phase !== "idle") extras.tray.show({ kind: "snapshot" });
  }, [snapshotState, extras.tray]);
  useEffect(() => {
    extras.tray.unseenChanged(attention.unseen);
  }, [attention.unseen, extras.tray]);
  // A Tab never ends a control under the header, the strip of tabs or the tray.
  useScrollPadding();
  const panel = useBoardPanel();
  const boardTable = useBoardKeyTable();
  const firstOf = (ids: ReadonlySet<string> | ReadonlyMap<string, number>) =>
    questions.find((question) => ids.has(question.id))?.id;
  const counts: HeaderCounts = {
    openLabel: openLabelOf(
      openCountOf(document, state, draft.questions, ladder),
      postponedCountOf(document, state, draft.questions, ladder),
      language,
    ),
    onNextOpen: nextOpen,
    unreadReplies: [...attention.unread.values()].reduce((sum, count) => sum + count, 0),
    onUnread: () => {
      const first = firstOf(attention.unread);
      if (first === undefined) return;
      go(first);
      context.threads.set({ questionId: first, n: (context.threads.get()?.n ?? 0) + 1 });
    },
    changed: changed.size,
    onChanged: () => {
      const first = firstOf(changed);
      if (first !== undefined) go(first);
    },
  };
  // The keys act while the header shows their twins: the jump on a board with counts, the Keys button
  // on a board that has not ended (board-keys, decision 3).
  const jumps = presentation === "single" || endedOf(lock) ? undefined : { nextOpen, previousOpen };
  useBoardKeys(
    {
      nextOpen: jumps?.nextOpen,
      previousOpen: jumps?.previousOpen,
      keysOpen: endedOf(lock) ? undefined : panel.opening,
    },
    boardTable,
  );
  const marksOf = (question: ViewQuestion): EntryMarks => ({
    mark: markOf(question.id, state, draft.questions, ladder),
    isNew: attention.unseen.has(question.id),
    unread: attention.unread.get(question.id) ?? 0,
    changed: changed.has(question.id),
  });
  const single = presentation === "single";
  // The outline, the jump and Submit's focus read the question in view: scrolling and focus move it.
  useQuestionInView(
    !single && presentation !== "one-per-view",
    () => context.board.get().inView,
    context.board.setInView,
  );
  const delivery = single ? "immediate" : draft.delivery;
  // The items each card makes read-only on a revision it cannot show: no field block counts them.
  const readOnlyOf = readOnlyOfBoard(context.board, context.revisions);
  // The question each card shows: the gates of Submit and "Select recommended" read it (Issue #92).
  const shownOf = shownOfBoard(context.board, context.revisions);
  const submit = submitStateOf({
    document,
    board: draft,
    delivery,
    connection,
    lock,
    pending: (id) => changed.has(id),
    sending: (id) => context.acts.of(id, CARD_ACTS) !== undefined,
    entries: entriesWithCells(context.entries?.record(), context.cellEntries?.record()),
    results: context.results?.record(),
    readOnlyOf,
    shownOf,
    load: context.tracker.questionStatus,
  });
  // "Prefill recommended" (decision 8): the questions that can take it, and the batch the last press
  // filled, which lives until the user's next edit or act on the board.
  const skipPrefill = (id: string) => {
    const question = questions.find((each) => each.id === id);
    return question === undefined || !takesSelection(context, question, draft, kept, lock);
  };
  const prefillCount =
    lock !== undefined || context.opened !== undefined
      ? 0
      : prefillCountOf(
          document,
          state,
          { draft: context.draft, board: context.board, shownOf },
          skipPrefill,
        );
  const [batch, setBatch] = useState<
    { items: PrefillBatch; mark: readonly unknown[] } | undefined
  >();
  const [focusing, setFocusing] = useState({ undo: 0, prefill: 0 });
  const markOfStores = (): readonly unknown[] => [
    context.draft.record(),
    context.results?.record(),
    context.entries?.record(),
    context.cellEntries?.record(),
    context.board.get().questions,
    context.acts.version(),
  ];
  const marks = markOfStores();
  const liveBatch = batch?.mark.every((each, at) => each === marks[at]) ? batch : undefined;
  useEffect(() => {
    if (batch !== undefined && liveBatch === undefined) {
      setBatch(undefined);
      extras.tray.batchEnded();
    }
  }, [batch, liveBatch, extras.tray]);
  const undoNow = useRef<() => void>(() => undefined);
  // "Undo" clears what the prefill filled, says so, and gives focus to "Prefill recommended".
  const onUndo = () => {
    if (liveBatch === undefined) return;
    setBatch(undefined);
    undoPrefill(liveBatch.items, { draft: context.draft, board: context.board });
    extras.tray.close("prefill");
    context.status.announce(prefillUndoneMessageOf());
    setFocusing((count) => ({ ...count, prefill: count.prefill + 1 }));
  };
  undoNow.current = onUndo;
  useEffect(() => {
    if (focusing.undo > 0)
      globalThis.document.querySelector<HTMLElement>("[data-askboard-undo]")?.focus();
  }, [focusing.undo]);
  useEffect(() => {
    if (focusing.prefill > 0) {
      globalThis.document.querySelector<HTMLElement>("[data-askboard-prefill]")?.focus();
    }
  }, [focusing.prefill]);
  // Every press says how many were prefilled, none included, in the status region and in the tray;
  // nothing was sent. "Undo" takes the focus.
  const selectRecommendedNow = () => {
    const items = selectRecommended(
      document,
      state,
      { draft: context.draft, board: context.board, shownOf },
      skipPrefill,
    );
    const message = { key: "status.prefilled", params: { count: items.length } } as const;
    context.status.announce(message);
    extras.tray.show({ kind: "prefill", text: message, onUndo: () => undoNow.current() });
    setBatch({ items, mark: markOfStores() });
    setFocusing((count) => ({ ...count, undo: count.undo + 1 }));
  };
  const flightOf = ladder.flightOf;
  const revisingOf = (question: ViewQuestion) => ladder.revisingOf(question.id);
  const ledger = ledgerOf(document, state, draft.questions, flightOf, revisingOf, delivery);
  const outboxLine = outboxLineOf({
    blocked: submit.blocked,
    completion,
    held: submit.answers,
  });
  const outbox =
    single || context.opened !== undefined ? undefined : (
      <Outbox
        document={document}
        state={state}
        delivery={delivery}
        ledger={ledger}
        line={outboxLine}
        submit={submit}
        readOnlyOf={readOnlyOf}
        shownOf={shownOf}
        load={context.tracker.questionStatus}
        locked={lock !== undefined}
        context={context}
        // The card focuses its prompt itself: the heading's focus would run after it (the board's
        // effect follows the card's) and take it away.
        onNeedsReason={(id) => {
          show(id);
          context.reasons.set({ questionId: id });
        }}
        onJump={go}
        // The question in view, else the first, takes the focus once Submit has sent.
        onSubmitted={() => {
          // The next question to do after the one in view, while one is left; else the completion
          // panel's heading once it shows (Focus after Answer and Submit).
          const next = nextOfFlow(
            document,
            state,
            context.board.get().questions,
            ladder,
            attention.unseen,
            viewing ?? "",
          );
          const id = next?.id ?? current ?? questions[0]?.id;
          if (next !== undefined && id !== undefined) focusHeading(id);
          else if (id !== undefined) {
            // Nothing left to do: the heading of the question in view takes the focus now, never
            // the disabled Send or the page, and the panel's heading follows once it shows.
            // Directly, not through the store: two requests in one tick leave only the last.
            const heading = globalThis.document.getElementById(questionTextId(id));
            if (heading !== null) revealAndFocus(heading);
            requestFocusTo(context.focus, id, "completion");
          }
        }}
      />
    );
  // A Snapshot has no draft record to hold numbers (AD-20): it shows none.
  const outlineNumbers = context.opened === undefined ? numbers : undefined;
  const [first] = questions;
  const panelNode =
    completion.kind === "done" || completion.kind === "postponed" ? (
      <CompletionPanel completion={completion} onGoToFirst={go} />
    ) : null;
  let body: ReactNode;
  if (single || first === undefined) {
    body = (
      <main className="flex flex-col gap-lg p-lg">
        {first === undefined ? null : <Card question={first} shared={shared} />}
      </main>
    );
  } else if (presentation === "one-per-view") {
    const shown = current ?? first.id;
    const at = questions.findIndex((question) => question.id === shown);
    body = (
      <div className="flex flex-1">
        <Rail
          outline={
            <Outline
              groups={groups}
              current={shown}
              marksOf={marksOf}
              onJump={go}
              numbers={outlineNumbers}
              removed={removedNumbers}
            />
          }
          outbox={outbox}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-lg p-lg">
          {panelNode}
          <OneQuestionBody
            questions={questions}
            current={shown}
            shared={shared}
            navigator={
              <QuestionNavigator questions={questions} current={at} onGo={go} removed={removed} />
            }
          />
        </main>
      </div>
    );
  } else {
    const active =
      (current === undefined ? undefined : areaOf(document, current)?.id) ?? groups[0]?.id ?? "";
    body = (
      <div className="flex flex-1">
        <Rail
          outline={
            <Outline
              groups={groups}
              current={current}
              marksOf={marksOf}
              onJump={go}
              numbers={outlineNumbers}
              removed={removedNumbers}
            />
          }
          outbox={outbox}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-xl p-lg">
          {panelNode}
          {presentation === "tabs" ? (
            <TabsBody
              groups={groups}
              active={active}
              onActivate={(areaId) => {
                const area = groups.find((group) => group.id === areaId);
                const [head] = area?.questions ?? [];
                if (head !== undefined) context.board.setInView(head.id);
              }}
              shared={shared}
              unseen={attention.unseen}
            />
          ) : (
            groups.map((group) => (
              <Section key={group.id ?? "questions"} group={group} shared={shared} />
            ))
          )}
        </main>
      </div>
    );
  }
  // The strip reads the numbers computed above for the cards.
  const strip = (
    <ProgressStrip
      groups={stripOf(
        document,
        state,
        draft.questions,
        flightOf,
        revisingOf,
        attention.unseen,
        outlineNumbers ?? new Map(),
      )}
      current={viewing}
      onGo={go}
    />
  );
  const snapshotOffer = snapshotOfferOf(lock, connection);
  return (
    <div
      data-askboard-ended={endedOf(lock) ? "" : undefined}
      style={{ "--askboard-header-height": `${headerHeight}px` } as CSSProperties}
      className="group/board flex min-h-screen flex-col"
    >
      <StatusRegion status={context.status} />
      {context.opened === undefined ? null : <SnapshotTopLine opened={context.opened} />}
      <BoardHeader
        title={document.title}
        askId={document.askId}
        pill={askPillOf(state, lock, language)}
        counts={single || endedOf(lock) ? undefined : counts}
        strip={strip}
        prefill={
          single || context.opened !== undefined || prefillCount === 0
            ? undefined
            : { disabled: lock !== undefined, onPress: selectRecommendedNow, count: prefillCount }
        }
        ended={endedOf(lock)}
        header={extras.header}
        status={context.status}
        controls={extras.presentation}
        warning={
          context.opened === undefined
            ? postponedWarningOf(document, state, draft.questions, ladder, language)
            : undefined
        }
        snapshot={
          context.opened === undefined
            ? { control: extras.snapshot, offer: snapshotOffer }
            : undefined
        }
        keys={
          endedOf(lock)
            ? undefined
            : { panel, takesEdits: lock === undefined && context.opened === undefined }
        }
      />
      {context.opened === undefined ? (
        <FeedbackTray
          tray={extras.tray}
          snapshot={extras.snapshot}
          onGo={(ids) => {
            const id = goTargetOf(
              { kind: "added", text: { key: "tray.go" }, questions: ids },
              attention.unseen,
            );
            if (id !== undefined) go(id);
          }}
        />
      ) : null}
      {body}
    </div>
  );
};
