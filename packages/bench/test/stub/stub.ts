// The stub session process (early-benchmark design decision 13): a stand-in for E1's session
// process that speaks only the contract, so that bench's harness can be tested before E1's
// board-host and entry point exist. Test code: it uses Bun.serve. It is not a second core: no
// revisions, no resend rule, no takeover, one board socket per connection.

import { randomBytes } from "node:crypto";
import {
  type AnswerCommand,
  BOARD_CLOSE_CODES,
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  type BoardDocument,
  boardLink,
  type HostMessage,
  type OutputEvent,
  parseBoardRoute,
  RESULT_VERSIONS,
  SERVER_INSTRUCTIONS,
  TITLE_MAX_CHARS,
  TOOL_DEFINITIONS,
} from "@askboard/contract";
import {
  validateAskRequest,
  validateBoardMessage,
  validateCollectRequest,
} from "@askboard/contract/validate";
import type { ServerWebSocket } from "bun";
import type { CallResult, McpServer } from "../../src/mcp/jsonrpc.ts";

export type StubOptions = {
  /** Opens a board link; without it, every ask is `unavailable` (`no-browser`). */
  readonly open?: (link: string) => void;
  /** The longest a waiting `collect` waits. */
  readonly waitMs: number;
};

export type Stub = {
  readonly server: McpServer;
  readonly epoch: string;
  /** Discards every ask, tells its boards, and stops the board listener. */
  readonly shutdown: () => Promise<void>;
};

type SocketData = { askId: string; connected: boolean };

type StubAsk = {
  readonly askId: string;
  readonly token: string;
  readonly document: BoardDocument;
  readonly events: (OutputEvent & { readonly cursor: string })[];
  state: "waiting" | "answered" | "discarded";
  answer?: { choice: readonly string[]; when: string; receipt: "sent" | "delivered" };
  readonly sockets: Set<ServerWebSocket<SocketData>>;
  readonly waiters: Set<() => void>;
};

const NO_HOOKS = {
  code: "no-hooks",
  message:
    "This session runs without hooks: push, ownership checks and the stop guard are unavailable. Collect your answers with collect before you finish.",
} as const;

const text = (value: unknown, isError = false): CallResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

const epochOf = (): string => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...randomBytes(8)].map((byte) => alphabet[byte % alphabet.length]).join("");
};

const deriveTitle = (question: string): string =>
  question.length <= TITLE_MAX_CHARS ? question : `${question.slice(0, TITLE_MAX_CHARS)}…`;

export const createStub = (options: StubOptions): Stub => {
  const epoch = epochOf();
  const asks = new Map<string, StubAsk>();
  let listener: ReturnType<typeof Bun.serve<SocketData>> | undefined;

  const send = (socket: ServerWebSocket<SocketData>, message: HostMessage) =>
    socket.send(JSON.stringify(message));

  const stateOf = (ask: StubAsk): HostMessage => {
    const item = ask.document.items[0];
    const question =
      ask.answer === undefined
        ? { itemId: item.id, rev: item.rev, state: "open" as const }
        : { itemId: item.id, rev: item.rev, state: "answered" as const, answer: ask.answer };
    const state = ask.state === "answered" ? "answered" : "waiting";
    return {
      version: BOARD_PROTOCOL_VERSION,
      type: "state",
      state: { ask: state, questions: [question] },
    };
  };

  const broadcast = (ask: StubAsk, message: HostMessage) => {
    for (const socket of ask.sockets) send(socket, message);
  };

  const wake = (ask: StubAsk) => {
    for (const waiter of ask.waiters) waiter();
    ask.waiters.clear();
  };

  const refuse = (
    socket: ServerWebSocket<SocketData>,
    reason: "token" | "message" | "answer",
    detail: string,
    itemId?: string,
  ) =>
    send(socket, {
      version: BOARD_PROTOCOL_VERSION,
      type: "refused",
      reason,
      detail,
      ...(itemId === undefined ? {} : { itemId }),
    });

  const answer = (ask: StubAsk, socket: ServerWebSocket<SocketData>, command: AnswerCommand) => {
    const item = ask.document.items[0];
    const labels = item.props.options.map((option) => option.label);
    const fits =
      ask.state === "waiting" &&
      command.itemId === item.id &&
      command.rev === item.rev &&
      command.choice.length === 1 &&
      command.choice.every((label) => labels.includes(label));
    if (!fits) {
      refuse(socket, "answer", "the answer does not fit the open question", command.itemId);
      send(socket, stateOf(ask));
      return;
    }
    const cursor = `${epoch}.${ask.events.length + 1}`;
    const { itemId, rev, choice, when } = command;
    ask.events.push({ cursor, type: "answer", itemId, rev, who: "Stub User", when, choice });
    ask.state = "answered";
    ask.answer = { choice, when, receipt: "sent" };
    broadcast(ask, stateOf(ask));
    wake(ask);
  };

  const onMessage = (socket: ServerWebSocket<SocketData>, raw: string | Buffer) => {
    const ask = asks.get(socket.data.askId);
    let value: unknown;
    try {
      value = JSON.parse(String(raw));
    } catch {
      value = undefined;
    }
    const checked = validateBoardMessage("toHost", value);
    if (!socket.data.connected) {
      if (!checked.ok || checked.value.type !== "connect" || checked.value.token !== ask?.token) {
        refuse(socket, "token", "the first message must be connect with the board's token");
        socket.close(BOARD_CLOSE_CODES.refused);
        return;
      }
      socket.data.connected = true;
      ask.sockets.add(socket);
      send(socket, { version: BOARD_PROTOCOL_VERSION, type: "board", document: ask.document });
      send(socket, stateOf(ask));
      return;
    }
    if (ask === undefined || !checked.ok || checked.value.type !== "answer") {
      refuse(socket, "message", "not a message the board protocol accepts here");
      return;
    }
    answer(ask, socket, checked.value);
  };

  const fetchBoard = (request: Request, server: Bun.Server<SocketData>): Response | undefined => {
    const url = new URL(request.url);
    const host = request.headers.get("host") ?? "";
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return new Response("", { status: 403 });
    const route = parseBoardRoute(url.pathname);
    if (route?.kind === "board") {
      const ask = asks.get(route.askId);
      const valid = ask !== undefined && url.searchParams.get("t") === ask.token;
      return valid
        ? new Response("<!doctype html><title>stub board</title>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
        : new Response("invalid link", { status: 403 });
    }
    if (route?.kind === "socket" && request.headers.get("origin") === `http://${host}`) {
      if (server.upgrade(request, { data: { askId: route.askId, connected: false } })) return;
    }
    return new Response("", { status: route?.kind === "socket" ? 403 : 404 });
  };

  const listen = () => {
    listener ??= Bun.serve<SocketData>({
      hostname: "127.0.0.1",
      port: 0,
      fetch: fetchBoard,
      websocket: {
        message: onMessage,
        close: (socket) => {
          asks.get(socket.data.askId)?.sockets.delete(socket);
        },
      },
    });
    return listener;
  };

  const ask = async (args: unknown): Promise<CallResult> => {
    const checked = validateAskRequest(args ?? {});
    if (!checked.ok) {
      return text(checked.problems.map((problem) => problem.message).join("\n"), true);
    }
    const request = checked.value;
    if (asks.has(request.askId)) return text(`the ask ID ${request.askId} is in use`, true);
    if (options.open === undefined) {
      const message = "No browser can show a board here: BROWSER is not set. Use AskUserQuestion.";
      return text({
        versions: RESULT_VERSIONS,
        epoch,
        askId: request.askId,
        outcome: "unavailable",
        reason: "no-browser",
        message,
      });
    }
    const [item] = request.items;
    // The stub serves E1's board of one plain question; an ask of areas is not one.
    if (item.type !== "question") throw new Error("the stub serves one plain question, not areas");
    const token = randomBytes(16).toString("base64url");
    const port = listen().port ?? 0;
    const document: BoardDocument = {
      version: BOARD_DOCUMENT_VERSION,
      askId: request.askId,
      title: request.title ?? deriveTitle(item.props.text),
      // A question's context items (excerpts) are ask-core's to resolve: the stub shows none.
      items: [{ ...item, rev: 1, props: { ...item.props, items: undefined } }],
    };
    const created: StubAsk = {
      askId: request.askId,
      token,
      document,
      events: [],
      state: "waiting",
      sockets: new Set(),
      waiters: new Set(),
    };
    asks.set(request.askId, created);
    const board = boardLink({ port, askId: request.askId, token });
    options.open(board);
    return text({
      versions: RESULT_VERSIONS,
      epoch,
      askId: request.askId,
      state: "waiting",
      cursor: `${epoch}.0`,
      board,
      warnings: [NO_HOOKS],
    });
  };

  const seqOf = (cursor: string) => Number(cursor.split(".")[1]);

  const entryOf = (askId: string, after: string) => {
    if (!after.startsWith(`${epoch}.`)) {
      return {
        askId,
        state: "discarded" as const,
        cursor: after,
        events: [],
        unchecked: true as const,
      };
    }
    const found = asks.get(askId);
    if (found === undefined) return undefined;
    const events = found.events.slice(seqOf(after));
    const cursor = events.at(-1)?.cursor ?? after;
    return { askId, state: found.state, cursor, events, unchecked: true as const };
  };

  const delivered = (askId: string) => {
    const found = asks.get(askId);
    if (found?.answer === undefined || found.answer.receipt === "delivered") return;
    found.answer = { ...found.answer, receipt: "delivered" };
    const itemId = found.document.items[0].id;
    broadcast(found, {
      version: BOARD_PROTOCOL_VERSION,
      type: "receipt",
      itemId,
      receipt: "delivered",
    });
  };

  const collect = async (args: unknown): Promise<CallResult> => {
    const checked = validateCollectRequest(args ?? {});
    if (!checked.ok) {
      return text(checked.problems.map((problem) => problem.message).join("\n"), true);
    }
    const { asks: wanted, wait } = checked.value;
    const read = () => wanted.map(({ askId, after }) => ({ askId, entry: entryOf(askId, after) }));
    const missing = read().find(({ entry }) => entry === undefined);
    if (missing !== undefined) return text(`no ask ${missing.askId} in this session`, true);
    let entries = read();
    let outcome: "open" | undefined;
    const waited = wait === undefined ? undefined : asks.get(wait.askId);
    if (waited !== undefined && entries.every(({ entry }) => entry?.events.length === 0)) {
      const arrived = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          waited.waiters.delete(done);
          resolve(false);
        }, options.waitMs);
        const done = () => {
          clearTimeout(timer);
          resolve(true);
        };
        waited.waiters.add(done);
      });
      entries = read();
      if (!arrived) outcome = "open";
    }
    for (const { askId, entry } of entries) {
      if (entry?.events.some((event) => event.type === "answer")) delivered(askId);
    }
    const result = { versions: RESULT_VERSIONS, epoch, asks: entries.map(({ entry }) => entry) };
    return text(outcome === undefined ? result : { ...result, outcome });
  };

  const shutdown = async () => {
    for (const found of asks.values()) {
      if (found.state === "discarded") continue;
      found.events.push({
        cursor: `${epoch}.${found.events.length + 1}`,
        type: "discarded",
        reason: "session-exit",
      });
      found.state = "discarded";
      for (const socket of found.sockets) {
        send(socket, {
          version: BOARD_PROTOCOL_VERSION,
          type: "discarded",
          reason: "session-exit",
        });
        socket.close(BOARD_CLOSE_CODES.discarded);
      }
      wake(found);
    }
    await listener?.stop();
    listener = undefined;
  };

  const server: McpServer = {
    name: "askboard",
    version: "0.0.0-stub",
    instructions: SERVER_INSTRUCTIONS,
    tools: TOOL_DEFINITIONS,
    call: (name, args) => (name === "ask" ? ask(args) : collect(args)),
  };

  return { server, epoch, shutdown };
};
