// The document part of the view's update step (ask-lifecycle, design decision 6; document-review,
// design decision 15): what runs, in this order, when the board page hands the view a new document.
// `index.tsx` calls it, and the unit tests call it too, so a test of the draft after an agent's
// update runs production's order and not its own: the revision is recorded first, so that every
// reader that follows can ask for the question as the card shows it (`shownOf`), the work kept
// across the update being held on the revision it was made on. Plain functions, tested without a DOM.

import { questionsOf, type ViewDocument } from "../view-document.ts";
import { type Revisions, type ShownOf, shownDocumentOf } from "./agent-change.ts";
import type { Attention } from "./attention.ts";
import type { BoardDraft } from "./board-draft.ts";
import { nextAfterRemoval } from "./board-view.ts";
import { dropWork } from "./card-acts.ts";
import { dropStaleCellEntries } from "./cell-entries.ts";
import type { DraftStore } from "./draft-store.ts";
import { dropStaleEntries } from "./entries.ts";
import { type HeadingRequest, requestHeading } from "./heading-request.ts";
import type { ReadyTracker } from "./ready-tracker.ts";
import { questionItemsOf } from "./ready-tracker.ts";
import type { Store } from "./store.ts";

/** What the update step reads and writes. */
export type DocumentUpdate = {
  readonly revisions: Revisions;
  readonly draft: DraftStore;
  readonly results: DraftStore;
  readonly entries: DraftStore;
  readonly cellEntries: DraftStore;
  readonly board: BoardDraft;
  // The question as the card shows it: a deleted question's work goes with the items of the
  // revision it was made on, and a field entry survives while that revision holds its item.
  readonly shownOf: ShownOf;
  readonly tracker: Pick<ReadyTracker, "include">;
  readonly attention: Pick<Attention, "documentChanged">;
  readonly focus: Store<HeadingRequest | undefined>;
  readonly removed: Store<boolean>;
  /** The question whose card holds the focus, if any. */
  readonly focused: () => string | undefined;
};

// The agent deleted questions (FR-6; task 6.7): each leaves with its draft; the question in view
// moves on to the next one, saying so, and so does the focus if one of them held it.
const onRemoval = (before: ViewDocument, after: ViewDocument, stores: DocumentUpdate): void => {
  const earlier = questionsOf(before);
  const now = questionsOf(after).map((question) => question.id);
  const gone = earlier.filter((question) => !now.includes(question.id));
  if (gone.length === 0) return;
  const focused = stores.focused();
  for (const question of gone) dropWork(question, stores);
  const ids = earlier.map((question) => question.id);
  const isGone = (id: string | undefined) => gone.some((question) => question.id === id);
  const inView = stores.board.get().inView;
  if (inView !== undefined && isGone(inView)) {
    stores.board.setInView(nextAfterRemoval(ids, now, inView));
    stores.removed.set(true);
  }
  if (focused !== undefined && isGone(focused)) {
    const next = nextAfterRemoval(ids, now, focused);
    if (next !== undefined) requestHeading(stores.focus, next);
  }
};

/**
 * A new board document replaces `before`: remembers each revision, drops what the deleted questions
 * held, drops the entries and cell entries that no item of the question's current or shown revision
 * can correct, reconciles the ready tracker over the items the cards show and tells the attention of the
 * document. The caller sets the view's document after it.
 */
export const applyDocumentUpdate = (
  before: ViewDocument,
  document: ViewDocument,
  stores: DocumentUpdate,
): void => {
  stores.revisions.record(document);
  onRemoval(before, document, stores);
  dropStaleEntries(document, stores.entries, stores.shownOf);
  dropStaleCellEntries(document, stores.cellEntries, stores.shownOf);
  stores.tracker.include(questionItemsOf(shownDocumentOf(document, stores.shownOf)));
  stores.attention.documentChanged(document);
};

/**
 * Keeps the ready tracker on the items the cards show while the board's work changes which
 * revision a card shows ("Keep mine", "Reload, losing my work", a settled answer): on each board
 * change that gives another shown document (compared by identity, so a change that moves no card
 * includes nothing, and a keystroke, which changes no board state, walks nothing) the tracker includes the
 * items of the shown document. A question awaits the items of the revision its card renders, so an
 * item only the kept revision holds reports ready or fails its question, and an item only the
 * current revision holds is awaited from the moment the card shows it (document-review, design
 * decision 15). `documentOf` reads the document the view holds. Returns the way to stop.
 */
export const connectTracker = (
  documentOf: () => ViewDocument,
  board: Pick<BoardDraft, "subscribe">,
  shownOf: ShownOf,
  tracker: Pick<ReadyTracker, "include">,
): (() => void) => {
  let last = shownDocumentOf(documentOf(), shownOf);
  return board.subscribe(() => {
    const shown = shownDocumentOf(documentOf(), shownOf);
    if (shown === last) return;
    last = shown;
    tracker.include(questionItemsOf(shown));
  });
};
