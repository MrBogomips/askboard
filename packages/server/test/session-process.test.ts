import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BOARD_CLOSE_CODES,
  BOARD_PORT_RANGE,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { ExitSignal, SessionProcess } from "../src/mcp-tools/index.ts";
import { startSessionProcess } from "../src/session-process.ts";
import {
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

const start = async (env: Readonly<Record<string, string>>) => {
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
    view: writeView(),
    version: "0.0.0-test",
    process,
    stderr: (line) => stderr.push(line),
    transport: serverEnd,
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
    expect(tools.map((tool) => tool.name)).toEqual(["ask", "collect"]);

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
