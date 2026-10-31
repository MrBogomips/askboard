import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BOARD_CLOSE_CODES,
  BOARD_PORT_RANGE,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  GRACE_PERIOD_MS,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { Clock } from "@askboard/core";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { ExitSignal, SessionProcess } from "../src/mcp-tools/index.ts";
import { startSessionProcess } from "../src/session-process.ts";
import {
  manualClock,
  openSocket,
  plainChoiceAsk,
  removeViews,
  request,
  writeView,
} from "./board-host/helpers.ts";

// The session process as the entry point composes it (design decisions 3 and 9, task 7.2): ask-core
// with board-host's address, the notifier's showing and the system identity, served by mcp-tools.
// Driven in process over an in-memory transport, with a recorder script as BROWSER.

const version = BOARD_PROTOCOL_VERSION;
const [question] = plainChoiceBoardDocument.items;
const folder = mkdtempSync(join(tmpdir(), "askboard-session-"));
afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
  removeViews();
});

const project = join(folder, "project");
Bun.spawnSync(["git", "init", "--quiet", project]);
Bun.spawnSync(["git", "-C", project, "config", "user.name", "Paola Greco"]);

const recorder = (name: string) => {
  const record = join(folder, `${name}.txt`);
  const script = join(folder, `${name}.sh`);
  writeFileSync(
    script,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${record}.part'\nmv '${record}.part' '${record}'\n`,
  );
  chmodSync(script, 0o755);
  return { script, record };
};

const start = async (
  env: Readonly<Record<string, string>>,
  view: string = writeView(),
  clock?: Clock,
) => {
  const handlers = new Map<ExitSignal, () => void>();
  const exits: number[] = [];
  const process: SessionProcess = {
    onSignal: (signal, handler) => handlers.set(signal, handler),
    exit: (code) => exits.push(code),
  };
  const stderr: string[] = [];
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const session = startSessionProcess({
    env: { PATH: globalThis.process.env.PATH ?? "", CLAUDE_PROJECT_DIR: project, ...env },
    platform: globalThis.process.platform,
    cwd: folder,
    view,
    version: "0.0.0-test",
    process,
    stderr: (line) => stderr.push(line),
    transport: serverEnd,
    ...(clock ? { clock } : {}),
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientEnd);
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const [content] = result.content as { text: string }[];
    return JSON.parse(content?.text ?? "{}");
  };
  return { client, call, session, exits, stderr, emit: (s: ExitSignal) => handlers.get(s)?.() };
};

const waitForFile = async (path: string) => {
  for (let tries = 0; tries < 200 && !existsSync(path); tries += 1) await Bun.sleep(10);
  return readFileSync(path, "utf8");
};

describe("the composed session process", () => {
  test("serves an ask from the tool call to the board and back, then ends cleanly", async () => {
    const { script, record } = recorder("browser");
    const run = await start({ BROWSER: script });
    const { tools } = await run.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["ask", "update", "collect", "fetch"]);

    const asked = await run.call("ask", plainChoiceAsk());
    const link = new URL(asked.board);
    const token = link.searchParams.get("t") ?? "";
    const port = Number(link.port);
    expect(link.hostname).toBe("127.0.0.1");
    expect(port).toBeGreaterThanOrEqual(BOARD_PORT_RANGE.first);
    expect(port).toBeLessThanOrEqual(BOARD_PORT_RANGE.last);
    expect(await waitForFile(record)).toBe(`${asked.board}\n`);

    const page = await request(port, `${link.pathname}${link.search}`);
    expect(page.status).toBe(BOARD_RESPONSES.boardPage.status);

    const board = await openSocket(port, asked.askId);
    board.send({ version, type: "connect", token });
    expect(await board.next()).toMatchObject({ type: "board" });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "waiting" } });
    board.send({
      version,
      type: "answer",
      itemId: question.id,
      rev: 1,
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27Z",
    });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "answered" } });

    const collected = await run.call("collect", {
      asks: [{ askId: asked.askId, after: asked.cursor }],
    });
    expect(collected.asks[0].events[0]).toMatchObject({
      type: "answer",
      choice: ["PostgreSQL"],
      who: "Paola Greco",
      when: "2026-10-30T09:41:27Z",
    });
    expect(await board.next()).toEqual({
      version,
      type: "receipt",
      itemId: question.id,
      receipt: "delivered",
    });

    // stdin's end: the board hears the discard, the listener closes, the process exits 0.
    await run.client.close();
    expect(await run.session.ended).toBe(0);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    expect(run.exits).toEqual([0]);
    await expect(request(port, "/m")).rejects.toThrow();
    const stderr = run.stderr.join("\n");
    expect(stderr).not.toContain(token);
    expect(stderr).not.toContain(question.props.text);
  });

  test("SIGINT with a board connected tells the board, closes the listener and exits 0", async () => {
    const { script } = recorder("sigint");
    const run = await start({ BROWSER: script });
    const asked = await run.call("ask", plainChoiceAsk("sigint-board"));
    const link = new URL(asked.board);
    const port = Number(link.port);
    const board = await openSocket(port, asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    await board.next();
    await board.next();
    run.emit("SIGINT");
    expect(await run.session.ended).toBe(0);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    expect(run.exits).toEqual([0]);
    await expect(request(port, "/m")).rejects.toThrow();
    expect(run.stderr).toEqual(["askboard: session ending (SIGINT): 1 open ask discarded"]);
  });

  test("reports a browser that cannot start on stderr, with neither the link nor its token", async () => {
    const run = await start({ BROWSER: join(folder, "no-such-browser") });
    const asked = await run.call("ask", plainChoiceAsk("browser-missing"));
    const token = new URL(asked.board).searchParams.get("t") ?? "";
    for (let tries = 0; tries < 200 && run.stderr.length === 0; tries += 1) await Bun.sleep(10);
    expect(run.stderr).toEqual(["askboard: opening the board failed: Error (ENOENT)"]);
    expect(run.stderr.join("\n")).not.toContain(token);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("a missing view build fails the ask with its own error, at the ask and not at start", async () => {
    const { script, record } = recorder("no-view");
    const run = await start({ BROWSER: script }, writeView({}));
    const result = await run.client.callTool({ name: "ask", arguments: plainChoiceAsk("no-view") });
    expect(result.isError).toBe(true);
    const [content] = result.content as { text: string }[];
    expect(content?.text).toContain("view build is missing or damaged");
    expect(existsSync(record)).toBe(false);
    expect(run.stderr).toEqual(["askboard: ask failed: ViewBuildError (VIEW_MANIFEST_UNREADABLE)"]);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("answers unavailable inside a container, opening no port", async () => {
    const run = await start({ DEVCONTAINER: "true" });
    const asked = await run.call("ask", plainChoiceAsk("in-a-container"));
    expect(asked).toMatchObject({ outcome: "unavailable", reason: "container" });
    expect(asked.message).toContain("DEVCONTAINER");
    run.emit("SIGINT");
    expect(await run.session.ended).toBe(0);
    expect(run.stderr.filter((line) => !line.startsWith("askboard: session ending"))).toEqual([]);
  });
});

// ask-lifecycle, task 5.3: the entry point's wiring of the Clock and the new subscriptions, with
// the real units and a clock the test moves, so the grace period passes without a real wait.

const threeQuestions = (askId: string) => ({
  askId,
  items: [
    { type: "question", id: "database", props: question.props },
    {
      type: "question",
      id: "cache",
      props: { text: "Which cache?", options: [{ label: "Redis" }, { label: "None" }] },
    },
    {
      type: "question",
      id: "queue",
      props: { text: "Which queue?", options: [{ label: "SQS" }, { label: "None" }] },
    },
  ],
});

const answerAct = (actionId: string, itemId: string, choice: string) => ({
  version,
  type: "act",
  actionId,
  acts: [{ type: "answer", itemId, rev: 1, choice: [choice], when: "2026-10-31T09:41:27Z" }],
});

const until = async (done: () => boolean) => {
  for (let tries = 0; tries < 200 && !done(); tries += 1) await Bun.sleep(10);
  expect(done()).toBe(true);
};

describe("the ask lifecycle in the composed session process", () => {
  test("a board closed past the grace period ends a waiting collect with the answer, then the discard", async () => {
    const { script } = recorder("grace");
    const time = manualClock();
    const run = await start({ BROWSER: script }, writeView(), time.clock);
    const asked = await run.call("ask", threeQuestions("grace-board-k4p2"));
    const link = new URL(asked.board);
    const board = await openSocket(Number(link.port), asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    expect(await board.next()).toMatchObject({ type: "board" });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "waiting" } });

    // A first answer makes the ask partly answered, and the agent collects it.
    const first = "gR4c3PeriodAct10nId001";
    board.send(answerAct(first, "database", "PostgreSQL"));
    expect(await board.next()).toEqual({ version, type: "done", actionId: first });
    expect(await board.next()).toMatchObject({ state: { ask: "partly-answered" } });
    const before = await run.call("collect", {
      asks: [{ askId: asked.askId, after: asked.cursor }],
    });
    const cursor = before.asks[0].cursor;
    expect(cursor).toBe(`${asked.epoch}.1`);
    expect(await board.next()).toMatchObject({ type: "receipt", itemId: "database" });

    // The agent waits on queue; an answer to cache leaves the ask partly answered, so the wait goes
    // on (AD-4).
    let returned = false;
    const waiting = run
      .call("collect", {
        asks: [{ askId: asked.askId, after: cursor }],
        wait: { askId: asked.askId, itemId: "queue" },
      })
      .finally(() => {
        returned = true;
      });
    const second = "gR4c3PeriodAct10nId002";
    board.send(answerAct(second, "cache", "Redis"));
    expect(await board.next()).toEqual({ version, type: "done", actionId: second });
    expect(await board.next()).toMatchObject({ state: { ask: "partly-answered" } });
    await Bun.sleep(30);
    expect(returned).toBe(false);

    board.socket.close();
    await board.closed();
    await until(() => time.delays.includes(GRACE_PERIOD_MS));
    time.advance(GRACE_PERIOD_MS - 1);
    await Bun.sleep(30);
    expect(returned).toBe(false);
    time.advance(1);
    const collected = await waiting;
    expect(collected.asks).toEqual([
      {
        askId: asked.askId,
        state: "discarded",
        cursor: `${asked.epoch}.3`,
        events: [
          expect.objectContaining({ type: "answer", itemId: "cache", choice: ["Redis"] }),
          { cursor: `${asked.epoch}.3`, type: "discarded", reason: "board-closed" },
        ],
        unchecked: true,
      },
    ]);
    expect(collected.outcome).toBeUndefined();
    const page = await request(Number(link.port), `${link.pathname}${link.search}`);
    expect(page.status).toBe(BOARD_RESPONSES.discardedLink.status);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("no environment variable changes the grace period, and the entry point gives no clock", async () => {
    const { script } = recorder("no-override");
    const time = manualClock();
    const overrides = {
      ASKBOARD_GRACE_PERIOD_MS: "1",
      ASKBOARD_GRACE_MS: "1",
      ASKBOARD_GRACE: "1",
      GRACE_PERIOD_MS: "1",
    };
    const run = await start({ BROWSER: script, ...overrides }, writeView(), time.clock);
    const asked = await run.call("ask", plainChoiceAsk("no-override-board"));
    const link = new URL(asked.board);
    const board = await openSocket(Number(link.port), asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    await board.next();
    await board.next();
    board.socket.close();
    await board.closed();
    await until(() => time.delays.length > 0);
    expect(time.delays).toEqual([GRACE_PERIOD_MS]);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
    // The shipped bundle's entry point passes no clock: the system clock and the contract's grace
    // period run, and nothing it reads names a grace period.
    const entry = readFileSync(join(import.meta.dir, "..", "src", "main.ts"), "utf8");
    expect(entry).not.toMatch(/clock|grace/i);
    const composition = readFileSync(
      join(import.meta.dir, "..", "src", "session-process.ts"),
      "utf8",
    );
    expect(composition).not.toMatch(/GRACE|env\.[A-Z_]*GRACE/);
  });
});
