// What push delivery adds to ask-core (design decision 5), kept beside `AskCore`, which delegates to
// it: binding calls to agent records and the owners they give asks (decision 4), `received`
// raised by the mod's reports and the stop guard's blocks (AD-3, AD-10), a new ask's board opened
// only while no board is working, with a notice for each (AD-2, FR-23), the version gate (AD-18),
// and who asked and for whom, for the context header (decision 12).

import type { LifecycleAskInput } from "@askboard/contract";
import { type Ask, frozenCopy } from "../ask.ts";
import type { CorePorts } from "../ports.ts";
import { parseCursor } from "../text.ts";
import { Owners } from "./owners.ts";
import type {
  AskOverview,
  Binding,
  CallIdentity,
  ClientVersionSource,
  DeliveredOutcome,
  Notice,
  OwnerRefusal,
  PushAskOutcome,
  StopAsk,
  StopFit,
  StopOutcome,
  WhoAsked,
} from "./ports.ts";
import { VersionGate } from "./version.ts";

// The states in which an ask is no longer open: E3's `closed` joins E1's `discarded`.
const ENDED: ReadonlySet<string> = new Set(["closed", "discarded"]);

// Whether `seq` ends a board command: no poll page or stop block stops inside one (AD-20). An entry
// the ask no longer holds, or `seq` 0, ends one.
const endsCommand = (ask: Ask, seq: number): boolean => {
  const [at, next] = ask.entriesAfter(seq - 1);
  return at?.seq !== seq || next === undefined || next.group !== at.group;
};

// The stop fit that keeps every candidate event.
const keepAll: StopFit = ({ asks, openAsks }) => ({
  asks: asks.map(({ entry }) => entry),
  openAsks,
});

/** What push delivery needs of the core that holds it. */
export type DeliveryHost = {
  readonly epoch: string;
  ask(askId: string): Ask | undefined;
  /** The core's `markRead`, which raises `received` and tells the subscribers. */
  markRead(askId: string, cursor: string): boolean;
};

export class PushDelivery {
  readonly #ports: CorePorts;
  readonly #host: DeliveryHost;
  readonly #owners = new Owners();
  // Each ask's `agentName`, which the board document does not hold, for the pending-asks list.
  readonly #agentNames = new Map<string, string>();
  // Each ask's expected answerer, when the context header shows it (design decision 12).
  readonly #forUsers = new Map<string, string>();
  // The asks whose board reports the working signal (AD-2).
  readonly #working = new Set<string>();
  readonly #gate: VersionGate;

  constructor(ports: CorePorts, host: DeliveryHost) {
    this.#ports = ports;
    this.#host = host;
    this.#gate = new VersionGate(ports.diagnose);
  }

  /** The Claude Code version a source names (AD-18). */
  setClientVersion(source: ClientVersionSource, version: string): void {
    this.#gate.set(source, version);
  }

  /** The version gate's refusal of a new ask, or undefined when it may be created. */
  versionRefusal(askId: string): PushAskOutcome | undefined {
    return this.#gate.refusal(askId);
  }

  /**
   * Binds a call to its agent record through the record table. Without the table, or when the
   * table fails (reported), the call carries no record.
   */
  async bind(call: CallIdentity): Promise<Binding | undefined> {
    const { records, report } = this.#ports;
    if (records === undefined) return undefined;
    try {
      return await records.bind(call);
    } catch (error) {
      report(error);
      return undefined;
    }
  }

  ownerOf(askId: string): Binding | undefined {
    return this.#owners.of(askId);
  }

  refusal(askId: string, caller: Binding | undefined): OwnerRefusal | undefined {
    return this.#owners.refusal(askId, caller);
  }

  /**
   * The mod's report that it pushed an owned ask's events up to `cursor` (AD-3). A report no poll
   * could have given (an unchecked or unknown ask, a cursor of another epoch, past the ask's latest
   * event or inside a board command, AD-20) is refused, and `received` does not move.
   */
  delivered(askId: string, cursor: string): DeliveredOutcome {
    const ask = this.#host.ask(askId);
    const parsed = parseCursor(cursor);
    if (ask === undefined || this.#owners.of(askId) === undefined || parsed === undefined) {
      return "refused";
    }
    if (parsed.epoch !== this.#host.epoch || parsed.seq > ask.latestSeq) return "refused";
    if (!endsCommand(ask, parsed.seq)) return "refused";
    return this.#host.markRead(askId, cursor) ? "raised" : "unchanged";
  }

  /**
   * The stop guard (AD-10): unless the stop hook is already active, a block carrying the events
   * above `received` of the owner's asks, open or discarded but never closed (AD-21; PO decision of
   * 2026-11-03), as much of them as `fit` keeps, with the open asks listed, and `received` raised
   * to the last event it carries before it returns; otherwise an allow. A fit that cuts an ask
   * inside a board command (AD-20) is a bug: the stop throws, and nothing is raised.
   */
  stop(ownerKey: string, stopHookActive: boolean, fit: StopFit = keepAll): StopOutcome {
    if (stopHookActive) return { decision: "allow" };
    const owned = this.#owners.asksOf(ownerKey).flatMap((askId) => {
      const ask = this.#host.ask(askId);
      return ask === undefined || ask.state === "closed" ? [] : [ask];
    });
    const asks: StopAsk[] = owned
      .filter((ask) => ask.latestSeq > ask.received)
      .map((ask) => {
        const entries = ask.entriesAfter(ask.received);
        return {
          entry: {
            askId: ask.askId,
            state: ask.state,
            cursor: ask.cursor,
            events: entries.map(({ event }) => event),
          },
          groups: entries.map(({ group }) => group),
        };
      });
    if (asks.length === 0) return { decision: "allow" };
    const openAsks = owned
      .filter((ask) => !ENDED.has(ask.state))
      .map(({ askId, state, cursor }) => ({ askId, state, cursor }));
    const block = fit({ asks, openAsks });
    const raised = block.asks.flatMap(({ askId, events }) => {
      const last = events.at(-1);
      return last === undefined ? [] : [[askId, last.cursor] as const];
    });
    for (const [askId, cursor] of raised) {
      const ask = this.#host.ask(askId);
      const seq = parseCursor(cursor)?.seq;
      if (ask === undefined || seq === undefined || !endsCommand(ask, seq)) {
        throw new Error(`The stop block cuts ask ${askId} inside a command at ${cursor} (AD-20)`);
      }
    }
    for (const [askId, cursor] of raised) this.#host.markRead(askId, cursor);
    return { decision: "block", ...block };
  }

  /** The IDs of the asks `ownerKey` owns, in the order they were created. */
  asksOf(ownerKey: string): readonly string[] {
    return this.#owners.asksOf(ownerKey);
  }

  /** `board-host`'s report of an ask's board working signal, false when its socket closes. */
  setWorking(askId: string, working: boolean): void {
    if (working && this.#host.ask(askId) !== undefined) this.#working.add(askId);
    else this.#working.delete(askId);
  }

  /**
   * A new ask was stored: it takes its creating call's owner; its board opens only when no board
   * of the epoch is working; and its notice goes in any case (AD-2, FR-23). The opener and the
   * notifier start and return at once; a throw is reported, never the ask's failure.
   */
  created(ask: Ask, input: LifecycleAskInput, caller: Binding | undefined, forUser?: string): void {
    this.#owners.own(ask.askId, caller);
    if (input.agentName !== undefined) this.#agentNames.set(ask.askId, input.agentName);
    if (forUser !== undefined) this.#forUsers.set(ask.askId, forUser);
    const { showing, notices } = this.#ports;
    if (this.#working.size === 0) this.#try(() => showing.open(ask.link));
    if (notices !== undefined) this.#try(() => notices.notify(this.#notice(ask, input)));
  }

  /**
   * The ask as the local API reads it (design decision 2). A question is open to the agent until
   * the agent has received its answer or its decline, an answer the agent recorded being its own
   * (EXPERIENCE, Counting); a discarded ask has none open.
   */
  overview(ask: Ask): AskOverview {
    const { askId, state, link, cursor } = ask;
    const owner = this.#owners.of(askId);
    const agentName = this.#agentNames.get(askId);
    const view = ask.lifecycleView;
    const questions = view.state === "discarded" ? [] : view.questions;
    const entries = ask.entriesAfter(ask.received);
    return frozenCopy({
      askId,
      state,
      title: ask.document.title,
      link,
      ...(agentName === undefined ? {} : { agentName }),
      ...(owner === undefined ? {} : { owner }),
      cursor,
      unreceived: entries.map(({ event }) => event),
      groups: entries.map(({ group }) => group),
      openQuestions: questions.filter((question) => !question.answer?.delivered).length,
    });
  }

  /** Who asked and for whom (design decision 12), or undefined for an ask this epoch lacks. */
  whoAsked(askId: string): WhoAsked | undefined {
    if (this.#host.ask(askId) === undefined) return undefined;
    const origin = this.#owners.of(askId)?.origin;
    const agentName = this.#agentNames.get(askId);
    const forUser = this.#forUsers.get(askId);
    return frozenCopy({
      ...(origin === undefined ? {} : { origin }),
      ...(agentName === undefined ? {} : { agentName }),
      ...(forUser === undefined ? {} : { forUser }),
    });
  }

  #notice(ask: Ask, input: LifecycleAskInput): Notice {
    const origin = this.#owners.of(ask.askId)?.origin;
    return {
      askId: ask.askId,
      title: ask.document.title,
      link: ask.link,
      questions: ask.lifecycleView.state === "discarded" ? 0 : ask.lifecycleView.questions.length,
      ...(input.agentName === undefined ? {} : { agentName: input.agentName }),
      ...(origin === undefined ? {} : { origin }),
    };
  }

  #try(run: () => void): void {
    try {
      run();
    } catch (error) {
      this.#ports.report(error);
    }
  }
}
