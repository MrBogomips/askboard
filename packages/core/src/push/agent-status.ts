// The agent status of each ask (core spec, "Agent status of an ask"; AD-4; design decision 12):
// presence, never an ask state or an event. An ask is `working` from its creation; `waiting` while
// a waiting `collect` on it counts, or while the mod's last turn report for its owner says no turn
// is running. A main-conversation wait counts only until Claude Code's background threshold, after
// which Claude Code has moved the call to the background and the agent may be working (F18); a
// subagent's call is never moved. Each change is published once.

import { type AgentStatus, BACKGROUND_THRESHOLD_DEFAULT_MS } from "@askboard/contract";
import type { Clock } from "../ports.ts";
import type { HeaderPorts } from "./ports.ts";

const MILLISECONDS = /^[0-9]+$/;

/**
 * The background threshold `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` sets: its milliseconds, Claude
 * Code's default when it is unset or not a count of milliseconds, and never (undefined) for `0`.
 */
export const backgroundThreshold = (value: string | undefined): number | undefined => {
  const text = value?.trim() ?? "";
  if (!MILLISECONDS.test(text)) return BACKGROUND_THRESHOLD_DEFAULT_MS;
  const ms = Number(text);
  return ms === 0 ? undefined : ms;
};

type Wait = { counted: boolean; cancel: () => void };

type Tracked = {
  readonly ownerKey: string | undefined;
  readonly waits: Set<Wait>;
  status: AgentStatus;
};

export class AgentStatuses {
  readonly #header: HeaderPorts | undefined;
  // The core's clock, which runs the background threshold beside the grace timer.
  readonly #clock: Pick<Clock, "after">;
  readonly #publish: (askId: string, status: AgentStatus) => void;
  readonly #asks = new Map<string, Tracked>();
  // Each owner's last turn report: whether a turn is running.
  readonly #turns = new Map<string, boolean>();

  constructor(
    header: HeaderPorts | undefined,
    clock: Pick<Clock, "after">,
    publish: (askId: string, status: AgentStatus) => void,
  ) {
    this.#header = header;
    this.#clock = clock;
    this.#publish = publish;
  }

  /** A new ask, with its owner's key when it has one; its status follows its owner's last turn. */
  created(askId: string, ownerKey: string | undefined): void {
    const tracked: Tracked = { ownerKey, waits: new Set(), status: "working" };
    this.#asks.set(askId, tracked);
    tracked.status = this.#statusOf(tracked);
  }

  /** The ask's status, or undefined for an ask this epoch does not hold. */
  statusOf(askId: string): AgentStatus | undefined {
    return this.#asks.get(askId)?.status;
  }

  /**
   * A waiting `collect` on the ask started; the returned function ends it. A main-conversation
   * wait stops counting at the background threshold.
   */
  waitStarted(askId: string, mainConversation: boolean): () => void {
    const tracked = this.#asks.get(askId);
    if (tracked === undefined) return () => undefined;
    const wait: Wait = { counted: true, cancel: () => undefined };
    const threshold = mainConversation ? this.#header?.backgroundThresholdMs : undefined;
    if (threshold !== undefined) {
      wait.cancel = this.#clock.after(threshold, () => {
        wait.counted = false;
        this.#update(askId, tracked);
      });
    }
    tracked.waits.add(wait);
    this.#update(askId, tracked);
    return () => {
      if (!tracked.waits.delete(wait)) return;
      wait.cancel();
      this.#update(askId, tracked);
    };
  }

  /** The mod's report that the owner's turn started (`running`) or completed. */
  turnReported(ownerKey: string, running: boolean): void {
    this.#turns.set(ownerKey, running);
    for (const [askId, tracked] of this.#asks) {
      if (tracked.ownerKey === ownerKey) this.#update(askId, tracked);
    }
  }

  #statusOf({ ownerKey, waits }: Tracked): AgentStatus {
    const waited = [...waits].some((wait) => wait.counted);
    const idle = ownerKey !== undefined && this.#turns.get(ownerKey) === false;
    return waited || idle ? "waiting" : "working";
  }

  #update(askId: string, tracked: Tracked): void {
    const status = this.#statusOf(tracked);
    if (status === tracked.status) return;
    tracked.status = status;
    this.#publish(askId, status);
  }
}
