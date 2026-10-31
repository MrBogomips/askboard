// The Ask aggregate (design decision 3): the request as accepted, its items and their revisions,
// the append-only event log, the `received` watermark and, for the ask lifecycle, the action IDs it
// has applied and its stored state, `closed` or `discarded`; every other state is derived
// (ask-lifecycle, design decision 3). Only its methods change it, and only ask-core holds it (AD-3).

import {
  ACTION_ID_PATTERN,
  type AnswerEvent,
  type AskState,
  type BoardDocument,
  type DiscardedEvent,
  type DiscardReason,
  type LifecycleAskInput,
  type OutputEvent,
  type UpdateAction,
} from "@askboard/contract";
import { type ActRefusal, eventsOfActs } from "./lifecycle/acts.ts";
import { type Entry, EventLog } from "./lifecycle/log.ts";
import { BoardModel, type QuestionRecord } from "./lifecycle/model.ts";
import { askStateOf, type QuestionStatus, questionStatus } from "./lifecycle/states.ts";
import { applyActions, type UpdateEffects, type UpdateOutcome } from "./lifecycle/updates.ts";
import { type LifecycleBoardView, type QuestionFacts, questionView } from "./lifecycle/views.ts";
import { cursorOf } from "./text.ts";

export { frozenCopy } from "./lifecycle/log.ts";

export type AskInit = {
  readonly epoch: string;
  readonly askId: string;
  /** The first accepted request, canonicalized (RFC 8785), for the resend rule (AD-6). */
  readonly request: string;
  readonly title: string;
  /** The ask's items, presentation and delivery, as input format 1.1 accepted them. */
  readonly input: Pick<LifecycleAskInput, "items" | "presentation" | "delivery">;
  readonly link: string;
  /** Who answers this ask (FR-19), settled when it is created. */
  readonly who: string;
};

/** The user's explicit answer, as the board page's answer command carries it (AD-10). */
export type AnswerCommandInput = {
  readonly itemId: string;
  readonly rev: number;
  readonly choice: readonly string[];
  /** RFC 3339 UTC: when the user acted, as the board stamped it (FR-19). */
  readonly when: string;
};

/** Why an answer command appended nothing. */
export type AnswerRefusal =
  | "unknown-ask"
  | "discarded"
  | "unknown-item"
  | "answered"
  | "stale-rev"
  | "choice"
  | "when"
  /** The agent closed the ask (ask-lifecycle). */
  | "closed";

export type AnswerOutcome =
  | { readonly ok: true; readonly event: AnswerEvent }
  | { readonly ok: false; readonly refusal: AnswerRefusal; readonly detail: string };

/** An answer the log holds, as the board shows it, and whether `received` has passed it. */
export type LoggedAnswerView = {
  readonly choice: readonly string[];
  readonly when: string;
  readonly delivered: boolean;
};

/** What a board shows of an ask's question: its revision and the answer the log holds. */
export type QuestionView = {
  readonly itemId: string;
  readonly rev: number;
  readonly answer?: LoggedAnswerView;
};

/**
 * What E1's `board-host` reads of an ask (AD-12), until it moves onto `LifecycleBoardView`
 * (ask-lifecycle, task 5.1): the board document, typed as E1's though it is board document 1.1 and
 * may hold several questions or areas; the state; every question in board order. A discarded ask's
 * document holds no item, since its tombstone dropped them (AD-21).
 */
export type BoardView = {
  readonly document: BoardDocument;
  readonly state: AskState;
  readonly questions: readonly QuestionView[];
};

/** An ask as the `ask` result names it. */
export type AskSummary = {
  readonly askId: string;
  readonly state: AskState;
  /** The ask's first cursor, `<epoch>.0`. */
  readonly cursor: string;
  readonly board: string;
};

/** The board page's act command: the user's acts, applied once per action ID, all or none (AD-20). */
export type ActCommandInput = {
  /** 22 base64url characters the board page draws; a resend keeps it. */
  readonly actionId: string;
  readonly acts: readonly unknown[];
};

export type ActOutcome =
  /** Appended now, or, `repeated`, earlier under the same action ID: the same events. */
  | { readonly ok: true; readonly events: readonly OutputEvent[]; readonly repeated: boolean }
  | {
      readonly ok: false;
      readonly refusal: "unknown-ask" | "discarded" | "closed" | "command" | ActRefusal;
      readonly detail: string;
      /** The index of the act that refused the whole command. */
      readonly index?: number;
      readonly itemId?: string;
    };

const ACTION_ID = new RegExp(ACTION_ID_PATTERN);

const refused = (refusal: AnswerRefusal, detail: string): AnswerOutcome => ({
  ok: false,
  refusal,
  detail,
});

// E1's refusals for what an act refusal means to an answer command.
const E1_REFUSALS: Readonly<Partial<Record<ActRefusal, AnswerRefusal>>> = {
  "unknown-item": "unknown-item",
  "stale-rev": "stale-rev",
  when: "when",
};

export class Ask {
  readonly epoch: string;
  readonly askId: string;
  readonly link: string;
  readonly who: string;
  #request: string;
  readonly #head: {
    readonly askId: string;
    readonly title: string;
    readonly presentation?: LifecycleAskInput["presentation"];
    readonly delivery?: LifecycleAskInput["delivery"];
  };
  // The ask's items; gone once it is discarded (AD-21).
  #model: BoardModel | undefined;
  readonly #log = new EventLog();
  #received = 0;
  #stored: "closed" | "discarded" | undefined;
  // The events each applied action ID appended, by action ID (AD-20).
  #actions = new Map<string, readonly OutputEvent[]>();

  constructor(init: AskInit) {
    this.epoch = init.epoch;
    this.askId = init.askId;
    this.#request = init.request;
    this.link = init.link;
    this.who = init.who;
    const { presentation, delivery, items } = init.input;
    this.#head = {
      askId: init.askId,
      title: init.title,
      ...(presentation === undefined ? {} : { presentation }),
      ...(delivery === undefined ? {} : { delivery }),
    };
    this.#model = BoardModel.of(items);
  }

  /** The first accepted request, canonicalized; empty once the ask is discarded. */
  get request(): string {
    return this.#request;
  }

  get state(): AskState {
    const model = this.#model;
    return askStateOf({
      ...(this.#stored === undefined ? {} : { stored: this.#stored }),
      acted: this.#log.hasActed() || (model?.recordedEver ?? false),
      questions: (model?.questions() ?? []).map((question) => this.#status(question).state),
    });
  }

  get summary(): AskSummary {
    return {
      askId: this.askId,
      state: this.state,
      cursor: cursorOf(this.epoch, 0),
      board: this.link,
    };
  }

  /** The `seq` of the latest event, 0 before the first. */
  get latestSeq(): number {
    return this.#log.latestSeq;
  }

  /** The cursor of the latest event, `<epoch>.0` before the first. */
  get cursor(): string {
    return cursorOf(this.epoch, this.latestSeq);
  }

  /** The events after `seq`, in order, each carrying its own cursor (AD-3). */
  eventsAfter(seq: number): readonly OutputEvent[] {
    return this.#log.after(seq).map((entry) => entry.event);
  }

  /** The entries after `seq`: the events with their command's group number. */
  entriesAfter(seq: number): readonly Entry[] {
    return this.#log.after(seq);
  }

  /**
   * Raises `received` to `seq`, never past the latest event and never lower than it is (AD-3).
   * Returns whether it rose.
   */
  markRead(seq: number): boolean {
    const raised = Math.min(seq, this.latestSeq);
    if (raised <= this.#received) return false;
    this.#received = raised;
    return true;
  }

  get received(): number {
    return this.#received;
  }

  /** E1's board document type over the ask's document; a tombstone's holds no item (AD-21). */
  get document(): BoardDocument {
    const document = this.#model?.document(this.#head) ?? { ...this.#head, items: [] };
    return document as unknown as BoardDocument;
  }

  /** E1's view of the board, for `board-host` until it reads `lifecycleView` (task 5.1). */
  get view(): BoardView {
    const questions = (this.#model?.questions() ?? []).map(({ id, rev, mark }) => {
      const answer = questionStatus(mark, this.#log.ofItem(id)).answer;
      if (answer?.kind !== "logged") return { itemId: id, rev };
      const { seq, event } = answer.entry;
      const delivered = this.#received >= seq;
      return {
        itemId: id,
        rev,
        answer: { choice: event.choice ?? [], when: event.when, delivered },
      };
    });
    return { document: this.document, state: this.state, questions };
  }

  /** What `board-host` shows of the ask (AD-12): nothing of a tombstone (AD-21). */
  get lifecycleView(): LifecycleBoardView {
    const state = this.state;
    const model = this.#model;
    if (state === "discarded" || model === undefined)
      return { askId: this.askId, state: "discarded" };
    const questions = model
      .questions()
      .map((question) => questionView(this.#facts(question), this.#received));
    return { askId: this.askId, state, document: model.document(this.#head), questions };
  }

  /**
   * E1's answer command, without an action ID: refused on a question already answered or
   * declined, else applied as one answer act (AD-10).
   */
  answer(command: AnswerCommandInput): AnswerOutcome {
    if (this.#stored === "discarded") return refused("discarded", "the ask was discarded");
    if (this.#stored === "closed") return refused("closed", "the ask is closed");
    // A command comes from outside the process: its shape is checked here too, not only typed.
    const { choice, when } = command;
    if (!Array.isArray(choice) || !choice.every((label) => typeof label === "string")) {
      return refused("choice", "the choice is not a list of option labels");
    }
    if (typeof when !== "string") return refused("when", "the answer's time is not text");
    if (!Number.isInteger(command.rev)) return refused("stale-rev", "the revision is not a number");
    const question =
      typeof command.itemId === "string" ? this.#model?.question(command.itemId) : undefined;
    if (question === undefined) return refused("unknown-item", "the ask has no such question");
    if (this.#status(question).answer !== undefined) {
      return refused("answered", "the question is already answered");
    }
    const act = { type: "answer", itemId: question.id, rev: command.rev, choice, when };
    const outcome = this.#apply([act]);
    if (!outcome.ok) {
      const refusal = E1_REFUSALS[outcome.refusal as ActRefusal] ?? "choice";
      return refused(refusal, outcome.detail);
    }
    return { ok: true, event: outcome.events[0] as AnswerEvent };
  }

  /**
   * The board's act command (AD-20): applied once per action ID, all or none, its events appended
   * in one step. A repeated action ID appends nothing and answers as before, even once the ask is
   * closed.
   */
  act(command: ActCommandInput): ActOutcome {
    if (this.#stored === "discarded") {
      return { ok: false, refusal: "discarded", detail: "the ask was discarded" };
    }
    const { actionId, acts } = command;
    if (typeof actionId !== "string" || !ACTION_ID.test(actionId)) {
      return {
        ok: false,
        refusal: "command",
        detail: "the action ID is not 22 base64url characters",
      };
    }
    if (!Array.isArray(acts) || acts.length === 0) {
      return { ok: false, refusal: "command", detail: "the command holds no act" };
    }
    const earlier = this.#actions.get(actionId);
    if (earlier !== undefined) return { ok: true, events: earlier, repeated: true };
    if (this.#stored === "closed")
      return { ok: false, refusal: "closed", detail: "the ask is closed" };
    const outcome = this.#apply(acts);
    if (outcome.ok) this.#actions.set(actionId, outcome.events);
    return outcome;
  }

  /**
   * The agent's update (AD-6): every action applied in order to a copy of the items, kept only
   * when all apply. Appends no event (AD-3).
   */
  update(actions: readonly UpdateAction[]): { outcome: UpdateOutcome; effects?: UpdateEffects } {
    const model = this.#model?.clone();
    if (model === undefined) throw new Error("update: the ask is discarded");
    const applied = applyActions({ askId: this.askId, model, log: this.#log }, actions);
    if (!applied.ok) {
      const { ok: _, ...refusal } = applied;
      return { outcome: { kind: "refused", askId: this.askId, ...refusal } };
    }
    this.#model = model;
    const outcome = {
      kind: "updated",
      askId: this.askId,
      state: this.state,
      applied: applied.applied,
    } as const;
    return { outcome, effects: applied.effects };
  }

  /**
   * Appends the final `discarded` event, after which the ask takes no answer (AD-21). Returns the
   * event, or undefined when the ask was already discarded.
   */
  discard(reason: DiscardReason): DiscardedEvent | undefined {
    if (this.#stored === "discarded") return undefined;
    const event: DiscardedEvent = { cursor: this.#nextCursor(), type: "discarded", reason };
    const [entry] = this.#log.append([event]);
    this.#stored = "discarded";
    return entry?.event as DiscardedEvent;
  }

  // Checks the acts and appends their events in one step.
  #apply(acts: readonly unknown[]): ActOutcome {
    const model = this.#model as BoardModel;
    const built = eventsOfActs({ epoch: this.epoch, who: this.who, model, log: this.#log }, acts);
    if (!built.ok) {
      const { refusal, detail, itemId } = built.problem;
      return {
        ok: false,
        refusal,
        detail,
        index: built.index,
        ...(itemId === undefined ? {} : { itemId }),
      };
    }
    const entries = this.#log.append(built.events);
    model.noteEntries(entries);
    return { ok: true, events: entries.map((entry) => entry.event), repeated: false };
  }

  #status(question: QuestionRecord): QuestionStatus {
    return questionStatus(question.mark, this.#log.ofItem(question.id));
  }

  #facts(question: QuestionRecord): QuestionFacts {
    const entries = this.#log.ofItem(question.id);
    return { question, entries, status: questionStatus(question.mark, entries) };
  }

  #nextCursor(): string {
    return cursorOf(this.epoch, this.latestSeq + 1);
  }
}
