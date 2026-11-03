// ask-core: the epoch's asks, held in memory (AD-14), and the one subscription through which the
// adapters hear what happened (design decision 3). Adapters submit commands; only this module
// changes asks (AD-3).

import {
  type AgentStatus,
  ASK_IMAGES_MAX_BYTES,
  type AskState,
  type ClosedReason,
  type DiscardReason,
  type DraftRecord,
  GRACE_PERIOD_MS,
  type LifecycleAskInput,
  type OutputEvent,
  type PresentationSetting,
  type UnavailableReason,
  type UnresolvedPointerWarning,
  type WriteOutcome,
} from "@askboard/contract";
import {
  type RequestProblem,
  validateAskRequest,
  validateUpdateRequest,
} from "@askboard/contract/validate";
import {
  type ActCommandInput,
  type ActOutcome,
  type AnswerCommandInput,
  type AnswerOutcome,
  Ask,
  type AskSummary,
  type BoardView,
  type FullValue,
} from "./ask.ts";
import { canonicalize } from "./canonical.ts";
import {
  type ContextRequest,
  contextRequestsOf,
  hasPointers,
  type QuestionContext,
  resolveContext,
} from "./context/resolve.ts";
import { rootOf } from "./context/root.ts";
import { type EditorLaunchTarget, MISSING, type Source, sourcePathOf } from "./context/source.ts";
import { Configuration } from "./config/configuration.ts";
import { askLanguage } from "./config/language.ts";
import type { SettingsInEffect } from "./config/settings.ts";
import type { UpdateOutcome as AskUpdateOutcome } from "./lifecycle/updates.ts";
import type { KeptRevisions, LifecycleBoardView } from "./lifecycle/views.ts";
import type { CorePorts } from "./ports.ts";
import { AgentStatuses } from "./push/agent-status.ts";
import { expectedAnswerer } from "./push/answerer.ts";
import { PushDelivery } from "./push/delivery.ts";
import type {
  AskOverview,
  Binding,
  CallIdentity,
  ClientVersionSource,
  DeliveredOutcome,
  OwnerRefusal,
  PushAskOutcome,
  PushReadOutcome,
  StopEnd,
  StopFit,
  StopOutcome,
  WhoAsked,
} from "./push/ports.ts";
import { cursorOf, deriveTitle, makeEpoch, nameOf, parseCursor, timeOf } from "./text.ts";

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
  | {
      readonly kind: "created" | "resent";
      readonly ask: AskSummary;
      /** A created ask's unresolved pointers, in item order (excerpts, design decision 4). */
      readonly warnings?: readonly UnresolvedPointerWarning[];
    }
  /** The ID is that of an ask of this epoch, and the request is not an identical resend. */
  | { readonly kind: "in-use"; readonly askId: string }
  /** The session is ending: its asks were discarded, and it takes no new one. */
  | { readonly kind: "ending" }
  | PushAskOutcome;

/**
 * What the subscription carries: events appended to an ask's log, all those of one command in one
 * notification; the ask's `received` watermark raised to a cursor, which `board-host` turns into
 * delivery receipts (AD-3); or the ask discarded, after its final event, which its live board is
 * told (AD-21). The ask lifecycle adds, for changes that append no event: `document`, the board
 * document changed; `state`, what the board's state shows changed, such as a recorded answer, a
 * reopen, a delete or a reply; `closed`, the ask closed, which wakes its waiters (ask-lifecycle,
 * design decision 3). An update publishes each once, after it applies, in that order. Push
 * delivery adds `agent`: the ask's agent status changed, which is presence, never logged (AD-4).
 */
export type CoreEvent = E1Event | LifecycleEvent | PushEvent;

/** E1's events: an ask's log appended to, its `received` raised, the ask discarded. */
export type E1Event =
  | {
      readonly type: "appended";
      readonly askId: string;
      /** The first of `events`, as E1's subscribers read it. */
      readonly event: OutputEvent;
      /** Every event one command appended, in order. */
      readonly events: readonly OutputEvent[];
    }
  | { readonly type: "received"; readonly askId: string; readonly cursor: string }
  | { readonly type: "discarded"; readonly askId: string; readonly reason: DiscardReason };

/** The ask lifecycle's events, for changes that append no event (ask-lifecycle). */
export type LifecycleEvent =
  | { readonly type: "document"; readonly askId: string }
  | { readonly type: "state"; readonly askId: string }
  | { readonly type: "closed"; readonly askId: string; readonly reason: ClosedReason };

/**
 * Push delivery's events (E4): the ask's agent status changed, presence only (AD-4); who asked
 * changed, its owner relabelled (design decision 4, Origin, plan B).
 */
export type PushEvent =
  | { readonly type: "agent"; readonly askId: string; readonly status: AgentStatus }
  | { readonly type: "origin"; readonly askId: string };

/** An ask's events after a cursor (AD-3, AD-10). */
export type ReadOutcome =
  | {
      readonly kind: "events";
      readonly askId: string;
      readonly state: AskState;
      /** The ask's latest cursor. */
      readonly cursor: string;
      readonly events: readonly OutputEvent[];
      /**
       * Each event's command group, in the order of `events`: one command's events share a
       * number, which `collect`'s pager keeps together and which never reaches the wire
       * (ask-lifecycle, design decision 4). ask-core always sets it.
       */
      readonly groups?: readonly number[];
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
  | { readonly kind: "malformed"; readonly askId: string; readonly cursor: string }
  | PushReadOutcome;

export type Listener = (event: CoreEvent) => void;

/** What closing an ask did (FR-6). */
export type CloseOutcome = {
  readonly kind: "closed" | "already-closed" | "discarded" | "unknown";
  readonly askId: string;
};

/** What `update` did: the contract refused the request, or the ask's own outcome. */
export type UpdateOutcome =
  | { readonly kind: "invalid"; readonly problems: readonly RequestProblem[] }
  /** An ask the agent closed: a typed result (AD-6). */
  | { readonly kind: "closed"; readonly askId: string }
  /** A discarded ask, or one this epoch does not hold: a typed result (AD-10). */
  | { readonly kind: "discarded"; readonly askId: string }
  | AskUpdateOutcome;

export class AskCore {
  /** The session process's random epoch (AD-2): ask IDs and cursors are scoped to it. */
  readonly epoch: string;
  readonly #ports: CorePorts;
  readonly #asks = new Map<string, Ask>();
  readonly #listeners = new Set<Listener>();
  // Creations under way, by ask ID, so that a second request for one ID waits for the first.
  readonly #creating = new Map<string, Promise<unknown>>();
  // Updates reading their pointers, by ask ID, so that the ask's next update waits for the first.
  readonly #updating = new Map<string, Promise<unknown>>();
  // Set by the discard at session exit: no ask may be created after it, or it would never be
  // discarded.
  #ending = false;
  readonly #push: PushDelivery;
  readonly #statuses: AgentStatuses;
  // settings-languages: the configuration, read on first use.
  readonly #configuration: Configuration;

  constructor(ports: CorePorts) {
    this.#ports = ports;
    this.epoch = makeEpoch(ports.randomness);
    this.#push = new PushDelivery(ports, {
      epoch: this.epoch,
      ask: (askId) => this.#asks.get(askId),
      markRead: (askId, cursor) => this.markRead(askId, cursor),
    });
    this.#statuses = new AgentStatuses(ports.header, ports.clock, (askId, status) =>
      this.#publish({ type: "agent", askId, status }),
    );
    this.#configuration = new Configuration(ports);
  }

  /**
   * Creates an ask, in the order of SOLUTION-DESIGN §5.1: validate, check that a board can be
   * shown (else `unavailable`, creating nothing), settle who answers, make the link, store the ask
   * with its rev-1 board document, then open the board. A failure to make the link rejects, and
   * nothing is created. With `call`, the call is first bound to its agent record, whose agent owns
   * the ask it creates (design decision 4). After the showability check, a Claude Code below the
   * minimum is refused (AD-18); the board opens only while no board is working (AD-2).
   */
  async ask(request: unknown, call?: CallIdentity): Promise<AskOutcome> {
    const caller = call === undefined ? undefined : await this.#push.bind(call);
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
    if (existing !== undefined) return this.#resend(existing, canonical, caller);
    if (this.#ending) return { kind: "ending" };
    const creation = this.#create(checked.value, canonical, caller);
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
    if (outcome.ok) this.#appended(askId, [outcome.event]);
    return outcome;
  }

  /**
   * The ask's state, latest cursor and events after `after`. A cursor of another epoch reports
   * the ask discarded, never as having no answer yet (AD-10). Reading does not raise `received`:
   * the reader marks what it returned with `markRead`. An owned ask is read only by a call bound
   * to its owner (`caller`, from `bind`), and refused to any other, revealing nothing (AD-5).
   */
  read(askId: string, after: string, caller?: Binding): ReadOutcome {
    const cursor = parseCursor(after);
    if (cursor === undefined) return { kind: "malformed", askId, cursor: after };
    if (cursor.epoch !== this.epoch) return { kind: "discarded", askId, cursor: after };
    const ask = this.#asks.get(askId);
    if (ask === undefined) return { kind: "unknown", askId };
    const refusal = this.ownerRefusal(askId, caller);
    if (refusal !== undefined) return { kind: refusal, askId };
    if (cursor.seq > ask.latestSeq) {
      return { kind: "beyond", askId, cursor: after, latest: ask.cursor };
    }
    const entries = ask.entriesAfter(cursor.seq);
    const events = entries.map((entry) => entry.event);
    const groups = entries.map((entry) => entry.group);
    const outcome: ReadOutcome = {
      kind: "events",
      askId,
      state: ask.state,
      cursor: ask.cursor,
      events,
      groups,
    };
    // The agent has the events up to `after`: a tombstone drops them (AD-21).
    ask.acknowledge(cursor.seq);
    return outcome;
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
   * Discards every open ask: each gains a final `discarded` event, and the subscribers hear the
   * event and the discard before this returns, so live boards are told before the process ends
   * (AD-2, AD-21). The asks stay as tombstones: their IDs stay in use and their unacknowledged
   * events readable. A closed ask is never discarded. From then on the core creates no ask, one
   * still being created included. Returns how many asks it discarded.
   */
  discardAll(reason: DiscardReason): number {
    this.#ending = true;
    let discarded = 0;
    for (const [askId, ask] of this.#asks) {
      const event = ask.discard(reason);
      if (event === undefined) continue;
      discarded += 1;
      this.#appended(askId, [event]);
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

  // The ask lifecycle (ask-lifecycle, design decision 3).

  /**
   * The board's act command for an ask: each act checked against the state the earlier ones leave,
   * then every event appended in one step and published once; a repeated action ID appends nothing
   * and is answered as before (AD-10, AD-20).
   */
  act(askId: string, command: ActCommandInput): ActOutcome {
    const ask = this.#asks.get(askId);
    if (ask === undefined) {
      return { ok: false, refusal: "unknown-ask", detail: "the ask is not one of this session" };
    }
    const outcome = ask.act(command);
    if (outcome.ok && !outcome.repeated) this.#appended(askId, outcome.events);
    return outcome;
  }

  /**
   * The agent's `update`: validated with the contract, then applied to the ask in order, all or
   * none (AD-6). It appends no event; the subscribers hear `document` and `state` once it applies.
   * The pointers of the revisions it creates are read first, outside the aggregate; it then
   * applies in one step, so an act in between sees the old revisions (excerpts, design decision 4).
   * An update with nothing to read applies before this returns, and one ask's updates apply in the
   * order they came.
   */
  async update(request: unknown): Promise<UpdateOutcome> {
    const checked = validateUpdateRequest(request);
    if (!checked.ok) return { kind: "invalid", problems: checked.problems };
    const { askId, actions } = checked.value;
    for (let pending = this.#updating.get(askId); pending; pending = this.#updating.get(askId)) {
      await pending;
    }
    const now = timeOf(this.#ports.clock.now());
    const preview = this.#asks.get(askId)?.preview(actions, now);
    if (preview === undefined || !preview.revisions.some(({ props }) => hasPointers(props))) {
      return this.#applyUpdate(askId, actions, new Map());
    }
    const root = rootOf(this.#ports.projectRoot, this.ownerOf(askId));
    const { revisions, heldImageBytes } = preview;
    const reading = this.#resolve(revisions, root, ASK_IMAGES_MAX_BYTES - heldImageBytes);
    this.#updating.set(askId, reading);
    try {
      return this.#applyUpdate(askId, actions, await reading);
    } finally {
      this.#updating.delete(askId);
    }
  }

  /**
   * Closes an open ask (FR-6): it refuses every later act and update and keeps its data until the
   * session process exits; the subscribers hear `closed`, which wakes its waiters. The one closing
   * path: `update`'s close gives the reason `agent`.
   */
  close(askId: string, reason: ClosedReason): CloseOutcome {
    const ask = this.#asks.get(askId);
    if (ask === undefined) return { kind: "unknown", askId };
    if (ask.state === "discarded") return { kind: "discarded", askId };
    if (!ask.close(reason)) return { kind: "already-closed", askId };
    this.#publish({ type: "closed", askId, reason });
    return { kind: "closed", askId };
  }

  /** Holds the ask's draft record from its live board, replacing the one before (AD-20). */
  holdDraft(askId: string, record: DraftRecord): boolean {
    return this.#asks.get(askId)?.holdDraft(record) ?? false;
  }

  /** The draft record to restore to the ask's board: only the restore path reads it (AD-20). */
  draftToRestore(askId: string): DraftRecord | undefined {
    return this.#asks.get(askId)?.draft;
  }

  /** `board-host` accepted a board's socket for the ask (AD-21). */
  connected(askId: string): void {
    this.#asks.get(askId)?.connected();
  }

  /**
   * The ask's live board closed (AD-21): when no board is left on an open ask that has connected,
   * the grace timer starts, and when it ends with no board back, the ask is discarded with
   * `board-closed`.
   */
  disconnected(askId: string): void {
    const ask = this.#asks.get(askId);
    if (ask?.disconnected() !== true) return;
    ask.armGrace(this.#ports.clock.after(GRACE_PERIOD_MS, () => this.#graceEnded(askId)));
  }

  /** An item's full value for `fetch` (FR-20); an ask this epoch does not hold is discarded. */
  fullValue(askId: string, itemId: string): FullValue {
    return this.#asks.get(askId)?.fullValue(itemId) ?? { kind: "discarded", askId };
  }

  #graceEnded(askId: string): void {
    const ask = this.#asks.get(askId);
    if (ask?.graceEnded() !== true) return;
    const event = ask.discard("board-closed");
    if (event === undefined) return;
    this.#appended(askId, [event]);
    this.#publish({ type: "discarded", askId, reason: "board-closed" });
  }

  /** What `board-host` shows of the ask (AD-12), or undefined for an ask this epoch does not hold. */
  lifecycleBoard(askId: string): LifecycleBoardView | undefined {
    return this.#asks.get(askId)?.lifecycleView;
  }

  /**
   * The revisions ask-core keeps of each question of an ask, with their props, read-only (AD-20):
   * none for a discarded ask, and undefined for an ask this epoch does not hold.
   */
  keptRevisions(askId: string): readonly KeptRevisions[] | undefined {
    return this.#asks.get(askId)?.keptRevisions;
  }

  #appended(askId: string, events: readonly OutputEvent[]): void {
    const [event] = events;
    if (event !== undefined) this.#publish({ type: "appended", askId, event, events });
  }

  // Push delivery (E4, design decisions 4 and 5).

  /** Binds a call to its agent record, once per call; undefined when it carries none (AD-5). */
  bind(call: CallIdentity): Promise<Binding | undefined> {
    return this.#push.bind(call);
  }

  /** The ask's owner key and origin, or undefined for an unchecked ask (AD-5). */
  ownerOf(askId: string): Binding | undefined {
    return this.#push.ownerOf(askId);
  }

  /**
   * Why a call bound to `caller` (absent when it carried no record) may not act on the ask, or
   * undefined when it may: the one owner check every tool that acts on an ask applies (AD-5). An
   * unchecked ask takes any caller.
   */
  ownerRefusal(askId: string, caller?: Binding): OwnerRefusal | undefined {
    return this.#push.refusal(askId, caller);
  }

  /**
   * The epoch's asks in the order they were created, discarded ones included, as the local API
   * reads them for the mod's poll, the pending-asks list and the terminal link (design decision 2).
   */
  overview(): readonly AskOverview[] {
    return [...this.#asks.values()].map((ask) => this.#push.overview(ask));
  }

  /** The mod's report of a push (AD-3): raises `received`, and the board's receipt follows. */
  delivered(askId: string, cursor: string): DeliveredOutcome {
    return this.#push.delivered(askId, cursor);
  }

  /**
   * The stop guard's decision on the owner's stop, acted on before it returns (AD-10): a block
   * carries what `fit` keeps of the events above `received`, and raises `received` to that alone;
   * an allow closes the owner's open asks (`agentFinished`) when the stop ends its work, and none
   * when `end` is `idle`, the end of a turn only (G1).
   */
  stop(
    ownerKey: string,
    stopHookActive: boolean,
    fit?: StopFit,
    end: StopEnd = "finished",
  ): StopOutcome {
    const outcome = this.#push.stop(ownerKey, stopHookActive, fit);
    if (outcome.decision === "allow" && end === "finished") this.agentFinished(ownerKey);
    return outcome;
  }

  /**
   * The agent behind `ownerKey` is now known by `label`, display text such as "Teammate
   * researcher" (design decision 4, Origin, plan B): each ask it owns, and each it creates later,
   * shows that label with no ordinal, and the subscribers hear an `origin` event for each ask whose
   * origin changed.
   */
  relabel(ownerKey: string, label: string): void {
    for (const askId of this.#push.relabel(ownerKey, label))
      this.#publish({ type: "origin", askId });
  }

  /**
   * The subagent behind `ownerKey` finished (AD-10, FR-25): each open ask it owns gets its final
   * `closed` event and closes with reason `agent-finished`; the subscribers hear the event, then
   * the close, which wakes the ask's waiters.
   */
  agentFinished(ownerKey: string): void {
    for (const askId of this.#push.asksOf(ownerKey)) {
      const event = this.#asks.get(askId)?.finish();
      if (event === undefined) continue;
      this.#appended(askId, [event]);
      this.#publish({ type: "closed", askId, reason: "agent-finished" });
    }
  }

  /**
   * Who asked and for whom, for the context header's first row (design decision 12): the owner's
   * origin, the agent's name and the expected answerer when the header shows it.
   */
  whoAsked(askId: string): WhoAsked | undefined {
    return this.#push.whoAsked(askId);
  }

  /** The ask's agent status (AD-4), or undefined for an ask this epoch does not hold. */
  agentStatus(askId: string): AgentStatus | undefined {
    return this.#statuses.statusOf(askId);
  }

  /**
   * `mcp-tools`' report that a waiting `collect` on the ask started, and whether its owner is the
   * main conversation, whose wait counts only until the background threshold; the returned
   * function ends it (design decision 12).
   */
  waitStarted(askId: string, mainConversation: boolean): () => void {
    return this.#statuses.waitStarted(askId, mainConversation);
  }

  /** The mod's report, through `board-host`, that the owner's turn started or completed (AD-4). */
  turnReported(ownerKey: string, running: boolean): void {
    this.#statuses.turnReported(ownerKey, running);
  }

  /** `board-host`'s report of an ask's board working signal (AD-2), false when it closes. */
  setWorking(askId: string, working: boolean): void {
    this.#push.setWorking(askId, working);
  }

  /**
   * The Claude Code version: from `mcp-tools` when the client information names `claude-code`,
   * from `board-host` when the mod reports it; the first wins over the second (AD-18).
   */
  setClientVersion(source: ClientVersionSource, version: string): void {
    this.#push.setClientVersion(source, version);
  }

  // Context, E5 (excerpts, design decision 4, For `board-host`).

  /**
   * The source of a pointer excerpt or pointer reference of the ask's current board document, for
   * the reading panel and the source view; undefined for any other item and for a discarded ask.
   * Each call resolves and confines the pointer again against the ask's root (AD-8, AD-12); without
   * a root, or when the read fails (reported), the source is missing.
   */
  sourceOf(askId: string, itemId: string): Source | undefined {
    const found = this.#asks.get(askId)?.pointerSource(itemId);
    if (found === undefined) return undefined;
    const { pointer, sentText } = found;
    const { sources, report } = this.#ports;
    const root = rootOf(this.#ports.projectRoot, this.ownerOf(askId));
    const path = sourcePathOf(pointer);
    const missing = (error: unknown) => {
      report(error);
      return MISSING;
    };
    if (sources === undefined || root === undefined) {
      return { path, state: async () => MISSING, text: async () => MISSING };
    }
    return {
      path,
      state: () => sources.sourceState(root, pointer, sentText).catch(missing),
      text: () => sources.readSource(root, pointer).catch(missing),
    };
  }

  /**
   * "Open in editor" (proposal B17): the item's confined real path, resolved again now, and the
   * anchor's current line, else the board document's first line, else 1; undefined when the item
   * has no source or its pointer no longer reaches a regular file inside the root (AD-8).
   */
  async editorTarget(askId: string, itemId: string): Promise<EditorLaunchTarget | undefined> {
    const found = this.#asks.get(askId)?.pointerSource(itemId);
    const { sources, report } = this.#ports;
    const root = rootOf(this.#ports.projectRoot, this.ownerOf(askId));
    if (found === undefined || sources === undefined || root === undefined) return undefined;
    try {
      const target = await sources.editorTarget(root, found.pointer);
      return target === undefined
        ? undefined
        : { file: target.file, line: target.line ?? found.line ?? 1 };
    } catch (error) {
      report(error);
      return undefined;
    }
  }

  // An identical request under an open ask's ID returns its board and opens nothing; any other
  // request under the ID of an ask of this epoch is refused (AD-6, FR-5), and so is the identical
  // one from a call that is not its owner's (AD-5): from another agent, whose ID is in use by this
  // ask, or from a call with no record, which may be retried.
  #resend(ask: Ask, request: string, caller: Binding | undefined): AskOutcome {
    if (ask.state === "discarded" || ask.request !== request) {
      return { kind: "in-use", askId: ask.askId };
    }
    const refusal = this.#push.refusal(ask.askId, caller);
    if (refusal !== undefined) return { kind: refusal, askId: ask.askId };
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

  async #create(
    input: LifecycleAskInput,
    request: string,
    caller: Binding | undefined,
  ): Promise<AskOutcome> {
    const { askId } = input;
    const showing = await this.#ports.showing.check();
    if (!showing.showable) {
      return { kind: "unavailable", askId, reason: showing.reason, detail: showing.detail };
    }
    const unsupported = this.#push.versionRefusal(askId);
    if (unsupported !== undefined) return unsupported;
    const language = askLanguage(input, (await this.settings()).values.defaultLanguage);
    const who = await this.#who(input);
    const forUser = await this.#forUser(input);
    // Context, E5: the pointers are read against the root of the ask's owner-to-be (design
    // decision 4), before the rev-1 board document is stored.
    const root = rootOf(this.#ports.projectRoot, caller);
    const context = await this.#resolve(contextRequestsOf(input.items), root, ASK_IMAGES_MAX_BYTES);
    const link = await this.#ports.address.link(askId);
    if (this.#ending) return { kind: "ending" };
    const [first] = input.items;
    const question = first.type === "area" ? first.props.items[0] : first;
    const title = input.title ?? deriveTitle(question.props.text);
    const ask = new Ask({ epoch: this.epoch, askId, request, title, input, link, who, context });
    const ask = new Ask({
      epoch: this.epoch,
      askId,
      request,
      title,
      input,
      link,
      who,
      ...language,
    });
    this.#asks.set(askId, ask);
    this.#push.created(ask, input, caller, forUser);
    this.#statuses.created(askId, this.#push.ownerOf(askId)?.ownerKey);
    const warnings = ask.contextWarnings;
    return { kind: "created", ask: ask.summary, ...(warnings.length === 0 ? {} : { warnings }) };
  }

  // An update's actions applied to the ask as it is now, with what its new revisions resolved.
  #applyUpdate(
    askId: string,
    actions: Parameters<Ask["update"]>[0],
    context: ReadonlyMap<string, QuestionContext>,
  ): UpdateOutcome {
    const ask = this.#asks.get(askId);
    if (ask === undefined || ask.state === "discarded") return { kind: "discarded", askId };
    if (ask.state === "closed") return { kind: "closed", askId };
    const { outcome, effects } = ask.update(actions, timeOf(this.#ports.clock.now()), context);
    if (effects?.document) this.#publish({ type: "document", askId });
    if (effects?.state) this.#publish({ type: "state", askId });
    if (effects?.closed) this.#publish({ type: "closed", askId, reason: "agent" });
    return outcome;
  }

  // Context, E5 (excerpts, design decision 4): the send's pointers read through the port, within
  // the reads bound and the budget on the core's clock.
  #resolve(
    requests: readonly ContextRequest[],
    root: string | undefined,
    imageBytes: number,
  ): Promise<Map<string, QuestionContext>> {
    const { sources, clock, report } = this.#ports;
    return resolveContext(requests, { sources, root, clock, report, imageBytes });
  }

  // The ask's expected user, else the git user name, else the login name (FR-19). A lookup that
  // fails is reported and counts as no name.
  async #who(input: LifecycleAskInput): Promise<string> {
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

  // The expected answerer the context header shows (design decision 12): only with the header's
  // ports, and asking the machine only when the ask names an expected user. A git user name that
  // cannot be read is reported and counts as none.
  async #forUser(input: LifecycleAskInput): Promise<string | undefined> {
    const { header, identity, report } = this.#ports;
    if (header === undefined || nameOf(input.expectedUser) === undefined) return undefined;
    let gitUser: string | undefined;
    try {
      gitUser = nameOf(await identity.gitUserName());
    } catch (error) {
      report(error);
    }
    return expectedAnswerer(input.expectedUser, gitUser);
  }

  // Settings and languages (E8, settings-languages design decisions 3 to 7).

  /**
   * The settings in effect: both configuration files are read on the first call and kept for the
   * session, so a change to a behaviour key applies from the next session (AD-14, FR-35).
   */
  settings(): Promise<SettingsInEffect> {
    return this.#configuration.inEffect();
  }

  /**
   * The settings a board opens with: the user file's presentation keys are read again, so a change
   * another session wrote reaches a later board; everything else is the first read's.
   */
  settingsForBoard(): Promise<SettingsInEffect> {
    return this.#configuration.forBoard();
  }

  /**
   * A board's write of one presentation key into the user file: refused for any other key, a value
   * outside the schema, a key the project file sets, or a user file that fails its check.
   */
  writeSetting(setting: PresentationSetting): Promise<WriteOutcome> {
    return this.#configuration.write(setting);
  }
}
