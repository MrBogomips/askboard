// The scripted board answerer (early-benchmark design decision 5): it loads a board the way the
// board page does, through the board protocol, and answers the plan's option. E1 has no benchmark
// mode, so this is the scripted user of the AskBoard arm until `ask-core` appends scripted answers
// itself (AD-17; proposal, open question 4). Its record holds times and labels, never the token.

import {
  BOARD_PROTOCOL_VERSION,
  type BoardMessage,
  type HostMessage,
  parseBoardRoute,
  type StateMessage,
} from "@askboard/contract";
import { chooseFor, type PlanEntry } from "../scenarios.ts";

export type BoardOutcome =
  | "answered"
  | "invalid-message"
  | "refused"
  | "discarded"
  | "not-open"
  | "timeout"
  | "error";

/** One board, as the answerer saw it. Times are epoch milliseconds. */
export type BoardRecord = {
  readonly kind: "board";
  readonly askId?: string;
  /** t2′: the answerer's process started, the opener having run. */
  readonly started: number;
  readonly pageLoaded?: number;
  /** t3′: the board document and the open question state have both arrived. */
  readonly shown?: number;
  /** Stamped before the answer command is sent. */
  readonly answered?: number;
  /** The state showing the logged answer arrived. */
  readonly acknowledged?: number;
  readonly itemId?: string;
  readonly rev?: number;
  readonly choice?: readonly string[];
  readonly matched?: boolean;
  readonly outcome: BoardOutcome;
  readonly problem?: string;
};

export type AnswerBoardOptions = {
  readonly link: string;
  readonly plan: readonly PlanEntry[];
  readonly started: number;
  /** The answerer gives up after this long; it never outlives its run. */
  readonly deadlineMs?: number;
  readonly now?: () => number;
};

const DEADLINE_MS = 60_000;
const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

// board-host refuses an upgrade without a matching Origin (E1 board-host spec). Bun and Node 24
// take headers in the options; the DOM type of the test programs knows only protocols.
const openSocket = (url: string, origin: string): WebSocket =>
  new WebSocket(url, { headers: { origin } } as unknown as string[]);

export const answerBoard = async (options: AnswerBoardOptions): Promise<BoardRecord> => {
  const { link, plan, started, deadlineMs = DEADLINE_MS, now = Date.now } = options;
  // The contract's validators compile at first use: load them while the board connects, and
  // validate after stamping, so that loading them does not delay t3′.
  const validating = import("@askboard/contract/validate");
  const url = URL.canParse(link) ? new URL(link) : undefined;
  const route = url === undefined ? undefined : parseBoardRoute(url.pathname);
  const token = url?.searchParams.get("t");
  if (url === undefined || route?.kind !== "board" || !token) {
    return { kind: "board", started, outcome: "error", problem: "not a board link" };
  }
  // Boards listen on loopback only (AD-11); the answerer connects nowhere else (NFR-9).
  if (!LOOPBACK.has(url.hostname)) {
    return { kind: "board", started, outcome: "error", problem: "not a loopback board link" };
  }
  const base: BoardRecord = { kind: "board", askId: route.askId, started, outcome: "timeout" };
  const page = await fetch(link, { signal: AbortSignal.timeout(deadlineMs) }).catch(
    () => undefined,
  );
  if (page === undefined)
    return { ...base, outcome: "error", problem: "the board page did not answer" };
  await page.arrayBuffer();
  if (page.status !== 200) {
    return { ...base, outcome: "error", problem: `the board page answered ${page.status}` };
  }
  const loaded: BoardRecord = { ...base, pageLoaded: now() };

  return new Promise<BoardRecord>((resolve) => {
    let record = loaded;
    let isDone = false;
    let board: BoardMessage | undefined;
    let state: StateMessage | undefined;
    let chain = Promise.resolve();
    const socket = openSocket(`ws://${url.host}/ws/${route.askId}`, `http://${url.host}`);
    const finish = (patch: Partial<BoardRecord>) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      record = { ...record, ...patch };
      socket.close(1000);
      resolve(record);
    };
    const timer = setTimeout(() => finish({ outcome: "timeout" }), deadlineMs);

    const answer = () => {
      if (board === undefined || state === undefined || record.answered !== undefined) return;
      const [item] = board.document.items;
      const [status] = state.state.questions;
      if (status.state !== "open") return finish({ outcome: "not-open" });
      const { choice, matched } = chooseFor(
        plan,
        (item.props.options ?? []).map((option) => option.label),
      );
      const answered = now();
      record = { ...record, itemId: item.id, rev: item.rev, choice, matched, answered };
      const when = new Date(answered).toISOString();
      const command = {
        version: BOARD_PROTOCOL_VERSION,
        type: "answer",
        itemId: item.id,
        rev: item.rev,
        choice,
        when,
      };
      socket.send(JSON.stringify(command));
    };

    const handle = async (raw: string, at: number) => {
      if (isDone) return;
      const { validateBoardMessage } = await validating;
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        return finish({ outcome: "invalid-message", problem: "a message that is not JSON" });
      }
      const checked = validateBoardMessage("toPage", value);
      if (!checked.ok) {
        const [problem] = checked.problems;
        return finish({
          outcome: "invalid-message",
          problem: `${problem?.path} ${problem?.message}`,
        });
      }
      const message: HostMessage = checked.value;
      if (message.type === "refused")
        return finish({ outcome: "refused", problem: message.reason });
      if (message.type === "discarded") return finish({ outcome: "discarded" });
      if (message.type === "moved") return finish({ outcome: "error", problem: "moved" });
      if (message.type === "board") board = message;
      if (message.type === "state") {
        const [status] = message.state.questions;
        if (record.answered !== undefined && status.state === "answered") {
          return finish({ outcome: "answered", acknowledged: at });
        }
        state = message;
      }
      if (record.shown === undefined && board !== undefined && state !== undefined) {
        record = { ...record, shown: at };
      }
      answer();
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({ version: BOARD_PROTOCOL_VERSION, type: "connect", token }));
    };
    socket.onmessage = (event) => {
      // Stamped on arrival, before anything is awaited.
      const at = now();
      chain = chain.then(() => handle(String(event.data), at));
    };
    socket.onerror = () => finish({ outcome: "error", problem: "the board socket failed" });
    socket.onclose = () => {
      chain = chain.then(() => finish({ outcome: "error", problem: "the board socket closed" }));
    };
  });
};
