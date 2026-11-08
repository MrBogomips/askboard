// What an ask holds of its items (ask-lifecycle, design decision 3): its questions and areas in board
// order, each question's current revision and the props of the revisions it keeps (AD-20), the
// answer the agent recorded, the answer before a reopen, the replies to its follow-ups, and the IDs
// of deleted items, which are never reused (FR-5). The `Ask` aggregate changes it only through
// these methods, on a copy while an update applies (design decision 3).

import {
  BOARD_DOCUMENT_VERSION,
  type BoardItem,
  type BoardQuestion,
  type FetchAnswer,
  type LifecycleAskInput,
  type LifecycleBoardDocument,
  nestedItemsOf,
  type QuestionItem,
  type QuestionProps,
  type ThreadReply,
} from "@askboard/contract";
import { boardPropsOf } from "../context/board-props.ts";
import type { QuestionContext } from "../context/resolve.ts";
import { type Entry, frozenCopy } from "./log.ts";
import type { AnswerMark } from "./states.ts";
import { itemIdsOfQuestion, unchangedItems } from "./unchanged.ts";

/** An answer's content, as the board or the agent gives it. */
export type AnswerContent = {
  readonly choice?: readonly string[];
  readonly other?: string;
  readonly optionNotes?: Readonly<Record<string, string>>;
  readonly note?: string;
};

/** An answer the agent recorded on the user's behalf (FR-19; proposal, open question 3). */
export type RecordedAnswer = {
  readonly content: AnswerContent;
  readonly who: string;
  readonly when: string;
};

export type QuestionRecord = {
  readonly id: string;
  /** The area that holds it, if any. */
  readonly area: string | undefined;
  rev: number;
  /** The props of each revision it keeps, frozen (AD-20). */
  readonly revs: Map<number, QuestionProps>;
  mark: AnswerMark | undefined;
  recorded: RecordedAnswer | undefined;
  /** The answer it held before the agent last reopened it. */
  previous: FetchAnswer | undefined;
  /**
   * The revision `previous` names: its event's, or the one current when a recorded answer was
   * reopened. Kept while `previous` names it (reopen-start-from-answer, design decision 1).
   */
  previousRev: number | undefined;
  /** The agent's replies, by the cursor of the follow-up they answer (FR-10). */
  readonly replies: Map<string, ThreadReply[]>;
  /** Raised whenever its full value changes, for `fetch`'s continuations. */
  generation: number;
  /** The revisions an event names. */
  readonly named: Set<number>;
  /** The latest revision the user decided on, by an edit choice, an answer or a decline. */
  decided: number;
  /**
   * What each kept revision's send resolved of its pointers, by item ID, pruned with `revs`: the
   * excerpt text and image bytes live only here (excerpts, design decision 4, Storage).
   */
  readonly context: Map<number, QuestionContext>;
};

export type AreaRecord = {
  readonly id: string;
  title: string;
  readonly questions: string[];
  generation: number;
};

/** Where an added item goes: into an area, or at the top level; after a sibling, or first. */
export type Placement = { readonly parentId?: string; readonly after?: string };

const newQuestion = (item: QuestionItem, area: string | undefined): QuestionRecord => ({
  id: item.id,
  area,
  rev: 1,
  revs: new Map([[1, frozenCopy(item.props)]]),
  mark: undefined,
  recorded: undefined,
  previous: undefined,
  previousRev: undefined,
  replies: new Map(),
  generation: 1,
  named: new Set(),
  decided: 0,
  context: new Map(),
});

const copyQuestion = (question: QuestionRecord): QuestionRecord => ({
  ...question,
  revs: new Map(question.revs),
  replies: new Map([...question.replies].map(([cursor, replies]) => [cursor, [...replies]])),
  named: new Set(question.named),
  context: new Map(question.context),
});

// The ID of every item a question's props hold, at every depth of its layouts (layouts, design
// decision 5).
export const itemIdsOf = (props: unknown): string[] => {
  const { items } = (props ?? {}) as { readonly items?: unknown };
  if (!Array.isArray(items)) return [];
  return nestedItemsOf(items).flatMap(({ item }) => {
    const { id } = (item ?? {}) as { readonly id?: unknown };
    return typeof id === "string" ? [id] : [];
  });
};

// Inserts `id` into `list` after `after`, or first without it.
const place = (list: string[], id: string, after: string | undefined): void => {
  list.splice(after === undefined ? 0 : list.indexOf(after) + 1, 0, id);
};

const without = (list: string[], id: string): void => {
  const index = list.indexOf(id);
  if (index !== -1) list.splice(index, 1);
};

// An area holds one or more questions, and an ask one or more items: the model keeps it so.
const nonEmpty = <T>(list: T[]): [T, ...T[]] => {
  if (list.length === 0) throw new Error("an area or an ask holds at least one question");
  return list as [T, ...T[]];
};

export class BoardModel {
  readonly layout: "questions" | "areas";
  readonly #top: string[];
  readonly #questions: Map<string, QuestionRecord>;
  readonly #areas: Map<string, AreaRecord>;
  readonly #deleted: Set<string>;
  // The ID of each item the questions' current revisions hold, at every depth, by the ID of the
  // question that holds it; kept on add, revise and delete (layouts, design decision 5).
  readonly #held: Map<string, string>;
  // What each pair of revisions of a question shares, by question and the two revisions.
  readonly #unchanged: Map<string, readonly string[]>;
  #recordedEver: boolean;

  private constructor(
    layout: "questions" | "areas",
    parts: {
      top: string[];
      questions: Map<string, QuestionRecord>;
      areas: Map<string, AreaRecord>;
      deleted: Set<string>;
      held: Map<string, string>;
      unchanged: Map<string, readonly string[]>;
      recordedEver: boolean;
    },
  ) {
    this.layout = layout;
    this.#top = parts.top;
    this.#questions = parts.questions;
    this.#areas = parts.areas;
    this.#deleted = parts.deleted;
    this.#held = parts.held;
    this.#unchanged = parts.unchanged;
    this.#recordedEver = parts.recordedEver;
  }

  /**
   * An ask's items as it was accepted: every question at revision 1 (AD-20), with what its send
   * resolved, by question ID.
   */
  static of(
    items: LifecycleAskInput["items"],
    context: ReadonlyMap<string, QuestionContext> = new Map(),
  ): BoardModel {
    const layout = items[0].type === "area" ? "areas" : "questions";
    const model = new BoardModel(layout, {
      top: [],
      questions: new Map(),
      areas: new Map(),
      deleted: new Set(),
      held: new Map(),
      unchanged: new Map(),
      recordedEver: false,
    });
    let after: string | undefined;
    for (const item of items) {
      model.add(item, after === undefined ? {} : { after });
      after = item.id;
    }
    for (const [id, resolved] of context) model.resolved(id, resolved);
    return model;
  }

  /** A copy sharing nothing that changes, for an update that applies all or none. */
  clone(): BoardModel {
    const areas = [...this.#areas].map(([id, area]) => [
      id,
      { ...area, questions: [...area.questions] },
    ]);
    return new BoardModel(this.layout, {
      top: [...this.#top],
      questions: new Map([...this.#questions].map(([id, q]) => [id, copyQuestion(q)])),
      areas: new Map(areas as [string, AreaRecord][]),
      deleted: new Set(this.#deleted),
      held: new Map(this.#held),
      unchanged: new Map(this.#unchanged),
      recordedEver: this.#recordedEver,
    });
  }

  /** Whether the agent has ever recorded an answer: the ask then is no longer waiting. */
  get recordedEver(): boolean {
    return this.#recordedEver;
  }

  question(id: string): QuestionRecord | undefined {
    return this.#questions.get(id);
  }

  area(id: string): AreaRecord | undefined {
    return this.#areas.get(id);
  }

  isDeleted(id: string): boolean {
    return this.#deleted.has(id);
  }

  /**
   * Held now or deleted earlier: an ID never reused (FR-5). A question, an area, or an item of a
   * question's current revision at any depth holds it; with `except`, the items of that question
   * do not count, for the question's own change. An item a change drops is free again.
   */
  inUse(id: string, except?: string): boolean {
    if (this.#questions.has(id) || this.#areas.has(id) || this.#deleted.has(id)) return true;
    const holder = this.#held.get(id);
    return holder !== undefined && holder !== except;
  }

  /** The ID of the question whose current revision holds the item `id`, if one does. */
  heldBy(id: string): string | undefined {
    return this.#held.get(id);
  }

  /** The IDs of the siblings an item placed by `parentId` would sit among. */
  siblings(parentId: string | undefined): readonly string[] {
    return parentId === undefined ? this.#top : (this.#areas.get(parentId)?.questions ?? []);
  }

  /** Every question, in board order. */
  questions(): QuestionRecord[] {
    const ids =
      this.layout === "areas"
        ? this.#top.flatMap((id) => this.#areas.get(id)?.questions ?? [])
        : this.#top;
    return ids.flatMap((id) => {
      const question = this.#questions.get(id);
      return question === undefined ? [] : [question];
    });
  }

  /** A question's props at its current revision. */
  propsOf(question: QuestionRecord): QuestionProps {
    return question.revs.get(question.rev) as QuestionProps;
  }

  /** A question at its current revision, its context merged with what its send resolved. */
  boardQuestion(question: QuestionRecord): BoardQuestion {
    const props = boardPropsOf(this.propsOf(question), question.context.get(question.rev));
    return { type: "question", id: question.id, rev: question.rev, props };
  }

  /** An area's questions as the board document holds them. */
  areaQuestions(area: AreaRecord): [BoardQuestion, ...BoardQuestion[]] {
    return nonEmpty(
      area.questions.flatMap((id) => {
        const question = this.#questions.get(id);
        return question === undefined ? [] : [this.boardQuestion(question)];
      }),
    );
  }

  /** The board document's items, in board order (AD-12). */
  items(): LifecycleBoardDocument["items"] {
    const items = this.#top.flatMap((id): BoardItem[] => {
      const area = this.#areas.get(id);
      if (area !== undefined) {
        return [
          { type: "area", id, props: { title: area.title, items: this.areaQuestions(area) } },
        ];
      }
      const question = this.#questions.get(id);
      return question === undefined ? [] : [this.boardQuestion(question)];
    });
    return nonEmpty(items) as LifecycleBoardDocument["items"];
  }

  /** The board document, frozen. */
  document(
    head: Pick<
      LifecycleBoardDocument,
      "askId" | "title" | "presentation" | "delivery" | "language" | "locale"
    >,
  ): LifecycleBoardDocument {
    const document: LifecycleBoardDocument = {
      version: BOARD_DOCUMENT_VERSION,
      ...head,
      items: this.items(),
    };
    return frozenCopy(document);
  }

  // Changes, applied by the aggregate.

  /** Adds an item where `placement` says; the caller has checked that it may go there. */
  add(item: LifecycleAskInput["items"][number], placement: Placement): void {
    const { parentId, after } = placement;
    if (item.type === "area") {
      this.#areas.set(item.id, {
        id: item.id,
        title: item.props.title,
        questions: item.props.items.map(({ id }) => id),
        generation: 1,
      });
      for (const question of item.props.items) {
        this.#questions.set(question.id, newQuestion(question, item.id));
        this.#hold(question.id, question.props);
      }
    } else {
      this.#questions.set(item.id, newQuestion(item, parentId));
      this.#hold(item.id, item.props);
    }
    const area = parentId === undefined ? undefined : this.#areas.get(parentId);
    place(area === undefined ? this.#top : area.questions, item.id, after);
    if (area !== undefined) area.generation += 1;
  }

  /** A new revision of a question with these props (AD-20); returns it. */
  revise(question: QuestionRecord, props: QuestionProps): number {
    this.#release(question.id, this.propsOf(question));
    question.rev += 1;
    question.revs.set(question.rev, frozenCopy(props));
    this.#hold(question.id, props);
    question.generation += 1;
    this.#touchArea(question);
    this.#prune(question);
    return question.rev;
  }

  /** Holds what a send resolved of a question's current revision (excerpts, design decision 4). */
  resolved(id: string, context: QuestionContext): void {
    const question = this.#questions.get(id);
    if (question !== undefined) question.context.set(question.rev, context);
  }

  /** Changes an area's title. */
  retitle(area: AreaRecord, title: string): void {
    area.title = title;
    area.generation += 1;
  }

  /** The agent records the user's answer: no event (proposal, open question 3). */
  record(question: QuestionRecord, answer: RecordedAnswer, at: number): void {
    question.recorded = frozenCopy(answer);
    question.mark = { at, kind: "recorded" };
    question.generation += 1;
    this.#recordedEver = true;
  }

  /**
   * The agent reopens a question: a new revision with no answer, the old one kept as previous, with
   * the revision it names (`answerRev`: its event's, or the current one for a recorded answer).
   */
  reopen(
    question: QuestionRecord,
    previous: FetchAnswer | undefined,
    at: number,
    answerRev: number = question.rev,
  ): number {
    question.previous = previous === undefined ? undefined : frozenCopy(previous);
    question.previousRev = previous === undefined ? undefined : answerRev;
    question.mark = { at, kind: "reopened" };
    return this.revise(question, this.propsOf(question));
  }

  /** Appends the agent's reply under a follow-up (FR-10); the revision stays. */
  reply(question: QuestionRecord, followUp: string, reply: ThreadReply): void {
    const replies = question.replies.get(followUp) ?? [];
    question.replies.set(followUp, [...replies, frozenCopy(reply)]);
  }

  /**
   * Removes an item and everything in it, remembering every ID; an area left with no question goes
   * with its last one, since an area holds one or more (FR-2).
   */
  delete(id: string): void {
    const area = this.#areas.get(id);
    if (area !== undefined) {
      for (const questionId of area.questions) this.#forget(questionId);
      this.#areas.delete(id);
      this.#deleted.add(id);
      without(this.#top, id);
      return;
    }
    const question = this.#questions.get(id);
    if (question === undefined) return;
    this.#forget(id);
    const parent = question.area === undefined ? undefined : this.#areas.get(question.area);
    if (parent === undefined) {
      without(this.#top, id);
      return;
    }
    without(parent.questions, id);
    parent.generation += 1;
    if (parent.questions.length === 0) this.delete(parent.id);
  }

  #forget(id: string): void {
    const question = this.#questions.get(id);
    if (question !== undefined) {
      const ids = itemIdsOf(this.propsOf(question));
      this.#release(id, this.propsOf(question));
      for (const held of ids) this.#deleted.add(held);
    }
    this.#questions.delete(id);
    this.#deleted.add(id);
  }

  // The items of a question's revision are held by it.
  #hold(questionId: string, props: unknown): void {
    for (const id of itemIdsOf(props)) this.#held.set(id, questionId);
  }

  // The items of a question's revision are held no more.
  #release(questionId: string, props: unknown): void {
    for (const id of itemIdsOf(props)) {
      if (this.#held.get(id) === questionId) this.#held.delete(id);
    }
  }

  /**
   * Takes appended events into account: the revisions they name are kept, a decision prunes the
   * older ones nothing names, and a change of state raises the question's generation.
   */
  noteEntries(entries: readonly Entry[]): void {
    for (const { event } of entries) {
      const question = "itemId" in event ? this.#questions.get(event.itemId) : undefined;
      if (question === undefined) continue;
      if (!("rev" in event)) continue;
      question.named.add(event.rev);
      if (event.type === "edit-choice" && event.edit === "ignore")
        question.named.add(event.keptRev);
      if (event.type === "edit-choice" || event.type === "answer") {
        question.decided = Math.max(question.decided, event.rev);
      }
      if (event.type === "answer" || event.type === "postponed" || event.type === "reopened") {
        question.generation += 1;
      }
      this.#prune(question);
    }
  }

  /**
   * The IDs, the question's own and its items' at any depth, whose props at the revision `rev` equal
   * those of the current one (reopen-start-from-answer, design decision 1). The current revision
   * shares everything with itself. `[]` when `rev` is not kept or cannot be compared, never none:
   * absence reads as "all unchanged" on a current answer (NFR-10). Each pair of revisions is
   * compared once: the props of a revision never change.
   */
  unchangedSince(question: QuestionRecord, rev: number): readonly string[] {
    const now = this.propsOf(question);
    if (rev === question.rev) return itemIdsOfQuestion(question.id, now);
    const then = question.revs.get(rev);
    if (then === undefined) return [];
    const key = `${question.id}\u0000${rev}\u0000${question.rev}`;
    if (!this.#unchanged.has(key)) {
      const after = { props: now, context: question.context.get(question.rev) };
      const before = { props: then, context: question.context.get(rev) };
      this.#unchanged.set(key, unchangedItems(question.id, before, after));
    }
    return this.#unchanged.get(key) ?? [];
  }

  // An area's value holds its questions' revisions and props: it changes with them.
  #touchArea(question: QuestionRecord): void {
    const area = question.area === undefined ? undefined : this.#areas.get(question.area);
    if (area !== undefined) area.generation += 1;
  }

  // Keeps the current revision, every revision an event names, and every revision after the
  // user's last decision, on which the board may still hold unsent work (FR-6, AD-20).
  #prune(question: QuestionRecord): void {
    for (const rev of question.revs.keys()) {
      const kept =
        rev === question.rev ||
        rev === question.previousRev ||
        question.named.has(rev) ||
        rev > question.decided;
      if (kept) continue;
      question.revs.delete(rev);
      question.context.delete(rev);
    }
  }
}
