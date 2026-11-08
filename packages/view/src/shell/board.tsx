// The board in the view (ask-lifecycle, design decision 6; EXPERIENCE.md, Board anatomy and
// Presentations): the context header, then the questions in the presentation the ask requests,
// then the bottom action bar. One question is the single-question board, whatever the ask
// requests: the header with the title and the ask state, and one card, with no navigator, count,
// jump, delivery switch or Submit (FR-22). Two or more show their areas, or their questions as one
// group, as sections (the default) or tabs, beside the outline navigator, or one question per view
// under the question navigator (FR-2), and the bottom action bar with the delivery switch,
// "Select recommended" and Submit (task 6.6). Hidden tabs and hidden questions stay mounted, so
// that they report ready (AD-9). The question in view is the lifecycle draft's, so a reload or a
// takeover comes back to it (What a reload keeps); when the agent deletes it, one question per
// view says "Question removed by the agent" and shows the next one (task 6.7). It renders from the
// latest board document and what the board page last sent: the state, the lock, which makes the
// board read-only while it moved, once it is discarded or closed (AD-21, FR-6), and whether the
// connection is lost, which stops Submit. Later changes' stores come in one record, the shell's
// extras: the header also shows who asked and where and the agent status, from push delivery's
// store (design decision 12).

import type { LifecycleBoardState } from "@askboard/contract";
import { Tabs } from "radix-ui";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { questionTextId, useLanguage, useStrings } from "../catalog/port.ts";
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
import {
  askPillOf,
  endedOf,
  type Group,
  groupsOf,
  markOf,
  nextOpenFrom,
  openCountOf,
  postponedWarningOf,
  presentationOf,
  tabOpenCount,
} from "./board-view.ts";
import { BottomBar } from "./bottom-bar.tsx";
import { CARD_ACTS } from "./card-acts.ts";
import { entriesWithCells } from "./cell-entries.ts";
import type { HeaderData } from "./header-data.ts";
import { type EntryMarks, Outline, QuestionNavigator } from "./navigators.tsx";
import type { PresentationControls } from "./presentation-controls.ts";
import { type CardContext, QuestionCard } from "./question-card.tsx";
import { type SnapshotControl, snapshotOfferOf } from "./snapshot-control.ts";
import { SnapshotTopLine } from "./snapshot-top-line.tsx";
import type { Store } from "./store.ts";
import { FOCUS_RING, INFO_BADGE } from "./styles.ts";
import { hasRecommendation, selectRecommended, submitStateOf } from "./submit.ts";
import type { ThemeChoice } from "./theme-control.tsx";

/** What the board page last told the view, with the latest board document. */
export type BoardView = {
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
  readonly lock?: ViewLock | undefined;
  readonly connection?: "lost" | undefined;
};

type Shared = {
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
  readonly lock: ViewLock | undefined;
  readonly draft: BoardDraftState;
  readonly context: CardContext;
};

/** A request to move focus to a question's heading, numbered so that each runs once. */
export type HeadingRequest = { readonly id: string; readonly n: number };

/** What the board needs beyond the cards: focus moves and the removed-question line. */
export type BoardContext = CardContext & {
  readonly focus: Store<HeadingRequest | undefined>;
  /** The agent deleted the question in view, in one question per view (F-55). */
  readonly removed: Store<boolean>;
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
  /** The bottom action bar's Snapshot (snapshot task 7.1). */
  readonly snapshot: SnapshotControl;
  /** An opened Snapshot's Theme control: the choice, saved nowhere (snapshot task 8.3). */
  readonly theme?: Store<ThemeChoice>;
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
  return (
    <Tabs.Root value={active} onValueChange={onActivate} className="flex flex-col gap-lg">
      <Tabs.List
        aria-label={text("areas.label")}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {groups.map((group) => {
          const area = shared.document.items.find((item) => item.id === group.id) as ViewArea;
          const open = tabOpenCount(area, shared.state, shared.draft.questions);
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
              {open === 0 ? null : (
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

/** Asks for focus on a question's heading, once the board has rendered. */
export const requestHeading = (focus: Store<HeadingRequest | undefined>, id: string): void =>
  focus.set({ id, n: (focus.get()?.n ?? 0) + 1 });

// Focus moves to a question's heading once the navigation has rendered (Accessibility Floor).
const useHeadingFocus = (focus: Store<HeadingRequest | undefined>) => {
  const target = useSyncExternalStore(focus.subscribe, focus.get);
  useEffect(() => {
    if (target === undefined) return;
    document.getElementById(questionTextId(target.id))?.focus();
  }, [target]);
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
  const focusHeading = useHeadingFocus(context.focus);
  const shared: Shared = { document, state, lock, draft, context };
  const presentation = presentationOf(document);
  const questions = questionsOf(document);
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
  const target = nextOpenFrom(document, state, draft.questions, attention.unseen, current);
  const nextOpen = target === undefined ? undefined : () => go(target);
  const firstOf = (ids: ReadonlySet<string> | ReadonlyMap<string, number>) =>
    questions.find((question) => ids.has(question.id))?.id;
  const counts: HeaderCounts = {
    open: openCountOf(document, state, draft.questions),
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
  const marksOf = (question: ViewQuestion): EntryMarks => ({
    mark: markOf(question.id, state, draft.questions),
    isNew: attention.unseen.has(question.id),
    unread: attention.unread.get(question.id) ?? 0,
    changed: changed.has(question.id),
  });
  const single = presentation === "single";
  const [first] = questions;
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
      <main className="flex flex-col gap-lg p-lg">
        <OneQuestionBody
          questions={questions}
          current={shown}
          shared={shared}
          navigator={
            <QuestionNavigator
              questions={questions}
              current={at}
              marksOf={marksOf}
              onGo={go}
              onNextOpen={nextOpen}
              removed={removed}
            />
          }
        />
      </main>
    );
  } else {
    const active =
      (current === undefined ? undefined : areaOf(document, current)?.id) ?? groups[0]?.id ?? "";
    body = (
      <div className="flex flex-1">
        <Outline groups={groups} current={current} marksOf={marksOf} onJump={go} />
        <main className="flex min-w-0 flex-1 flex-col gap-xl p-lg">
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
  });
  return (
    <div
      data-askboard-ended={endedOf(lock) ? "" : undefined}
      className="group/board flex min-h-screen flex-col"
    >
      {context.opened === undefined ? null : <SnapshotTopLine opened={context.opened} />}
      <BoardHeader
        title={document.title}
        pill={askPillOf(state, lock, language)}
        counts={single || endedOf(lock) ? undefined : counts}
        ended={endedOf(lock)}
        header={extras.header}
        controls={extras.presentation}
        theme={extras.theme}
      />
      {body}
      {context.opened !== undefined ? null : (
        <BottomBar
          single={single}
          document={document}
          state={state}
          delivery={delivery}
          warning={postponedWarningOf(document, state, draft.questions, language)}
          submit={submit}
          recommendations={hasRecommendation(document)}
          readOnlyOf={readOnlyOf}
          shownOf={shownOf}
          locked={lock !== undefined}
          context={context}
          onSelectRecommended={() =>
            selectRecommended(document, state, { ...context, readOnlyOf, shownOf }, (id) => {
              const question = questions.find((each) => each.id === id);
              return (
                question === undefined || !takesSelection(context, question, draft, kept, lock)
              );
            })
          }
          // The card focuses its prompt itself: the heading's focus would run after it (the board's
          // effect follows the card's) and take it away.
          onNeedsReason={(id) => {
            show(id);
            context.reasons.set({ questionId: id });
          }}
          onJump={go}
          snapshot={extras.snapshot}
          snapshotOffer={snapshotOfferOf(lock, connection)}
        />
      )}
    </div>
  );
};
