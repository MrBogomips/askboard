import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_CLOSE_CODES,
  BOARD_HOST,
  BOARD_PORT_RANGE,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  boardPagePolicy,
  SCHEMA_IDS,
  TOOL_DEFINITIONS,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  plainChoiceBoardDocument,
  restartTranscript,
  transcripts,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { linkParts, openBoardSocket, replay } from "./board-page.ts";
import {
  bundleWith,
  cleanUp,
  GIT_USER,
  isEmpty,
  isRunning,
  manifestOf,
  RUNTIME,
  type Session,
  startSession,
  VIEW,
} from "./session.ts";

// The conformance suite (task 9.2, design decision 11): the built session process on Bun or Node 24,
// driven over stdio by the MCP client as Claude Code drives it, with a recorder script as BROWSER
// and a scripted board page. It runs every recorded board exchange and the approved model-contract
// examples E1 supports through ask, the board and collect. Run it with run.ts beside it.

const version = BOARD_PROTOCOL_VERSION;
const FIXTURES = join(import.meta.dir, "..", "..", "..", "contract", "test", "fixtures");
const approved = (kind: string, name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES, kind, `${name}.json`), "utf8"));
const PLAIN_CHOICE = approved("asks", "plain-choice");
const QUESTION = plainChoiceBoardDocument.items[0];
const ASK_ID = plainChoiceBoardDocument.askId;
const WHEN = "2026-10-29T09:41:27Z";

afterEach(cleanUp);

console.error(`conformance: ${RUNTIME}, ${VIEW} view`);

// A loopback port the range offers that no process listens on.
const portIsFree = (port: number): boolean => {
  try {
    Bun.listen({ hostname: BOARD_HOST, port, socket: { data: () => undefined } }).stop(true);
    return true;
  } catch {
    return false;
  }
};

const firstFreePort = (): number => {
  for (let port = BOARD_PORT_RANGE.first; port <= BOARD_PORT_RANGE.last; port += 1) {
    if (portIsFree(port)) return port;
  }
  throw new Error("the board port range is full");
};

const askOf = (askId: string) => ({ ...PLAIN_CHOICE, askId });

// A session process's own words in a result, with its epoch and link put back as the approved
// examples write them.
const asExample = (value: unknown, epoch: string, link: string): unknown => {
  const example = approved("results", "plain-choice").board as string;
  return JSON.parse(
    JSON.stringify(value)
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
    const free = firstFreePort();
    const session = await startSession();
    await session.client.discover();
    expect(portIsFree(free)).toBe(true);
    expect(session.opened()).toEqual([]);
    expect(await session.end()).toBe(0);
    expect(isRunning(session.pid)).toBe(false);
    expect(isEmpty(session.home)).toBe(true);
    expect(await session.stderr()).toBe(
      "askboard: session ending (stdin closed): 0 open asks discarded\n",
    );
    onlyProtocol(session);
  });

  test("tools/list gives ask then collect, as the contract defines them, on either negotiation", async () => {
    for (const negotiation of ["auto", "legacy"] as const) {
      const session = await startSession({ negotiation });
      const { tools } = await session.client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["ask", "collect"]);
      for (const [at, tool] of tools.entries())
        expect(tool).toMatchObject(TOOL_DEFINITIONS[at] ?? {});
      expect(await session.end()).toBe(0);
      onlyProtocol(session);
    }
  });
});

describe("the approved plain-choice example, end to end", () => {
  test("ask, board, answer, collect and exit give the approved results", async () => {
    const free = firstFreePort();
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
    expect(link.port).toBe(free);

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

    // The user answers on the board.
    const board = await openBoardSocket(link.port, link.askId);
    board.send({ version, type: "connect", token: link.token });
    expect(await board.next()).toEqual({
      version,
      type: "board",
      document: plainChoiceBoardDocument,
    });
    await board.next();
    board.send(answerOf(["PostgreSQL"]));
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "answered" } });

    // The agent collects it, and the board is told it was delivered.
    const collected = await collectAfterStart(session, result.epoch);
    expect(validateAgainst(SCHEMA_IDS.collectResult, collected.json).ok).toBe(true);
    expect(asExample(collected.json, result.epoch, result.board)).toMatchObject(
      approved("answers", "plain-choice"),
    );
    expect(collected.json).toMatchObject({
      asks: [{ unchecked: true, events: [{ who: GIT_USER }] }],
    });
    expect(await board.next()).toEqual({
      version,
      type: "receipt",
      itemId: QUESTION.id,
      receipt: "delivered",
    });

    // stdin's end: the board hears the discard, and the process exits 0, leaving nothing.
    expect(await session.end()).toBe(0);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    expect(portIsFree(link.port)).toBe(true);
    const stderr = await session.stderr();
    expect(stderr).not.toContain(link.token);
    expect(stderr).not.toContain(QUESTION.props.text);
    expect(stderr).not.toContain("PostgreSQL");
    onlyProtocol(session);
  });

  for (const name of ["uj1-diff-graph", "uj2-wbs-gantt", "uj3-sales-review"]) {
    test(`${name}, beyond E1's input format, is refused and creates nothing`, async () => {
      const free = firstFreePort();
      const session = await startSession();
      const asked = await session.call("ask", approved("asks", name));
      expect(asked.isError).toBe(true);
      expect(asked.text).toContain("not created");
      expect(portIsFree(free)).toBe(true);
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

describe("no board can be shown", () => {
  for (const [what, options, reason] of [
    ["inside a container", { env: { DEVCONTAINER: "1" } }, "container"],
    ["on CI without BROWSER", { env: { CI: "true" }, without: ["BROWSER"] }, "ci"],
  ] as const) {
    test(`${what}, ask is unavailable and opens no port`, async () => {
      const free = firstFreePort();
      const session = await startSession(options);
      const asked = await session.call("ask", PLAIN_CHOICE);
      expect(asked.json).toMatchObject({ outcome: "unavailable", reason, askId: ASK_ID });
      expect(validateAgainst(SCHEMA_IDS.askUnavailable, asked.json).ok).toBe(true);
      expect(portIsFree(free)).toBe(true);
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
  const shell = fixtureViewManifest.chunks.shell?.script.path ?? "";
  for (const [what, files, code] of [
    ["missing", {}, "VIEW_MANIFEST_UNREADABLE"],
    ["damaged", { ...fixtureViewFiles, [shell]: "/* changed */\n" }, "VIEW_FILE_INVALID"],
  ] as const) {
    test(`a ${what} view build fails the ask with its own error, creating nothing`, async () => {
      const free = firstFreePort();
      const session = await startSession({ bundle: bundleWith(files) });
      const asked = await session.call("ask", PLAIN_CHOICE);
      expect(asked.isError).toBe(true);
      expect(asked.text).toContain("view build is missing or damaged");
      expect(asked.text).not.toContain("Send it again");
      expect(portIsFree(free)).toBe(true);
      expect(session.opened()).toEqual([]);
      expect(await session.end()).toBe(0);
      expect(await session.stderr()).toStartWith(
        `askboard: ask failed: ViewBuildError (${code})\n`,
      );
    });
  }
});
