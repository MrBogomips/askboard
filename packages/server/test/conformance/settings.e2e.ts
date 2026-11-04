import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { linkParts, openBoardSocket } from "./board-page.ts";
import { getOverSocket, removeShortFolders, sessionFileIn, shortFolder } from "./modes.ts";
import { cleanUp, type Session, type SessionOptions, startSession } from "./session.ts";

// Settings and languages on the real session process (settings-languages, tasks 4.5 and 4.6): the
// suite gives each session process a home, a configuration folder and a project of its own, so a
// developer's configuration never reaches it, and a scenario writes the files it needs there. run.ts
// runs this file in each of AD-1's configurations.

const version = BOARD_PROTOCOL_VERSION;
const ASK_ID = "settings-conformance";
const [QUESTION] = plainChoiceBoardDocument.items;
const ASK = {
  askId: ASK_ID,
  items: [{ type: QUESTION.type, id: QUESTION.id, props: QUESTION.props }],
};

afterEach(cleanUp);
afterEach(removeShortFolders);

type Row = { readonly value?: unknown; readonly from: string; readonly writable: boolean };
type Settings = { readonly keys: Readonly<Record<string, Row>> };

/** Asks the plain-choice question and connects a board, returning the settings it opened with. */
const openedSettings = async (session: Session): Promise<Settings> => {
  const asked = await session.call("ask", ASK);
  const link = linkParts((asked.json as { board: string }).board);
  const board = await openBoardSocket(link.port, ASK_ID);
  try {
    board.send({ version, type: "connect", token: link.token });
    expect(await board.next()).toMatchObject({ type: "board" });
    expect(board.settings).toHaveLength(1);
    expect(board.problems).toEqual([]);
    return board.settings[0] as Settings;
  } finally {
    board.socket.terminate();
  }
};

/**
 * Waits for a file the session process creates: the first ask starts the project folders without
 * waiting for them (task 3.7), so a board can open before `.gitignore` is written.
 */
const created = async (path: string): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await Bun.sleep(5);
  }
};

/** Runs `start` with this process's HOME pointing at a developer-style home, then restores it. */
const withDeveloperHome = async <T>(start: () => Promise<T>): Promise<T> => {
  const developer = mkdtempSync(join(tmpdir(), "askboard-developer-home-"));
  const saved = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  try {
    mkdirSync(join(developer, ".config", "askboard"), { recursive: true });
    const file = join(developer, ".config", "askboard", "config.json");
    writeFileSync(file, `${JSON.stringify({ version: "1.0", theme: "dark" })}\n`);
    process.env.HOME = developer;
    delete process.env.XDG_CONFIG_HOME;
    return await start();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(developer, { recursive: true, force: true });
  }
};

describe("the session's own configuration", () => {
  test("the developer's user file is never read", async () => {
    const session = await withDeveloperHome(() => startSession());
    const settings = await openedSettings(session);
    expect(settings.keys.theme).toEqual({ value: "system", from: "default", writable: true });
    expect(await session.end()).toBe(0);
  });
});

/** A session with these files whose local API has started, and the rule its first `/v1/rule` gives. */
const firstRule = async (options: SessionOptions, before?: (session: Session) => void) => {
  const runtime = shortFolder();
  const session = await startSession({ ...options, env: { XDG_RUNTIME_DIR: runtime } });
  // Nothing is read before the first request after server/discover (AD-2).
  before?.(session);
  await session.client.listTools();
  const answer = await getOverSocket(await sessionFileIn(runtime), "/v1/rule");
  expect(answer.status).toBe(200);
  return { session, rule: (JSON.parse(answer.body) as { rule: string }).rule };
};

describe("the configuration wired into the session process", () => {
  test("a project file's asking rule is the rule of the session's first /v1/rule", async () => {
    const { session, rule } = await firstRule({
      projectConfig: { version: "1.0", askingRule: "always" },
      userConfig: { version: "1.0", askingRule: "with-references" },
    });
    expect(rule).toBe("always");
    expect(await session.end()).toBe(0);
  });

  test("a project file that fails its check applies nothing, and stderr names it", async () => {
    const { session, rule } = await firstRule({
      projectConfig: { version: "1.0", askingRule: "always", theme: "sepia" },
    });
    expect(rule).toBe("none");
    expect(await session.end()).toBe(0);
    const stderr = await session.stderr();
    expect(stderr).toContain(".askboard/config.json is not applied");
    expect(stderr).toContain("/theme");
  });

  test("an unreadable project file still lets the local API start, with the rule's default", async () => {
    const { session, rule } = await firstRule({}, (started) => {
      mkdirSync(join(started.project, ".askboard", "config.json"), { recursive: true });
    });
    expect(rule).toBe("none");
    expect(await session.end()).toBe(0);
    expect(await session.stderr()).toContain(".askboard/config.json is not applied");
  });

  test("the user file's theme reaches the board", async () => {
    const session = await startSession({ userConfig: { version: "1.0", theme: "dark" } });
    const settings = await openedSettings(session);
    expect(settings.keys.theme).toEqual({ value: "dark", from: "user", writable: true });
    expect(await session.end()).toBe(0);
  });

  test("the first ask creates .askboard/ in the project", async () => {
    const session = await startSession();
    expect(existsSync(join(session.project, ".askboard"))).toBe(false);
    await openedSettings(session);
    const folder = join(session.project, ".askboard");
    await created(join(folder, ".gitignore"));
    for (const name of ["snapshots", "media", "patches"]) {
      expect(existsSync(join(folder, name))).toBe(true);
    }
    expect(readFileSync(join(folder, ".gitignore"), "utf8")).toBe(
      "snapshots/\nmedia/\npatches/\nbench/\n",
    );
    expect(await session.end()).toBe(0);
  });
});
