import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { linkParts, openBoardSocket } from "./board-page.ts";
import { removeShortFolders } from "./modes.ts";
import { cleanUp, type Session, startSession } from "./session.ts";

// Settings and languages on the real session process (settings-languages, tasks 4.5 and 4.6): the
// suite gives each session process a home, a configuration folder and a project of its own, so a
// developer's configuration never reaches it, and a scenario writes the files it needs there. run.ts
// runs this file in each of AD-1's configurations.

const version = BOARD_PROTOCOL_VERSION;
const ASK_ID = "settings-conformance";

afterEach(cleanUp);
afterEach(removeShortFolders);

type Row = { readonly value?: unknown; readonly from: string; readonly writable: boolean };
type Settings = { readonly keys: Readonly<Record<string, Row>> };

/** Asks the plain-choice question and connects a board, returning the settings it opened with. */
const openedSettings = async (session: Session): Promise<Settings> => {
  const asked = await session.call("ask", { ...PLAIN_CHOICE, askId: ASK_ID });
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
