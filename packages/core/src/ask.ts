// The Ask aggregate (design decision 3): the request as accepted, the board document, the state,
// the append-only event log and the `received` watermark. Only its methods change it, and only
// ask-core holds it (AD-3).

import {
  type AnswerEvent,
  type AskState,
  BOARD_DOCUMENT_VERSION,
  type BoardDocument,
  type DiscardedEvent,
  type DiscardReason,
  type OutputEvent,
  type QuestionItem,
} from "@askboard/contract";
import { cursorOf, isRealUtcTime } from "./text.ts";

export type AskInit = {
  readonly epoch: string;
  readonly askId: string;
  /** The first accepted request, canonicalized (RFC 8785), for the resend rule (AD-6). */
  readonly request: string;
  readonly title: string;
  readonly question: QuestionItem;
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
  | "when";

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

/** What `board-host` needs to show an ask's board (AD-12). */
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

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

/** A deep copy that shares nothing with the caller, frozen. */
export const frozenCopy = <T>(value: T): T => deepFreeze(JSON.parse(JSON.stringify(value)) as T);

type Entry<E extends OutputEvent = OutputEvent> = { readonly seq: number; readonly event: E };

const refused = (refusal: AnswerRefusal, detail: string): AnswerOutcome => ({
  ok: false,
  refusal,
  detail,
});

// Why a choice cannot be an answer to a question with these options, or undefined when it can.
const choiceProblem = (
  choice: readonly string[],
  options: readonly { readonly label: string }[],
  multiSelect: boolean,
): string | undefined => {
  if (choice.length === 0) return "the choice is empty";
  if (new Set(choice).size !== choice.length) return "the choice names an option twice";
  if (!multiSelect && choice.length > 1) return "the question takes one option";
  const labels = new Set(options.map((option) => option.label));
  const unknown = choice.find((label) => !labels.has(label));
  return unknown === undefined ? undefined : "the choice names a label that is not an option";
};

export class Ask {
  readonly epoch: string;
  readonly askId: string;
  readonly request: string;
  readonly link: string;
  readonly who: string;
  /** Revision 1 of the board document; E1 has no other (AD-12, AD-20). */
  readonly document: BoardDocument;
  #state: AskState = "waiting";
  readonly #log: Entry[] = [];
  #received = 0;

  constructor(init: AskInit) {
    this.epoch = init.epoch;
    this.askId = init.askId;
    this.request = init.request;
    this.link = init.link;
    this.who = init.who;
    const { type, id, props } = init.question;
    this.document = frozenCopy({
      version: BOARD_DOCUMENT_VERSION,
      askId: init.askId,
      title: init.title,
      items: [{ type, id, rev: 1, props }],
    });
  }

  get state(): AskState {
    return this.#state;
  }

  get summary(): AskSummary {
    return {
      askId: this.askId,
      state: this.#state,
      cursor: cursorOf(this.epoch, 0),
      board: this.link,
    };
  }

  /** The `seq` of the latest event, 0 before the first. */
  get latestSeq(): number {
    return this.#log.length;
  }

  /** The cursor of the latest event, `<epoch>.0` before the first. */
  get cursor(): string {
    return cursorOf(this.epoch, this.latestSeq);
  }

  /** The events after `seq`, in order, each carrying its own cursor (AD-3). */
  eventsAfter(seq: number): readonly OutputEvent[] {
    return this.#log.slice(Math.max(seq, 0)).map((entry) => entry.event);
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

  get view(): BoardView {
    return {
      document: this.document,
      state: this.#state,
      questions: this.document.items.map(({ id, rev }) => {
        const logged = this.#answerTo(id);
        if (logged === undefined) return { itemId: id, rev };
        const { choice = [], when } = logged.event;
        return {
          itemId: id,
          rev,
          answer: { choice, when, delivered: this.#received >= logged.seq },
        };
      }),
    };
  }

  /**
   * Appends the user's answer when the command can be one: an open question of this ask at its
   * current revision, a choice of its option labels (one unless `multiSelect`), and a real time.
   * Anything else appends nothing (AD-10).
   */
  answer(command: AnswerCommandInput): AnswerOutcome {
    if (this.#state === "discarded") return refused("discarded", "the ask was discarded");
    const question = this.document.items.find((item) => item.id === command.itemId);
    if (question === undefined) return refused("unknown-item", "the ask has no such question");
    if (this.#answerTo(question.id)) return refused("answered", "the question is already answered");
    if (command.rev !== question.rev) {
      return refused("stale-rev", `the question is at revision ${question.rev}`);
    }
    const { options, multiSelect = false } = question.props;
    const problem = choiceProblem(command.choice, options, multiSelect);
    if (problem !== undefined) return refused("choice", problem);
    if (!isRealUtcTime(command.when)) {
      return refused("when", "the answer's time is not a real RFC 3339 UTC time");
    }
    const event: AnswerEvent = {
      cursor: this.#nextCursor(),
      type: "answer",
      itemId: question.id,
      rev: question.rev,
      who: this.who,
      when: command.when,
      choice: [...command.choice],
    };
    this.#append(event);
    this.#state = "answered";
    return { ok: true, event: this.#log.at(-1)?.event as AnswerEvent };
  }

  /**
   * Appends the final `discarded` event, after which the ask takes no answer (AD-21). Returns the
   * event, or undefined when the ask was already discarded.
   */
  discard(reason: DiscardReason): DiscardedEvent | undefined {
    if (this.#state === "discarded") return undefined;
    this.#append({ cursor: this.#nextCursor(), type: "discarded", reason });
    this.#state = "discarded";
    return this.#log.at(-1)?.event as DiscardedEvent;
  }

  #nextCursor(): string {
    return cursorOf(this.epoch, this.#log.length + 1);
  }

  #append(event: OutputEvent): void {
    this.#log.push({ seq: this.#log.length + 1, event: frozenCopy(event) });
  }

  #answerTo(itemId: string): Entry<AnswerEvent> | undefined {
    return this.#log.find(
      (entry): entry is Entry<AnswerEvent> =>
        entry.event.type === "answer" && entry.event.itemId === itemId,
    );
  }
}
