import { afterEach, describe, expect, test } from "bun:test";
import { appendFileSync } from "node:fs";
import { exists, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BOARD_HOST, BOARD_PORT_RANGE, boardLink } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { DEFAULT_INHERITED_ENV_VARS } from "@modelcontextprotocol/client/stdio";
import { FakeChild, fakeMcpServer, fakeSpawn } from "./fake-child.ts";
import { LINK_RECORDER, LINKS_VARIABLE } from "./link-recorder.ts";
import type { BoardSession, Scenario } from "./session.ts";
import { type SessionProcessOptions, startSessionProcess } from "./session-process.ts";
import { replayTranscripts } from "./transcripts.ts";
import { fixtureViewBuild } from "./view-build.ts";

const { askId } = plainChoiceBoardDocument;
const QUESTION_TEXT = plainChoiceBoardDocument.items[0].props.text;
const TOKENS = ["pV3xK9qLmT2wR7nB4cYh8A", "Zq8wE4rT6yU2iO0pA5sD1f"];
const scenario = { transcript: replayTranscripts.opening, view: fixtureViewBuild() };
const approved = {
  askId,
  items: plainChoiceBoardDocument.items.map(({ rev: _, ...item }) => item),
};

const dirs: string[] = [];
const sessions: BoardSession[] = [];
const servers: { stop(force: boolean): unknown }[] = [];
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
  for (const server of servers.splice(0)) await server.stop(true);
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

const scratch = async () => {
  const dir = await mkdtemp(join(tmpdir(), "askboard-session-test-"));
  dirs.push(dir);
  return dir;
};

type FakeProcess = {
  /** The board link's port of the n-th process. */
  readonly port?: (n: number) => number;
  readonly token?: (n: number) => string;
  /** What the opener does with the link; by default what `BROWSER` does: one argument. */
  readonly open?: (file: string, link: string) => void;
  readonly ask?: (n: number) => { text: string; isError?: boolean } | undefined;
  /** The events each collect returns. */
  readonly events?: (call: number) => unknown[];
  readonly setUp?: (child: FakeChild, n: number) => void;
};

// The session process as the target sees it: an MCP server whose ask opens the board through
// `BROWSER` and returns its link, and whose collect returns the events given.
const fakeProcess = (fake: FakeProcess = {}) => {
  const asked: unknown[] = [];
  const collected: unknown[] = [];
  const spawning = fakeSpawn((options, n) => {
    const epoch = `ep${n}`;
    const link = boardLink({
      port: fake.port?.(n) ?? BOARD_PORT_RANGE.first + n,
      askId,
      token: fake.token?.(n) ?? TOKENS[n - 1] ?? "",
    });
    const child = new FakeChild(
      fakeMcpServer({
        ask: (args) => {
          asked.push(args);
          const file = options.env[LINKS_VARIABLE] ?? "";
          (fake.open ?? ((path, text) => appendFileSync(path, `1\t${text}\n`)))(file, link);
          const result = { epoch, askId, state: "waiting", cursor: `${epoch}.0`, board: link };
          return fake.ask?.(n) ?? { text: JSON.stringify({ versions: {}, ...result }) };
        },
        collect: (args) => {
          collected.push(args);
          const events = fake.events?.(collected.length) ?? [];
          const entry = {
            askId,
            state: "answered",
            cursor: `${epoch}.${collected.length}`,
            events,
          };
          return { text: JSON.stringify({ epoch, asks: [entry] }) };
        },
      }),
    );
    fake.setUp?.(child, n);
    return child;
  });
  return { ...spawning, asked, collected };
};

const answerEvent = { type: "answer", itemId: "database", rev: 1 };

const start = async (
  fake: ReturnType<typeof fakeProcess>,
  options: Partial<SessionProcessOptions> = {},
  given: Partial<Scenario> = {},
) => {
  const dir = await scratch();
  const bundle = join(dir, "askboard.mjs");
  await Bun.write(bundle, "// the session process\n");
  const approvedAsk = join(dir, "plain-choice.json");
  await Bun.write(approvedAsk, JSON.stringify(approved));
  const session = await startSessionProcess(
    { ...scenario, ...given },
    {
      bundle,
      approvedAsk,
      spawn: fake.spawn,
      runtime: "bun",
      exitTimeoutMs: 200,
      openTimeoutMs: 500,
      ...options,
    },
  );
  sessions.push(session);
  return session;
};

const child = (fake: ReturnType<typeof fakeProcess>, n = 1): FakeChild => {
  const spawned = fake.spawned[n - 1];
  if (spawned === undefined) throw new Error(`no process ${n}`);
  return spawned.child;
};

// A board-host stand-in on a free port of the board range, which counts what reaches it.
const boardHost = () => {
  for (let port = BOARD_PORT_RANGE.last; port >= BOARD_PORT_RANGE.first; port -= 1) {
    try {
      let hits = 0;
      const server = Bun.serve({
        hostname: BOARD_HOST,
        port,
        fetch: () => {
          hits += 1;
          return new Response("board");
        },
      });
      servers.push(server);
      return { port, hits: () => hits };
    } catch {}
  }
  throw new Error("no free port in the board range");
};

describe("startSessionProcess", () => {
  test("starts the bundle on Bun with the recorder as BROWSER and gives the ask's link through its proxy", async () => {
    const fake = fakeProcess();
    const session = await start(fake);
    const [spawned] = fake.spawned;
    expect(spawned?.command).toBe(process.execPath);
    expect(spawned?.args).toHaveLength(1);
    expect(spawned?.args[0]).toEndWith("askboard.mjs");
    const env = spawned?.options.env ?? {};
    expect(env.BROWSER).toBe(LINK_RECORDER);
    expect(env[LINKS_VARIABLE]).toBeString();
    // The SDK's default inheritance, so that the developer's SSH or CI variables do not reach the
    // detection rule (AD-18): BROWSER decides. The configuration's folders are the suite's own.
    const allowed = [
      ...DEFAULT_INHERITED_ENV_VARS,
      "BROWSER",
      LINKS_VARIABLE,
      "XDG_CONFIG_HOME",
      "CLAUDE_PROJECT_DIR",
    ];
    for (const name of Object.keys(env)) expect(allowed).toContain(name);
    expect(fake.asked).toEqual([approved]);
    const link = new URL(session.link);
    expect(link.hostname).toBe(BOARD_HOST);
    expect(Number(link.port)).not.toBe(BOARD_PORT_RANGE.first + 1);
    expect(`${link.pathname}${link.search}`).toBe(`/b/${askId}?t=${TOKENS[0]}`);
    expect(session.problems()).toEqual([]);
    expect(session.requests()).toEqual([]);
  });

  // Settings-languages, design decision 14: no developer's configuration reaches the process.
  test("its home, configuration folder and project are its own, holding the scenario's files", async () => {
    const fake = fakeProcess();
    const user = { version: "1.0", theme: "dark" };
    const project = { version: "1.0", askingRule: "always" };
    const session = await start(fake, { userConfig: user, projectConfig: project });
    const env = fake.spawned[0]?.options.env ?? {};
    const folders = [env.HOME, env.XDG_CONFIG_HOME, env.CLAUDE_PROJECT_DIR].map(String);
    for (const folder of folders) expect(folder).toStartWith(tmpdir());
    expect(new Set([...folders, process.env.HOME])).toHaveProperty("size", 4);
    const [, configHome = "", projectDir = ""] = folders;
    const read = (file: string) => Bun.file(file).json();
    expect(await read(join(configHome, "askboard", "config.json"))).toEqual(user);
    expect(await read(join(projectDir, ".askboard", "config.json"))).toEqual(project);
    // The scenarios reach the user file through the session, to read what a board wrote.
    expect(session.userConfigPath).toBe(join(configHome, "askboard", "config.json"));
  });

  test("a scenario without a project starts the process without CLAUDE_PROJECT_DIR, the rest still its own", async () => {
    const fake = fakeProcess();
    await start(fake, {}, { withoutProject: true });
    const env = fake.spawned[0]?.options.env ?? {};
    expect(env).not.toHaveProperty("CLAUDE_PROJECT_DIR");
    expect(String(env.HOME)).toStartWith(tmpdir());
    expect(String(env.XDG_CONFIG_HOME)).toStartWith(tmpdir());
  });

  test("starts the bundle on Node when asked to", async () => {
    const fake = fakeProcess();
    await start(fake, { runtime: "node" });
    expect(fake.spawned[0]?.command).toBe("node");
  });

  test("collected collects after the last cursor and expects the answer exactly once", async () => {
    const fake = fakeProcess({ events: (call) => (call === 1 ? [answerEvent] : []) });
    const session = await start(fake);
    await session.collected();
    expect(session.problems()).toEqual([]);
    await session.collected();
    expect(fake.collected).toEqual([
      { asks: [{ askId, after: "ep1.0" }] },
      { asks: [{ askId, after: "ep1.1" }] },
    ]);
    expect(session.problems()).toEqual([
      "collect after ep1.1 returned 0 answer events for the ask, not 1",
    ]);
  });

  test("exit ends the process's input and expects it to exit with code 0", async () => {
    const fake = fakeProcess();
    const session = await start(fake);
    await session.exit();
    expect(child(fake).inputEnded).toBe(true);
    expect(child(fake).signals).toEqual([]);
    expect(session.problems()).toEqual([]);
  });

  test("an exit with another code, or none in time, is a problem", async () => {
    const failing = fakeProcess({
      setUp: (process) => {
        process.onInputEnd = () => process.finish({ code: 1, signal: null });
      },
    });
    const first = await start(failing);
    await first.exit();
    expect(first.problems()).toEqual([
      "the session process ended with exit code 1 when its input ended, not exit code 0",
    ]);
    const stuck = fakeProcess();
    const second = await start(stuck);
    child(stuck).onInputEnd = () => undefined;
    await second.exit();
    expect(child(stuck).signals).toEqual(["SIGKILL"]);
    expect(second.problems()).toEqual([
      "the session process did not exit within 0.2 s of its input ending",
    ]);
  });

  test("drop and restore cut and restore the board's connection; restart points it at the new process", async () => {
    const before = boardHost();
    const after = boardHost();
    const fake = fakeProcess({ port: (n) => (n === 1 ? before.port : after.port) });
    const session = await start(fake);
    expect((await fetch(session.link)).status).toBe(200);
    await session.drop();
    await expect(fetch(session.link)).rejects.toThrow();
    await session.restore();
    expect((await fetch(session.link)).status).toBe(200);
    expect(before.hits()).toBe(2);
    await session.restart();
    expect(child(fake, 1).signals).toEqual(["SIGKILL"]);
    expect(fake.asked).toEqual([approved, approved]);
    expect((await fetch(session.link)).status).toBe(200);
    expect(after.hits()).toBe(1);
    expect(session.requests()).toEqual([`GET /b/${askId}`, `GET /b/${askId}`, `GET /b/${askId}`]);
    expect(session.problems()).toEqual([]);
  });

  test("a restart that gives the board its old token again is a problem", async () => {
    const fake = fakeProcess({ token: () => TOKENS[0] ?? "" });
    const session = await start(fake);
    await session.restart();
    expect(session.problems()).toEqual([
      "the restarted session process gave the ask the old token: it must open nothing",
    ]);
  });

  test("a process that ends on its own is a problem", async () => {
    const fake = fakeProcess();
    const session = await start(fake);
    child(fake).emitError("askboard: board host failed: Error (EADDRINUSE)\n");
    child(fake).finish({ code: 1, signal: null });
    await Bun.sleep(10);
    expect(session.problems()).toEqual([
      "the session process ended on its own with exit code 1; its stderr: askboard: board host failed: Error (EADDRINUSE)",
    ]);
  });

  test("a token or a question text on stderr is a problem (mcp-adapter spec, Exit)", async () => {
    const fake = fakeProcess();
    const session = await start(fake);
    child(fake).emitError(`askboard: opened ${TOKENS[0]} for ${QUESTION_TEXT}\n`);
    await session.exit();
    expect(session.problems()).toEqual([
      "the session process's stderr held the board's token",
      "the session process's stderr held a question's text",
    ]);
  });

  test("close ends a running process through its input and may be called twice", async () => {
    const fake = fakeProcess();
    const session = await start(fake);
    const entry = fake.spawned[0]?.args[0] ?? "";
    expect(await Bun.file(entry).exists()).toBe(true);
    await session.close();
    await session.close();
    expect(child(fake).inputEnded).toBe(true);
    expect(await Bun.file(entry).exists()).toBe(false);
    expect(session.problems()).toEqual([]);
  });
});

describe("startSessionProcess refuses to start", () => {
  test("when ask fails, ending the process it started", async () => {
    const fake = fakeProcess({
      ask: () => ({ text: "database: options is required", isError: true }),
    });
    await expect(start(fake)).rejects.toThrow(
      "ask returned an error: database: options is required",
    );
    expect(child(fake).inputEnded || child(fake).signals.length > 0).toBe(true);
    expect(await Bun.file(fake.spawned[0]?.args[0] ?? "").exists()).toBe(false);
  });

  test("when the ask result names another ask than the scenario's", async () => {
    const fake = fakeProcess({
      ask: () => ({
        text: JSON.stringify({
          epoch: "e",
          askId: "other",
          state: "waiting",
          cursor: "e.0",
          board: boardLink({ port: 47201, askId: "other", token: TOKENS[0] ?? "" }),
        }),
      }),
    });
    await expect(start(fake)).rejects.toThrow(
      `the ask result names ask other, not the scenario's ${askId}`,
    );
  });

  test("when the proxy cannot start, ending the process, its client and its stage", async () => {
    const fake = fakeProcess();
    const failing = () => Promise.reject(new Error("listen EADDRINUSE"));
    await expect(start(fake, { startProxy: failing })).rejects.toThrow("listen EADDRINUSE");
    // Killed, as launch's own failures are; its exit closes the MCP client's transport.
    expect(child(fake).signals).toEqual(["SIGKILL"]);
    const spawned = fake.spawned[0];
    expect(await Bun.file(spawned?.args[0] ?? "").exists()).toBe(false);
    const linksFile = spawned?.options.env[LINKS_VARIABLE] ?? "";
    expect(await exists(dirname(linksFile))).toBe(false);
  });

  test("when BROWSER was not opened with the result's link as its one argument", async () => {
    const twice = fakeProcess({ open: (file, link) => appendFileSync(file, `2\t${link} x\n`) });
    await expect(start(twice)).rejects.toThrow(
      "BROWSER was started with 2 argument(s), not the ask result's link alone",
    );
    const never = fakeProcess({ open: () => undefined });
    await expect(start(never)).rejects.toThrow("opened 0 board(s) through BROWSER");
  });
});
