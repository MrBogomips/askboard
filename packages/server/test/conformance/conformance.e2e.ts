import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  BOARD_CLOSE_CODES,
  BOARD_HOST,
  BOARD_PORT_RANGE,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  boardPagePolicy,
  type PollResponse,
  RESULT_VERSIONS,
  SCHEMA_IDS,
  TOOL_DEFINITIONS,
} from "@askboard/contract";
import {
  ONE_PIXEL_PNG,
  plainChoiceBoardDocument,
  restartTranscript,
  transcripts,
} from "@askboard/contract/fixtures";
import { validateAgainst, validateLocalApi } from "@askboard/contract/validate";
import {
  type BoardSocket,
  linkParts,
  openBoardSocket,
  replay,
  withLanguage,
} from "./board-page.ts";
import type { ModHost } from "./mod-host.ts";
import {
  getOverSocket,
  removeShortFolders,
  runMode,
  sessionFileIn,
  shortFolder,
  treeOf,
} from "./modes.ts";
import { afterPolls, answeredPolls } from "./push-steps.ts";
import { launchBrowser, openRealBoard, STEP_TIMEOUT_MS } from "./real-board.ts";
import {
  bundleWith,
  CONFIGURATION,
  cleanUp,
  distViewFiles,
  GIT_USER,
  isEmpty,
  isRunning,
  listeningPorts,
  manifestOf,
  RUNTIME,
  type Session,
  startSession,
} from "./session.ts";

// The conformance suite (task 9.2, design decision 11): the built session process on Bun or Node 24,
// serving the real `dist/view/`, driven over stdio by the MCP client as Claude Code drives it, with
// a recorder script as BROWSER. The approved plain-choice example is answered on the real board
// page, opened in Chromium at the link the recorder caught; a scripted board page replays every
// recorded board exchange, the refusals the real page never sends among them. Run it with run.ts
// beside it.
//
// run.ts runs it in two of AD-1's configurations (push delivery, tasks 9.3 and 9.4): with the
// mod disabled, its cases with hooks included, and with the hooks disabled, where those are left
// out and a stand-in mod host runs the built mod beside every session process. Every ask is then
// unchecked, so the mod is given no event and pushes nothing; everything else is as in E1.

const version = BOARD_PROTOCOL_VERSION;
const FIXTURES = join(import.meta.dir, "..", "..", "..", "contract", "test", "fixtures");
const approved = (kind: string, name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES, kind, `${name}.json`), "utf8"));
const PLAIN_CHOICE = approved("asks", "plain-choice");
const QUESTION = plainChoiceBoardDocument.items[0];
const ASK_ID = plainChoiceBoardDocument.askId;
const WHEN = "2026-10-29T09:41:27Z";

const HOOKS_DISABLED = CONFIGURATION === "hooks-disabled";

const modPushedNothing = (hosts: readonly ModHost[]): void => {
  for (const { record } of hosts) {
    expect(record.problems).toEqual([]);
    expect(record.pushes).toEqual([]);
    expect(record.toasts).toEqual([]);
    expect(record.exchanges.filter((each) => each.path === "/v1/mod/delivered")).toEqual([]);
    for (const poll of answeredPolls(record)) {
      const { asks, pending } = poll.response as PollResponse;
      expect(asks).toEqual([]);
      for (const ask of pending) {
        expect(ask.label).toBe("Agent");
        expect(ask).not.toHaveProperty("agent_id");
      }
    }
  }
};

afterEach(async () => {
  const hosts = await cleanUp();
  if (HOOKS_DISABLED) modPushedNothing(hosts);
});
afterEach(removeShortFolders);

console.error(`conformance: ${RUNTIME}, dist/view`);

// A loopback port the range offers that no process listens on.
const portIsFree = (port: number): boolean => {
  try {
    Bun.listen({ hostname: BOARD_HOST, port, socket: { data: () => undefined } }).stop(true);
    return true;
  } catch {
    return false;
  }
};

const askOf = (askId: string) => ({ ...PLAIN_CHOICE, askId });

// A session process's own words in a result, with its epoch, link and versions put back as the
// approved examples write them: the examples name the contract's 1.0 sets.
const asExample = (value: unknown, epoch: string, link: string): unknown => {
  const { board: example, versions } = approved("results", "plain-choice") as {
    board: string;
    versions: unknown;
  };
  return JSON.parse(
    JSON.stringify(value)
      .replaceAll(
        `"versions":${JSON.stringify(RESULT_VERSIONS)}`,
        `"versions":${JSON.stringify(versions)}`,
      )
      .replaceAll(link, example)
      .replaceAll(`"${epoch}"`, '"k3x9"')
      .replaceAll(`"${epoch}.`, '"k3x9.'),
  );
};

const onlyProtocol = (session: Session) => {
  expect(session.transport.lines.length).toBeGreaterThan(0);
  for (const line of session.transport.lines) {
    expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
  }
};

const collectAfterStart = (session: Session, epoch: string, askId = ASK_ID) =>
  session.call("collect", { asks: [{ askId, after: `${epoch}.0` }] });

/** Asks the plain-choice question and connects the scripted board page to its board. */
const askAndConnect = async (session: Session, askId = ASK_ID) => {
  const asked = await session.call("ask", askOf(askId));
  const result = asked.json as { epoch: string; board: string; cursor: string };
  const link = linkParts(result.board);
  const board = await openBoardSocket(link.port, askId);
  board.send({ version, type: "connect", token: link.token });
  expect(await board.next()).toMatchObject({ type: "board" });
  expect(await board.next()).toMatchObject({ type: "state", state: { ask: "waiting" } });
  return { result, link, board };
};

// The answer event with the approved example's `when`, once the browser's is checked: a UTC time the
// click stamped, so inside the click's window (to the second, which a log may keep alone).
const withApprovedWhen = (collected: unknown, window: { from: number; to: number }): unknown => {
  const [ask] = (collected as { asks: { events: { when: string }[] }[] }).asks;
  const when = ask?.events[0]?.when ?? "";
  expect(when).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  expect(Date.parse(when)).toBeGreaterThanOrEqual(Math.floor(window.from / 1000) * 1000);
  expect(Date.parse(when)).toBeLessThanOrEqual(window.to);
  return JSON.parse(JSON.stringify(collected).replace(`"when":"${when}"`, `"when":"${WHEN}"`));
};

const answerOf = (choice: readonly string[]) => ({
  version,
  type: "answer",
  itemId: QUESTION.id,
  rev: 1,
  choice,
  when: WHEN,
});

describe("before the first ask", () => {
  test("server/discover alone opens no port, writes no file, starts no process", async () => {
    const session = await startSession();
    await session.client.discover();
    expect(listeningPorts(session.pid)).toEqual([]);
    expect(session.opened()).toEqual([]);
    expect(await session.end()).toBe(0);
    expect(isRunning(session.pid)).toBe(false);
    expect(isEmpty(session.home)).toBe(true);
    expect(await session.stderr()).toBe(
      "askboard: session ending (stdin closed): 0 open asks discarded\n",
    );
    onlyProtocol(session);
  });

  test("tools/list gives ask, update, collect, fetch and snapshot, as the contract defines them, on either negotiation", async () => {
    for (const negotiation of ["auto", "legacy"] as const) {
      const session = await startSession({ negotiation });
      const { tools } = await session.client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "ask",
        "update",
        "collect",
        "fetch",
        "snapshot",
      ]);
      for (const [at, tool] of tools.entries())
        expect(tool).toMatchObject(TOOL_DEFINITIONS[at] ?? {});
      expect(await session.end()).toBe(0);
      onlyProtocol(session);
    }
  });
});

describe("the approved plain-choice example, end to end", () => {
  test("ask, board, answer, collect and exit give the approved results", async () => {
    const session = await startSession();
    const asked = await session.call("ask", PLAIN_CHOICE);
    expect(asked.isError).toBe(false);
    const result = asked.json as { epoch: string; board: string };
    expect(validateAgainst(SCHEMA_IDS.askResult, asked.json).ok).toBe(true);
    expect(asExample(asked.json, result.epoch, result.board)).toMatchObject(
      approved("results", "plain-choice"),
    );
    expect(asked.json).toMatchObject({ warnings: [{ code: "no-hooks" }] });
    const link = linkParts(result.board);
    // The process listens on the board's port alone (and the helper sees a listener at all).
    expect(listeningPorts(session.pid)).toEqual([link.port]);

    // The board opens in the browser: the link is the opener's one argument.
    expect(await session.nextOpened()).toEqual([result.board]);

    // The board page, under its policy.
    const page = await fetch(result.board);
    expect(page.status).toBe(BOARD_RESPONSES.boardPage.status);
    expect(page.headers.get("content-type")).toBe(BOARD_RESPONSES.boardPage.contentType);
    const bundle = bundleWith();
    expect(page.headers.get("content-security-policy")).toBe(boardPagePolicy(manifestOf(bundle)));
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    expect(page.headers.get("set-cookie")).toBeNull();

    // The user opens the link the recorder caught, picks PostgreSQL and presses Answer.
    const browser = await launchBrowser();
    try {
      const board = await openRealBoard(browser, result.board);
      await board.loaded(QUESTION.id);
      const window = { from: Date.now(), to: 0 };
      await board.option("PostgreSQL").click();
      await board.answer.click();
      window.to = Date.now();
      await board.receipt("sent");

      // The agent collects it, and the board shows it delivered.
      const collected = await collectAfterStart(session, result.epoch);
      expect(validateAgainst(SCHEMA_IDS.collectResult, collected.json).ok).toBe(true);
      expect(
        asExample(withApprovedWhen(collected.json, window), result.epoch, result.board),
      ).toMatchObject(approved("answers", "plain-choice"));
      expect(collected.json).toMatchObject({
        asks: [{ unchecked: true, events: [{ who: GIT_USER }] }],
      });
      await board.receipt("delivered to the agent");
      expect(board.received).toContainEqual(
        withLanguage({ version, type: "board", document: plainChoiceBoardDocument }),
      );
      expect(board.received).toContainEqual({
        version,
        type: "receipt",
        itemId: QUESTION.id,
        receipt: "delivered",
      });

      // stdin's end: the board shows the discard, and the process exits 0, leaving nothing.
      expect(await session.end()).toBe(0);
      await board.banner("This ask was discarded.");
      expect(board.received.at(-1)).toEqual({ version, type: "discarded", reason: "session-exit" });
      expect(board.errors).toEqual([]);
    } finally {
      await browser.close();
    }
    expect(portIsFree(link.port)).toBe(true);
    const stderr = await session.stderr();
    expect(stderr).not.toContain(link.token);
    expect(stderr).not.toContain(QUESTION.props.text);
    expect(stderr).not.toContain("PostgreSQL");
    onlyProtocol(session);
  });

  for (const name of ["uj1-diff-graph", "uj3-sales-review"]) {
    test(`${name}, still beyond the input format, is refused and creates nothing`, async () => {
      const session = await startSession();
      const asked = await session.call("ask", approved("asks", name));
      expect(asked.isError).toBe(true);
      expect(asked.text).toContain("not created");
      expect(listeningPorts(session.pid)).toEqual([]);
      expect(session.opened()).toEqual([]);
      expect(await session.end()).toBe(0);
    });
  }
});

describe("Track 0's recorded board exchanges, on the real session process", () => {
  for (const [name, transcript] of Object.entries(transcripts)) {
    if (transcript === restartTranscript) continue;
    test(name, async () => {
      const session = await startSession();
      const asked = await session.call("ask", askOf(transcript.askId));
      const result = asked.json as { epoch: string; board: string };
      let exited: number | undefined;
      const problems = await replay(transcript, linkParts(result.board), {
        collected: async () => {
          const collected = await collectAfterStart(session, result.epoch);
          expect(collected.isError).toBe(false);
        },
        exit: async () => {
          exited = await session.end();
        },
      });
      expect(problems).toEqual([]);
      expect(exited ?? (await session.end())).toBe(0);
      onlyProtocol(session);
    });
  }

  test("restart: the new session process refuses the old token, and the link opens no board", async () => {
    const before = await startSession();
    const old = linkParts(
      ((await before.call("ask", PLAIN_CHOICE)).json as { board: string }).board,
    );
    expect(await before.end()).toBe(0);
    const after = await startSession();
    const other = await after.call("ask", askOf("another-ask"));
    const { port } = linkParts((other.json as { board: string }).board);
    const page = await fetch(`http://${BOARD_HOST}:${port}/b/${old.askId}?t=${old.token}`);
    expect(page.status).toBe(BOARD_RESPONSES.invalidLink.status);
    expect(await page.text()).not.toContain(QUESTION.props.text);
    const problems = await replay(
      restartTranscript,
      { ...old, port },
      {
        collected: async () => undefined,
        exit: async () => undefined,
      },
    );
    expect(problems).toEqual([]);
    expect(await after.end()).toBe(0);
  });
});

describe("collect with wait", () => {
  test("returns as soon as the user answers on the board", async () => {
    const session = await startSession();
    const { result, board } = await askAndConnect(session);
    let settled = false;
    const waiting = session
      .call("collect", {
        asks: [{ askId: ASK_ID, after: result.cursor }],
        wait: { askId: ASK_ID, itemId: QUESTION.id },
      })
      .finally(() => {
        settled = true;
      });
    await Bun.sleep(300);
    expect(settled).toBe(false);
    board.send(answerOf(["SQLite"]));
    const collected = await waiting;
    expect(collected.json).toMatchObject({
      asks: [
        { askId: ASK_ID, state: "answered", events: [{ type: "answer", choice: ["SQLite"] }] },
      ],
    });
    expect(await session.end()).toBe(0);
  });

  test("returns the discard when Claude Code stops the session with SIGINT while it waits", async () => {
    const session = await startSession();
    const { result } = await askAndConnect(session);
    const waiting = session.call("collect", {
      asks: [{ askId: ASK_ID, after: result.cursor }],
      wait: { askId: ASK_ID, itemId: QUESTION.id },
    });
    await Bun.sleep(200);
    process.kill(session.pid, "SIGINT");
    expect((await waiting).json).toMatchObject({
      asks: [{ state: "discarded", events: [{ type: "discarded", reason: "session-exit" }] }],
    });
    expect(await session.exited).toBe(0);
  });

  test("does not hold the exit at stdin's end, which ends the protocol, and the board hears it", async () => {
    const session = await startSession();
    const { result, board } = await askAndConnect(session);
    const waiting = session
      .call("collect", {
        asks: [{ askId: ASK_ID, after: result.cursor }],
        wait: { askId: ASK_ID, itemId: QUESTION.id },
      })
      .catch((error: unknown) => error);
    await Bun.sleep(200);
    const started = Date.now();
    expect(await session.end()).toBe(0);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    // The client ended the session: its waiting request ends with the connection.
    expect(await waiting).toBeInstanceOf(Error);
  });
});

describe("resending an ask", () => {
  test("an identical request returns the same board and opens nothing more", async () => {
    const session = await startSession();
    const first = (await session.call("ask", PLAIN_CHOICE)).json as Record<string, unknown>;
    await session.nextOpened();
    const reordered = Object.fromEntries(Object.entries(PLAIN_CHOICE).reverse());
    const again = (await session.call("ask", reordered)).json as Record<string, unknown>;
    expect(again.board).toBe(first.board);
    expect(again.cursor).toBe(`${first.epoch}.0`);
    const other = await session.call("ask", { ...PLAIN_CHOICE, title: "Another title" });
    expect(other.isError).toBe(true);
    expect(other.text).toContain("in use");
    await Bun.sleep(200);
    expect(session.opened()).toHaveLength(1);
    expect(await session.end()).toBe(0);
  });
});

describe("a new ask's notices (push delivery, task 5.4)", () => {
  test("with no board working, it opens through BROWSER and shows one notification", async () => {
    const session = await startSession();
    const asked = await session.call("ask", PLAIN_CHOICE);
    const result = asked.json as { board: string };
    expect(await session.nextOpened()).toEqual([result.board]);
    for (let tries = 0; tries < 200 && session.notified().length === 0; tries += 1) {
      await Bun.sleep(10);
    }
    expect(session.notified()).toHaveLength(1);
    const [notified = []] = session.notified();
    expect(notified[0]).toBe(process.platform === "darwin" ? "osascript" : "notify-send");
    expect(notified).toContain(plainChoiceBoardDocument.title);
    expect(notified.at(-1)).toBe(`${basename(session.project)} · 1 question`);
    expect(notified.join("\n")).not.toContain(linkParts(result.board).token);
    expect(await session.end()).toBe(0);
    expect(session.opened()).toHaveLength(1);
  });
});

describe.skipIf(HOOKS_DISABLED)(
  "the bundle's hook and client modes (push delivery, task 6.6)",
  () => {
    const preToolUse = (askId: string, cwd: string) =>
      JSON.stringify({
        session_id: "0f6b6a43-6a6c-4c3e-9a55-3d1c1c0e2b7a",
        cwd,
        hook_event_name: "PreToolUse",
        tool_name: "mcp__plugin_askboard_askboard__ask",
        tool_input: { askId },
        tool_use_id: "toolu_01HJ6m9QxR2a7pLmWn3VbT4k",
      });

    test("the guard they run under ends a process that opens a listening socket", async () => {
      const home = shortFolder();
      const script = join(home, "listens.mjs");
      await Bun.write(script, 'import http from "node:http";\nhttp.createServer().listen(0);\n');
      const ran = await runMode([], { runtime: home, home, script });
      expect(ran).toMatchObject({ code: 97, stderr: "no-listen: a listening socket was opened\n" });
    });

    test("a PreToolUse hook binds the next ask, opening no port and writing no file", async () => {
      const runtime = shortFolder();
      const home = shortFolder();
      const session = await startSession({ env: { XDG_RUNTIME_DIR: runtime } });
      await session.client.listTools();
      await sessionFileIn(runtime);
      const before = treeOf(runtime);
      const askId = "hook-mode-db-k3f9";
      const hooked = await runMode(["hook", "PreToolUse"], {
        runtime,
        home,
        stdin: preToolUse(askId, session.project),
      });
      expect(hooked).toEqual({ code: 0, stdout: "", stderr: "" });
      expect(treeOf(runtime)).toEqual(before);
      expect(treeOf(home)).toEqual([]);
      // The suite's MCP client sends no tool_use_id, so the record binds by the next-call rule.
      const asked = await session.call("ask", askOf(askId));
      expect(asked.isError).toBe(false);
      expect(asked.json).not.toHaveProperty("warnings");
      expect(await session.end()).toBe(0);
    });

    test("the client prints the poll response the socket gives, opening no port and writing no file", async () => {
      const runtime = shortFolder();
      const home = shortFolder();
      const session = await startSession({ env: { XDG_RUNTIME_DIR: runtime } });
      await session.client.listTools();
      const file = await sessionFileIn(runtime);
      const askId = "client-mode-db-k3f9";
      const hooked = await runMode(["hook", "PreToolUse"], {
        runtime,
        home,
        stdin: preToolUse(askId, session.project),
      });
      expect(hooked.code).toBe(0);
      const { result, board } = await askAndConnect(session, askId);
      board.send(answerOf(["SQLite"]));
      for (let tries = 0; tries < 50; tries += 1) {
        const polled = JSON.parse((await getOverSocket(file, "/v1/mod/poll")).body);
        if (polled.asks.length > 0) break;
        await Bun.sleep(20);
      }
      const before = treeOf(runtime);
      const viaClient = await runMode(["client", "/v1/mod/poll"], { runtime, home });
      const viaSocket = await getOverSocket(file, "/v1/mod/poll");
      expect(viaSocket.status).toBe(200);
      expect(viaClient).toEqual({ code: 0, stdout: viaSocket.body, stderr: "" });
      const poll = JSON.parse(viaClient.stdout);
      expect(validateLocalApi("pollResponse", poll).ok).toBe(true);
      expect(poll).toMatchObject({
        epoch: result.epoch,
        asks: [{ askId, state: "answered", events: [{ type: "answer", choice: ["SQLite"] }] }],
      });
      expect(poll.asks[0]).not.toHaveProperty("agent_id");
      expect(treeOf(runtime)).toEqual(before);
      expect(treeOf(home)).toEqual([]);
      expect(await session.end()).toBe(0);
    });
  },
);

describe.skipIf(HOOKS_DISABLED)("an ask its hook recorded (push delivery, task 4.8)", () => {
  const recordOf = (tool: string, toolInput: Record<string, unknown>, cwd: string) =>
    JSON.stringify({
      session_id: "0f6b6a43-6a6c-4c3e-9a55-3d1c1c0e2b7a",
      cwd,
      hook_event_name: "PreToolUse",
      tool_name: `mcp__plugin_askboard_askboard__${tool}`,
      tool_input: toolInput,
      tool_use_id: `toolu_owned_${tool}`,
      agent_id: "a19c05fdf24e1b9a2",
      agent_type: "code-reviewer",
    });

  /** The board socket's next message of a type, skipping the others. */
  const nextOfType = async (board: BoardSocket, type: string): Promise<Record<string, unknown>> => {
    for (;;) {
      const message = (await board.next()) as Record<string, unknown>;
      if (message.type === type) return message;
    }
  };

  test("its owner's collect returns its events, and a call with no record is refused", async () => {
    const runtime = shortFolder();
    const home = shortFolder();
    const session = await startSession({ env: { XDG_RUNTIME_DIR: runtime } });
    await session.client.listTools();
    await sessionFileIn(runtime);
    const askId = "owned-db-k3f9";
    const hook = (tool: string, toolInput: Record<string, unknown>) =>
      runMode(["hook", "PreToolUse"], {
        runtime,
        home,
        stdin: recordOf(tool, toolInput, session.project),
      });

    // The suite's MCP client sends no tool_use_id, so each record binds by the next-call rule.
    expect(await hook("ask", { askId })).toEqual({ code: 0, stdout: "", stderr: "" });
    const { result, board } = await askAndConnect(session, askId);
    expect(result).not.toHaveProperty("warnings");
    board.send(answerOf(["SQLite"]));
    expect(await nextOfType(board, "state")).toMatchObject({ state: { ask: "answered" } });

    const args = { asks: [{ askId, after: result.cursor }] };
    const unbound = await session.call("collect", args);
    expect(unbound.isError).toBe(true);
    expect(unbound.text).toContain("no agent record");

    expect(await hook("collect", args)).toEqual({ code: 0, stdout: "", stderr: "" });
    const collected = await session.call("collect", args);
    expect(collected.isError).toBe(false);
    expect(collected.json).toMatchObject({
      asks: [{ askId, state: "answered", events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    expect((collected.json as { asks: object[] }).asks[0]).not.toHaveProperty("unchecked");
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    expect(await session.end()).toBe(0);
  });
});

describe("no board can be shown", () => {
  for (const [what, options, reason] of [
    ["inside a container", { env: { DEVCONTAINER: "1" } }, "container"],
    ["on CI without BROWSER", { env: { CI: "true" }, without: ["BROWSER"] }, "ci"],
  ] as const) {
    test(`${what}, ask is unavailable and opens no port`, async () => {
      const session = await startSession(options);
      const asked = await session.call("ask", PLAIN_CHOICE);
      expect(asked.json).toMatchObject({ outcome: "unavailable", reason, askId: ASK_ID });
      expect(validateAgainst(SCHEMA_IDS.askUnavailable, asked.json).ok).toBe(true);
      expect(listeningPorts(session.pid)).toEqual([]);
      expect(session.opened()).toEqual([]);
      expect(await session.end()).toBe(0);
    });
  }
});

describe("exit", () => {
  test("SIGINT with a board connected tells the board and exits 0", async () => {
    const session = await startSession();
    const { board, link } = await askAndConnect(session);
    process.kill(session.pid, "SIGINT");
    expect(await session.exited).toBe(0);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    expect(portIsFree(link.port)).toBe(true);
    expect(await session.stderr()).toBe(
      "askboard: session ending (SIGINT): 1 open ask discarded\n",
    );
  });
});

describe("the view build", () => {
  // A copy of the real view build with its shell chunk changed after the manifest hashed it.
  const damaged = (): Record<string, string> => {
    const shell = manifestOf(bundleWith()).chunks.shell?.script.path ?? "";
    return { ...distViewFiles(), [shell]: "/* changed */\n" };
  };
  for (const [what, files, code] of [
    ["missing", () => ({}), "VIEW_MANIFEST_UNREADABLE"],
    ["damaged", damaged, "VIEW_FILE_INVALID"],
  ] as const) {
    test(`a ${what} view build fails the ask with its own error, creating nothing`, async () => {
      const session = await startSession({ bundle: bundleWith(files()) });
      const asked = await session.call("ask", PLAIN_CHOICE);
      expect(asked.isError).toBe(true);
      expect(asked.text).toContain("view build is missing or damaged");
      expect(asked.text).not.toContain("Send it again");
      expect(listeningPorts(session.pid)).toEqual([]);
      expect(session.opened()).toEqual([]);
      expect(await session.end()).toBe(0);
      expect(await session.stderr()).toStartWith(
        `askboard: ask failed: ViewBuildError (${code})\n`,
      );
    });
  }
});

describe.if(HOOKS_DISABLED)("the mod beside the session process (push delivery, task 9.4)", () => {
  // E1's cases mostly end before the mod's first poll: this one waits for it.
  test("an answered unchecked ask is polled and pushed nothing, and waits for collect", async () => {
    const session = await startSession();
    const mod = session.mod;
    if (mod === undefined) throw new Error("no mod host beside the session process");
    const { result, board } = await askAndConnect(session);
    expect(result).toMatchObject({ warnings: [{ code: "no-hooks" }] });
    board.send(answerOf(["SQLite"]));
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "answered" } });
    await afterPolls(mod, 2);
    const polled = answeredPolls(mod.record).map((poll) => poll.response as PollResponse);
    expect(polled.at(-1)?.pending).toMatchObject([{ askId: ASK_ID, label: "Agent" }]);
    expect(mod.record.pushes).toEqual([]);
    const collected = await collectAfterStart(session, result.epoch);
    expect(collected.json).toMatchObject({
      asks: [{ askId: ASK_ID, unchecked: true, events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    expect(await board.next()).toMatchObject({ type: "receipt", receipt: "delivered" });
    expect(await session.end()).toBe(0);
  });
});

// The conformance suite's context ask (excerpts, task 7.1; design decision 11): the built session
// process on Bun or Node 24, serving the real `dist/view/`, with `CLAUDE_PROJECT_DIR` naming its
// throwaway project. One question holds the approved UJ-1 excerpt pointer, an excerpt the agent
// wrote, an image, a FILE reference and an excerpt whose file is missing. The real board in
// Chromium shows every item, opens the reading panel and takes the answer; `collect` returns it,
// and `fetch` holds no excerpt text or image bytes. Run it with run.ts beside it.

const CONTEXT_ASK_ID = "context-ask-s9t1";
const ADR = "docs/adr/0012-payment-retries.md";
const ADR_TEXT = [
  "# ADR 12: payment retries",
  "",
  "## Context",
  "",
  "Payments fail for transient reasons.",
  "",
  "## Decision",
  "",
  "We retry a failed payment three times, with exponential backoff.",
  "",
].join("\n");
const CONTEXT_WRITTEN = "retries: 3\nbackoff: exponential";
const SOURCE_LINES = Array.from(
  { length: 8 },
  (_, at) => `export const retry${at + 1} = ${at + 1};`,
);

const contextAsk = {
  askId: CONTEXT_ASK_ID,
  title: "Payment retry fix",
  items: [
    {
      type: "question",
      id: "fix",
      props: {
        text: "Which fix should I keep for the failing payment retry?",
        options: [{ label: "Fix A" }, { label: "Fix B" }],
        items: [
          { type: "excerpt", id: "retry-adr", props: { pointer: `${ADR}#Decision` } },
          {
            type: "excerpt",
            id: "settings",
            props: { text: CONTEXT_WRITTEN, title: "Retry settings" },
          },
          {
            type: "image",
            id: "shot",
            props: { pointer: ".askboard/media/shot.png", alt: "The retry log" },
          },
          { type: "reference", id: "retry-src", props: { pointer: "src/retry.ts#L1-L5" } },
          { type: "excerpt", id: "gone", props: { pointer: "docs/missing.md#Intro" } },
        ],
      },
    },
  ],
};

const writeContextProject = (project: string): void => {
  const files: Record<string, string | Uint8Array> = {
    [ADR]: ADR_TEXT,
    ".askboard/media/shot.png": Uint8Array.from(Buffer.from(ONE_PIXEL_PNG, "base64")),
    "src/retry.ts": `${SOURCE_LINES.join("\n")}\n`,
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), content);
  }
};

describe("a question with context (excerpts)", () => {
  test("the ask resolves the pointers, the real board shows and answers it, and fetch holds no source", async () => {
    const session = await startSession();
    writeContextProject(session.project);

    const asked = await session.call("ask", contextAsk);
    expect(asked.isError).toBe(false);
    const result = asked.json as {
      board: string;
      epoch: string;
      cursor: string;
      warnings?: unknown[];
    };
    // An unchecked ask also carries the no-hooks warning: only the pointer's is the point here.
    const pointerWarnings = (result.warnings ?? []).filter(
      (warning) => (warning as { code?: string }).code === "unresolved-pointer",
    );
    expect(pointerWarnings).toEqual([
      expect.objectContaining({
        code: "unresolved-pointer",
        itemId: "gone",
        pointer: "docs/missing.md#Intro",
        reason: "not-found",
      }),
    ]);
    expect(validateAgainst(SCHEMA_IDS.askResult, asked.json).ok).toBe(true);
    expect(await session.nextOpened()).toEqual([result.board]);

    const browser = await launchBrowser();
    try {
      const board = await openRealBoard(browser, result.board);
      await board.loaded("fix");
      const card = board.card("fix");
      // Split: the context column beside the question, holding the excerpts then the references.
      const column = card.locator('[data-askboard-context="beside"]');
      await column.waitFor({ timeout: STEP_TIMEOUT_MS });
      await column.getByText("Excerpt and references", { exact: true }).waitFor();
      const text = card.getByRole("heading", { level: 2 });
      const [columnBox, textBox] = [await column.boundingBox(), await text.boundingBox()];
      if (columnBox === null || textBox === null) throw new Error("no box");
      expect(columnBox.x).toBeGreaterThan(textBox.x + textBox.width - 1);
      for (const id of ["retry-adr", "settings", "retry-src", "gone"]) {
        await column.locator(`[data-askboard-item="${id}"]`).waitFor();
      }
      await column.getByText("We retry a failed payment three times", { exact: false }).waitFor();
      await column.getByText("backoff: exponential", { exact: false }).waitFor();
      await column.locator('[data-askboard-item="gone"]').getByText("Unresolved").waitFor();
      await card.locator('[data-askboard-item="shot"] img').waitFor();

      // The reading panel opens at line 1 of the source.
      await column.locator('[data-askboard-item="retry-src"]').getByRole("button").click();
      const panel = board.page.locator('aside[aria-label="Reading panel"]');
      await panel.getByText("src/retry.ts", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
      const source = board.page.frameLocator('aside[aria-label="Reading panel"] iframe');
      await source.locator("#L1").waitFor({ timeout: STEP_TIMEOUT_MS });
      expect(await source.locator(".hit").count()).toBe(5);
      await source.getByText(SOURCE_LINES[0] ?? "", { exact: false }).waitFor();

      // The panel lies over the question's right side: the user closes it, then answers.
      await panel.getByRole("button", { name: "Close reading panel" }).click();
      await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      // The user answers; the missing pointer left the question answerable.
      await board.optionIn("fix", "Fix B").click();
      await board.buttonIn("fix", "Answer").click();
      await board.receipt("sent");
      expect(board.errors).toEqual([]);
    } finally {
      await browser.close();
    }

    const collected = await session.call("collect", {
      asks: [{ askId: CONTEXT_ASK_ID, after: `${result.epoch}.0` }],
    });
    expect(collected.json).toMatchObject({
      asks: [
        {
          askId: CONTEXT_ASK_ID,
          state: "answered",
          events: [{ type: "answer", itemId: "fix", choice: ["Fix B"] }],
        },
      ],
    });

    // `fetch` names the items and their pointers, and holds neither the excerpt's text nor the image's bytes.
    const fetched = await session.call("fetch", { askId: CONTEXT_ASK_ID, itemId: "fix" });
    expect(fetched.isError).toBe(false);
    const body = JSON.stringify(fetched.json);
    expect(body).not.toContain("We retry a failed payment");
    expect(body).not.toContain(CONTEXT_WRITTEN.split("\n")[0] ?? "");
    expect(body).not.toContain(ONE_PIXEL_PNG);
    expect(body).not.toContain(SOURCE_LINES[0] ?? "");
    expect(await session.end()).toBe(0);
  });
});
