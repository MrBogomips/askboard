import { afterEach, describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  type HostMessage,
  parseBoardRoute,
  SCHEMA_IDS,
  SERVER_INSTRUCTIONS,
  TOOL_DEFINITIONS,
} from "@askboard/contract";
import { validateAgainst, validateBoardMessage } from "@askboard/contract/validate";
import { connectMcp, RpcPeer, serveMcp } from "../src/mcp/jsonrpc.ts";
import { QUESTIONS } from "../src/scenarios.ts";
import { createStub, type Stub } from "./stub/stub.ts";

const question = QUESTIONS[0];
if (question === undefined) throw new Error("no question");

const askRequest = (askId = "order-db-a1b2") => ({
  askId,
  items: [
    {
      type: "question",
      id: "database",
      props: { text: question.text, header: question.header, options: question.options },
    },
  ],
});

let stubs: Stub[] = [];
afterEach(async () => {
  await Promise.all(stubs.map((stub) => stub.shutdown()));
  stubs = [];
});

const started = (open?: (link: string) => void) => {
  const opened: string[] = [];
  const stub = createStub({ open: open ?? ((link) => opened.push(link)), waitMs: 2_000 });
  stubs.push(stub);
  const toServer = new PassThrough();
  const toClient = new PassThrough();
  serveMcp(new RpcPeer(toServer, toClient), stub.server);
  const client = new RpcPeer(toClient, toServer);
  const call = async (name: string, args: unknown) => {
    const result = (await client.request("tools/call", { name, arguments: args })) as {
      content: { text: string }[];
      isError?: boolean;
    };
    const text = result.content[0]?.text ?? "";
    return {
      isError: result.isError === true,
      text,
      json: result.isError ? undefined : JSON.parse(text),
    };
  };
  return { stub, client, call, opened };
};

type Socket = {
  messages: HostMessage[];
  closed: Promise<number>;
  ws: WebSocket;
  next: (n: number) => Promise<void>;
};

const connect = (link: string, origin?: string): Socket => {
  const url = new URL(link);
  const route = parseBoardRoute(url.pathname);
  if (route?.kind !== "board") throw new Error("not a board link");
  // Bun and Node take headers in the options; the DOM type knows only protocols.
  const options = { headers: { origin: origin ?? `http://${url.host}` } };
  const ws = new WebSocket(`ws://${url.host}/ws/${route.askId}`, options as unknown as string[]);
  const messages: HostMessage[] = [];
  const waiters: { n: number; resolve: () => void }[] = [];
  ws.onmessage = (event) => {
    const checked = validateBoardMessage("toPage", JSON.parse(String(event.data)));
    if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
    messages.push(checked.value);
    for (const waiter of waiters.filter((w) => messages.length >= w.n)) waiter.resolve();
  };
  const closed = new Promise<number>((resolve) => {
    ws.onclose = (event) => resolve(event.code);
  });
  const next = (n: number) =>
    new Promise<void>((resolve) => {
      if (messages.length >= n) resolve();
      else waiters.push({ n, resolve });
    });
  return { messages, closed, ws, next };
};

const tokenOf = (link: string) => new URL(link).searchParams.get("t") ?? "";
const opened = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("socket error"));
  });

describe("the stub's tools", () => {
  test("lists the contract's tools and instructions", async () => {
    const { client } = started();
    const opening = await connectMcp(client, { name: "t", version: "0" });
    expect(opening.instructions).toBe(SERVER_INSTRUCTIONS);
    expect(await client.request("tools/list")).toEqual({ tools: TOOL_DEFINITIONS });
  });

  test("ask returns the contract's result and opens the board", async () => {
    const { call, opened: links } = started();
    const result = await call("ask", askRequest());
    expect(result.isError).toBe(false);
    expect(validateAgainst(SCHEMA_IDS.askResult, result.json)).toMatchObject({ ok: true });
    expect(result.json).toMatchObject({ askId: "order-db-a1b2", state: "waiting" });
    expect(result.json.cursor).toBe(`${result.json.epoch}.0`);
    expect(links).toEqual([result.json.board]);
    expect(parseBoardRoute(new URL(result.json.board).pathname)).toEqual({
      kind: "board",
      askId: "order-db-a1b2",
    });
  });

  test("an invalid ask or a reused ID is an error", async () => {
    const { call } = started();
    const invalid = await call("ask", { askId: "x", items: [] });
    expect(invalid.isError).toBe(true);
    expect(invalid.text).toContain("items");
    await call("ask", askRequest());
    expect((await call("ask", askRequest())).text).toContain("in use");
  });

  test("without an opener the ask is unavailable and nothing is created", async () => {
    const stub = createStub({ waitMs: 10 });
    stubs.push(stub);
    const result = await stub.server.call("ask", askRequest(), undefined);
    const json = JSON.parse(result.content[0]?.text ?? "");
    expect(validateAgainst(SCHEMA_IDS.askUnavailable, json)).toMatchObject({ ok: true });
    expect(json).toMatchObject({ outcome: "unavailable", reason: "no-browser" });
  });

  test("collect checks its request and names an unknown ask", async () => {
    const { call } = started();
    expect((await call("collect", {})).isError).toBe(true);
    const unknown = await call("collect", { asks: [{ askId: "nobody", after: "zzzz.0" }] });
    expect(unknown.json.asks[0]).toMatchObject({ askId: "nobody", state: "discarded", events: [] });
    const { json: ask } = await call("ask", askRequest());
    const missing = await call("collect", {
      asks: [{ askId: "other-id", after: `${ask.epoch}.0` }],
    });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain("other-id");
  });
});

describe("the stub's board", () => {
  test("serves the board page with the token only", async () => {
    const { call } = started();
    const { json } = await call("ask", askRequest());
    expect((await fetch(json.board)).status).toBe(200);
    const wrong = json.board.replace(/t=[^&]+/, "t=wrongtokenwrongtoken00");
    expect((await fetch(wrong)).status).toBe(403);
  });

  test("refuses a WebSocket from another origin", async () => {
    const { call } = started();
    const { json } = await call("ask", askRequest());
    const socket = connect(json.board, "http://evil.example");
    expect(await socket.closed).not.toBe(1000);
    expect(socket.messages).toEqual([]);
  });

  test("refuses a first message without the board's token", async () => {
    const { call } = started();
    const { json } = await call("ask", askRequest());
    const socket = connect(json.board);
    await opened(socket.ws);
    socket.ws.send(JSON.stringify({ version: "1.0", type: "connect", token: "x".repeat(22) }));
    expect(await socket.closed).toBe(BOARD_CLOSE_CODES.refused);
    expect(socket.messages[0]).toMatchObject({ type: "refused", reason: "token" });
  });

  test("a plain-choice session: board, answer, collect with wait, receipt, discard", async () => {
    const { call, stub } = started();
    const { json } = await call("ask", askRequest());
    const socket = connect(json.board);
    await opened(socket.ws);
    socket.ws.send(JSON.stringify({ version: "1.0", type: "connect", token: tokenOf(json.board) }));
    await socket.next(2);
    expect(socket.messages[0]).toMatchObject({ type: "board", document: { askId: json.askId } });
    expect(socket.messages[1]).toMatchObject({
      type: "state",
      state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
    });
    const waiting = call("collect", {
      asks: [{ askId: json.askId, after: json.cursor }],
      wait: { askId: json.askId, itemId: "database" },
    });
    socket.ws.send(
      JSON.stringify({
        version: "1.0",
        type: "answer",
        itemId: "database",
        rev: 1,
        choice: ["PostgreSQL"],
        when: "2026-10-30T10:00:00Z",
      }),
    );
    const collected = await waiting;
    expect(validateAgainst(SCHEMA_IDS.collectResult, collected.json)).toMatchObject({ ok: true });
    expect(collected.json.asks[0]).toMatchObject({
      state: "answered",
      cursor: `${json.epoch}.1`,
      unchecked: true,
      events: [{ type: "answer", itemId: "database", rev: 1, choice: ["PostgreSQL"] }],
    });
    await socket.next(4);
    expect(socket.messages[2]).toMatchObject({
      type: "state",
      state: { ask: "answered", questions: [{ state: "answered", answer: { receipt: "sent" } }] },
    });
    expect(socket.messages[3]).toEqual({
      version: BOARD_PROTOCOL_VERSION,
      type: "receipt",
      itemId: "database",
      receipt: "delivered",
    });
    await stub.shutdown();
    expect(await socket.closed).toBe(BOARD_CLOSE_CODES.discarded);
    expect(socket.messages.at(-1)).toEqual({
      version: BOARD_PROTOCOL_VERSION,
      type: "discarded",
      reason: "session-exit",
    });
  });

  test("an answer outside the question is refused and the state resent", async () => {
    const { call } = started();
    const { json } = await call("ask", askRequest());
    const socket = connect(json.board);
    await opened(socket.ws);
    socket.ws.send(JSON.stringify({ version: "1.0", type: "connect", token: tokenOf(json.board) }));
    await socket.next(2);
    socket.ws.send(
      JSON.stringify({
        version: "1.0",
        type: "answer",
        itemId: "database",
        rev: 1,
        choice: ["Oracle"],
        when: "2026-10-30T10:00:00Z",
      }),
    );
    socket.ws.send(JSON.stringify({ version: "1.0", type: "nonsense" }));
    await socket.next(5);
    expect(socket.messages[2]).toMatchObject({
      type: "refused",
      reason: "answer",
      itemId: "database",
    });
    expect(socket.messages[3]).toMatchObject({ type: "state", state: { ask: "waiting" } });
    expect(socket.messages[4]).toMatchObject({ type: "refused", reason: "message" });
  });

  test("a waiting collect returns open when its bound passes", async () => {
    const stub = createStub({ open: () => undefined, waitMs: 20 });
    stubs.push(stub);
    const asked = JSON.parse(
      (await stub.server.call("ask", askRequest(), undefined)).content[0]?.text ?? "",
    );
    const result = await stub.server.call(
      "collect",
      {
        asks: [{ askId: asked.askId, after: asked.cursor }],
        wait: { askId: asked.askId, itemId: "database" },
      },
      undefined,
    );
    expect(JSON.parse(result.content[0]?.text ?? "")).toMatchObject({
      outcome: "open",
      asks: [{ events: [] }],
    });
  });
});
