// ask-core: the epoch's asks, held in memory (AD-14), and the one subscription through which the
// adapters hear what happened (design decision 3). Adapters submit commands; only this module
// changes asks (AD-3).

import type {
  AskInput,
  AskState,
  DiscardReason,
  OutputEvent,
  UnavailableReason,
} from "@askboard/contract";
import { type RequestProblem, validateAskRequest } from "@askboard/contract/validate";
import {
  type AnswerCommandInput,
  type AnswerOutcome,
  Ask,
  type AskSummary,
  type BoardView,
} from "./ask.ts";
import { canonicalize } from "./canonical.ts";
import type { CorePorts } from "./ports.ts";
import { cursorOf, deriveTitle, makeEpoch, nameOf, parseCursor } from "./text.ts";

/** Who answers when neither the ask nor the machine names anyone. */
export const UNKNOWN_USER = "unknown user";

export type AskOutcome =
  | { readonly kind: "invalid"; readonly problems: readonly RequestProblem[] }
  | {
      readonly kind: "unavailable";
      readonly askId: string;
      readonly reason: UnavailableReason;
      readonly detail: string;
    }
  | { readonly kind: "created" | "resent"; readonly ask: AskSummary }
  /** The ID is that of an ask of this epoch, and the request is not an identical resend. */
  | { readonly kind: "in-use"; readonly askId: string }
  /** The session is ending: its asks were discarded, and it takes no new one. */
  | { readonly kind: "ending" };

/**
 * What the subscription carries: an event appended to an ask's log; the ask's `received`
 * watermark raised to a cursor, which `board-host` turns into delivery receipts (AD-3); or the ask
 * discarded, after its final event, which its live board is told (AD-21).
 */
export type CoreEvent =
  | { readonly type: "appended"; readonly askId: string; readonly event: OutputEvent }
  | { readonly type: "received"; readonly askId: string; readonly cursor: string }
  | { readonly type: "discarded"; readonly askId: string; readonly reason: DiscardReason };

/** An ask's events after a cursor (AD-3, AD-10). */
export type ReadOutcome =
  | {
      readonly kind: "events";
      readonly askId: string;
      readonly state: AskState;
      /** The ask's latest cursor. */
      readonly cursor: string;
      readonly events: readonly OutputEvent[];
    }
  /** The cursor is of another epoch: the ask it was issued for is gone. */
  | { readonly kind: "discarded"; readonly askId: string; readonly cursor: string }
  /** A cursor of this epoch for an ask this epoch does not hold. */
  | { readonly kind: "unknown"; readonly askId: string }
  /** A cursor of this epoch past the ask's latest event, which no result issued. */
  | {
      readonly kind: "beyond";
      readonly askId: string;
      readonly cursor: string;
      readonly latest: string;
    }
  | { readonly kind: "malformed"; readonly askId: string; readonly cursor: string };

export type Listener = (event: CoreEvent) => void;

export class AskCore {
  /** The session process's random epoch (AD-2): ask IDs and cursors are scoped to it. */
  readonly epoch: string;
  readonly #ports: CorePorts;
  readonly #asks = new Map<string, Ask>();
  readonly #listeners = new Set<Listener>();
  // Creations under way, by ask ID, so that a second request for one ID waits for the first.
  readonly #creating = new Map<string, Promise<unknown>>();
  // Set by the discard at session exit: no ask may be created after it, or it would never be
  // discarded.
  #ending = false;

  constructor(ports: CorePorts) {
    this.#ports = ports;
    this.epoch = makeEpoch(ports.randomness);
  }

  /**
   * Creates an ask, in the order of SOLUTION-DESIGN §5.1: validate, check that a board can be
   * shown (else `unavailable`, creating nothing), settle who answers, make the link, store the ask
   * with its rev-1 board document, then open the board. A failure to make the link rejects, and
   * nothing is created.
   */
  async ask(request: unknown): Promise<AskOutcome> {
    const checked = validateAskRequest(request);
    if (!checked.ok) return { kind: "invalid", problems: checked.problems };
    const { askId } = checked.value;
    const canonical = canonicalize(checked.value);
    // From the last wait to the creation's registration nothing awaits, so no other request for
    // this ID can slip in between.
    for (let pending = this.#creating.get(askId); pending; pending = this.#creating.get(askId)) {
      await pending;
    }
    const existing = this.#asks.get(askId);
    if (existing !== undefined) return this.#resend(existing, canonical);
    if (this.#ending) return { kind: "ending" };
    const creation = this.#create(checked.value, canonical);
    this.#creating.set(
      askId,
      creation.then(
        () => undefined,
        () => undefined,
      ),
    );
    try {
      return await creation;
    } finally {
      this.#creating.delete(askId);
    }
  }

  /**
   * The board's answer command for one of the ask's questions: appended as an answer event when
   * it is one the user could give, else refused with nothing appended (AD-10).
   */
  answer(askId: string, command: AnswerCommandInput): AnswerOutcome {
    const ask = this.#asks.get(askId);
    if (ask === undefined) {
      return { ok: false, refusal: "unknown-ask", detail: "the ask is not one of this session" };
    }
    const outcome = ask.answer(command);
    if (outcome.ok) this.#publish({ type: "appended", askId, event: outcome.event });
    return outcome;
  }

  /**
   * The ask's state, latest cursor and events after `after`. A cursor of another epoch reports
   * the ask discarded, never as having no answer yet (AD-10). Reading does not raise `received`:
   * the reader marks what it returned with `markRead`.
   */
  read(askId: string, after: string): ReadOutcome {
    const cursor = parseCursor(after);
    if (cursor === undefined) return { kind: "malformed", askId, cursor: after };
    if (cursor.epoch !== this.epoch) return { kind: "discarded", askId, cursor: after };
    const ask = this.#asks.get(askId);
    if (ask === undefined) return { kind: "unknown", askId };
    if (cursor.seq > ask.latestSeq) {
      return { kind: "beyond", askId, cursor: after, latest: ask.cursor };
    }
    const events = ask.eventsAfter(cursor.seq);
    return { kind: "events", askId, state: ask.state, cursor: ask.cursor, events };
  }

  /**
   * Raises the ask's `received` watermark to a cursor a read returned, and tells the subscribers
   * when it rose. Returns whether it rose. An ask or cursor no read returned is a bug, and throws.
   */
  markRead(askId: string, cursor: string): boolean {
    const ask = this.#asks.get(askId);
    const parsed = parseCursor(cursor);
    if (ask === undefined || parsed === undefined || parsed.epoch !== this.epoch) {
      throw new Error(`markRead: ${cursor} is not a cursor of the ask ${askId} in this epoch`);
    }
    if (!ask.markRead(parsed.seq)) return false;
    this.#publish({ type: "received", askId, cursor: cursorOf(this.epoch, ask.received) });
    return true;
  }

  /**
   * Discards every ask not discarded yet: each gains a final `discarded` event, and the
   * subscribers hear the event and the discard before this returns, so live boards are told before
   * the process ends (AD-2, AD-21). The asks stay as tombstones: their IDs stay in use and their
   * events readable. From then on the core creates no ask, one still being created included.
   * Returns how many asks it discarded.
   */
  discardAll(reason: DiscardReason): number {
    this.#ending = true;
    let discarded = 0;
    for (const [askId, ask] of this.#asks) {
      const event = ask.discard(reason);
      if (event === undefined) continue;
      discarded += 1;
      this.#publish({ type: "appended", askId, event });
      this.#publish({ type: "discarded", askId, reason });
    }
    return discarded;
  }

  /** What the ask's board shows, or undefined for an ask this epoch does not hold. */
  board(askId: string): BoardView | undefined {
    return this.#asks.get(askId)?.view;
  }

  /** Hears every event, `received` raise and discard; returns the unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // An identical request under an open ask's ID returns its board and opens nothing; any other
  // request under the ID of an ask of this epoch is refused (AD-6, FR-5).
  #resend(ask: Ask, request: string): AskOutcome {
    if (ask.state === "discarded" || ask.request !== request) {
      return { kind: "in-use", askId: ask.askId };
    }
    return { kind: "resent", ask: ask.summary };
  }

  // Every listener hears the event; one that throws is reported and does not stop the others.
  #publish(event: CoreEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.#ports.report(error);
      }
    }
  }

  async #create(input: AskInput, request: string): Promise<AskOutcome> {
    const { askId } = input;
    const showing = await this.#ports.showing.check();
    if (!showing.showable) {
      return { kind: "unavailable", askId, reason: showing.reason, detail: showing.detail };
    }
    const who = await this.#who(input);
    const link = await this.#ports.address.link(askId);
    if (this.#ending) return { kind: "ending" };
    const [question] = input.items;
    const title = input.title ?? deriveTitle(question.props.text);
    const ask = new Ask({ epoch: this.epoch, askId, request, title, question, link, who });
    this.#asks.set(askId, ask);
    try {
      this.#ports.showing.open(link);
    } catch (error) {
      this.#ports.report(error);
    }
    return { kind: "created", ask: ask.summary };
  }

  // The ask's expected user, else the git user name, else the login name (FR-19). A lookup that
  // fails is reported and counts as no name.
  async #who(input: AskInput): Promise<string> {
    const { identity, report } = this.#ports;
    const lookup = async (name: () => Promise<string | undefined>) => {
      try {
        return nameOf(await name());
      } catch (error) {
        report(error);
        return undefined;
      }
    };
    return (
      nameOf(input.expectedUser) ??
      (await lookup(() => identity.gitUserName())) ??
      (await lookup(() => identity.loginName())) ??
      UNKNOWN_USER
    );
  }
}
