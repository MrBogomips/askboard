// The host's half of a transcript, replayed to a real board page (design decision 13). Sockets are
// numbered in the order they connect, as the transcripts number them. The replay runs each step in
// order: it sends the host's messages and closes, and waits at the rest. A page step waits for that
// socket's next message, which it compares with the transcript's; a session or network step waits
// for the test to trigger it (`collected`, `exit`, `restart`, `drop`; `drop` also passes a network
// step that closes the socket with a code). A user step is the test's own act on the page, so the
// replay passes it.

import type { PageMessage } from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import { samePageMessage, summary } from "./messages.ts";
import type { ReplayStep } from "./transcripts.ts";

/** The session-side steps a test triggers. */
export type ReplayGate = "collected" | "exit" | "restart" | "drop";

/** One board WebSocket, as the replay acts on it. */
export type ReplaySocket = {
  send(text: string): void;
  close(code: number): void;
  /** Ends the connection with no close frame, as a dropped network or a killed process does. */
  terminate(): void;
};

/** What the session side does besides the sockets when the replay passes a step. */
export type ReplayHooks = {
  readonly onExit?: () => void;
  readonly onRestart?: () => void;
  readonly onDrop?: () => void;
};

type Received = { readonly message: unknown };
type PageStep = Extract<ReplayStep, { readonly from: "page" }>;
type Waiter = { readonly gate: ReplayGate; readonly resolve: () => void };

const DEFAULT_TRIGGER_TIMEOUT_MS = 10_000;

const gateOf = (step: ReplayStep): ReplayGate | undefined => {
  if (step.from === "session") return step.event;
  return step.from === "network" ? "drop" : undefined;
};

// The message as JSON, or the text itself when it is not JSON.
const parsed = (text: string): { readonly json: boolean; readonly message: unknown } => {
  try {
    return { json: true, message: JSON.parse(text) };
  } catch {
    return { json: false, message: text };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The fields two messages differ in, for a report where both read alike.
const differing = (actual: unknown, expected: PageMessage): string[] => {
  if (!isRecord(actual)) return [];
  const fields = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  const wanted = expected as Readonly<Record<string, unknown>>;
  return [...fields].filter((field) => !Bun.deepEquals(actual[field], wanted[field], true));
};

const refusal = ({ json, message }: ReturnType<typeof parsed>): string | undefined => {
  if (!json) return "/: not JSON text";
  const checked = validateBoardMessage("toHost", message);
  if (checked.ok) return undefined;
  return checked.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; ");
};

export class Replay {
  readonly #steps: readonly ReplayStep[];
  readonly #hooks: ReplayHooks;
  readonly #sockets = new Map<number, { readonly socket: ReplaySocket; open: boolean }>();
  readonly #inbox = new Map<number, Received[]>();
  readonly #problems: string[] = [];
  readonly #latched = new Set<ReplayGate>();
  #waiters: Waiter[] = [];
  #at = 0;

  constructor(steps: readonly ReplayStep[], hooks: ReplayHooks = {}) {
    this.#steps = steps;
    this.#hooks = hooks;
  }

  /** How many sockets have connected. */
  get sockets(): number {
    return this.#sockets.size;
  }

  get finished(): boolean {
    return this.#at >= this.#steps.length;
  }

  /** What the replay waits for, in words. */
  get position(): string {
    const step = this.#steps[this.#at];
    if (step === undefined) return "nothing: the transcript is done";
    if (step.from === "session") return `the session step ${step.event}`;
    if (step.from === "network") return `the network to end socket ${step.socket}`;
    const message = "message" in step ? step.message : "invalid" in step ? step.invalid : "";
    return `socket ${step.socket} to send ${summary(message)}`;
  }

  /** Numbers a newly connected socket. */
  attach(socket: ReplaySocket): number {
    const number = this.#sockets.size + 1;
    this.#sockets.set(number, { socket, open: true });
    this.#inbox.set(number, []);
    return number;
  }

  /** The page closed the socket, or the connection ended: later host steps for it are skipped. */
  detach(number: number): void {
    const entry = this.#sockets.get(number);
    if (entry !== undefined) entry.open = false;
  }

  /** A message the page sent on a socket. */
  receive(number: number, text: string): void {
    const read = parsed(text);
    this.#inbox.get(number)?.push({ message: read.message });
    this.#advance();
    const refused = refusal(read);
    if (refused !== undefined) {
      this.#problems.push(
        `socket ${number} sent ${summary(read.message)}, which the board protocol refuses: ${refused}`,
      );
    }
  }

  /**
   * Makes a session-side step happen once the replay reaches it. Resolves when the step and the
   * host's steps right after it have run; fails when the rest of the transcript has no such step,
   * or the replay does not reach it in time.
   */
  trigger(gate: ReplayGate, timeoutMs = DEFAULT_TRIGGER_TIMEOUT_MS): Promise<void> {
    if (!this.#steps.slice(this.#at).some((step) => gateOf(step) === gate)) {
      return Promise.reject(
        new Error(`the transcript has no ${gate} step after the one it waits at`),
      );
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#latched.delete(gate);
        this.#waiters = this.#waiters.filter((waiter) => waiter.resolve !== done);
        const seconds = timeoutMs / 1000;
        reject(
          new Error(
            `the replay did not reach ${gate} within ${seconds} s: it waits for ${this.position}`,
          ),
        );
      }, timeoutMs);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.#latched.add(gate);
      this.#waiters.push({ gate, resolve: done });
      this.#advance();
    });
  }

  /** What went wrong so far: messages off the transcript, and those it never expected. */
  problems(): string[] {
    const unexpected = [...this.#inbox.entries()].flatMap(([number, queue]) =>
      queue.map(
        ({ message }) =>
          `socket ${number} sent ${summary(message)}, which the transcript does not expect`,
      ),
    );
    return [...this.#problems, ...unexpected];
  }

  #advance(): void {
    for (let step = this.#steps[this.#at]; step !== undefined; step = this.#steps[this.#at]) {
      if (!this.#run(step)) return;
      this.#at += 1;
    }
  }

  // Runs one step; false when it has to wait.
  #run(step: ReplayStep): boolean {
    if (step.from === "session") return this.#pass(step.event);
    if (step.from === "network") {
      return this.#pass("drop", step.socket, "close" in step ? step.close : undefined);
    }
    if (step.from === "user") return true;
    const entry = this.#sockets.get(step.socket);
    if (step.from === "host") {
      if (entry?.open === true) {
        if ("close" in step) {
          entry.socket.close(step.close);
          entry.open = false;
        } else entry.socket.send(JSON.stringify(step.message));
      }
      return true;
    }
    const received = this.#inbox.get(step.socket)?.shift();
    if (received === undefined) return false;
    if (!("message" in step) || !samePageMessage(received.message, step.message)) {
      this.#problems.push(this.#mismatch(step.socket, received.message, step));
    }
    return true;
  }

  #mismatch(number: number, message: unknown, step: PageStep): string {
    const expected = "message" in step ? step.message : step.invalid;
    const line = `socket ${number} sent ${summary(message)} where the transcript has ${summary(expected)}`;
    if (summary(message) !== summary(expected) || !("message" in step)) return line;
    return `${line} (they differ in ${differing(message, step.message).join(", ")})`;
  }

  #pass(gate: ReplayGate, socket?: number, code?: number): boolean {
    if (!this.#latched.has(gate)) return false;
    this.#latched.delete(gate);
    if (gate === "exit") this.#hooks.onExit?.();
    if (gate === "restart") {
      this.#hooks.onRestart?.();
      for (const number of this.#sockets.keys()) this.#end(number);
    }
    if (gate === "drop" && socket !== undefined) {
      this.#hooks.onDrop?.();
      this.#end(socket, code);
    }
    const waiting = this.#waiters.filter((waiter) => waiter.gate === gate);
    this.#waiters = this.#waiters.filter((waiter) => waiter.gate !== gate);
    for (const waiter of waiting) waiter.resolve();
    return true;
  }

  // With a code, a close frame carrying it; without, no close frame at all.
  #end(number: number, code?: number): void {
    const entry = this.#sockets.get(number);
    if (entry?.open !== true) return;
    entry.open = false;
    if (code === undefined) entry.socket.terminate();
    else entry.socket.close(code);
  }
}
