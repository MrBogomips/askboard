import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_CLOSE_CODES, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { PLAIN_CHOICE, settingsWithEveryKey } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { type BoardHost, createBoardHost, type HostCore } from "../src/board-host/index.ts";
import { NO_SETTINGS } from "../src/board-host/settings.ts";
import { configFiles } from "../src/config-files.ts";
import { fakeHostCore } from "./board-host/fake-core.ts";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  removeViews,
  startHost,
  type TestHost,
  writeView,
} from "./board-host/helpers.ts";

// Board-host spec, A board writes only presentation keys (settings-languages, task 5.2): a
// `setting` for anything but `theme`, `density` or `contextPlacement` with a schema value is a
// `message` refusal and neither configuration file changes; a valid one reaches ask-core, and the
// board hears the settings as read now, with the write's outcome.

const version = BOARD_PROTOCOL_VERSION;
const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-settings-writes-")));

const hosts: (TestHost | { readonly host: BoardHost })[] = [];
const sockets: BoardSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.socket.terminate();
  for (const fixture of hosts.splice(0)) await fixture.host.close();
});

afterAll(() => {
  for (const name of readdirSync(root)) chmodSync(join(root, name), 0o700);
  rmSync(root, { recursive: true, force: true });
  removeViews();
});

const USER_FILE = { version: "1.0", theme: "light", editor: ["code", "--goto", "{file}:{line}"] };
const PROJECT_FILE = { version: "1.0", density: "comfortable" };

let count = 0;

/** A home and a project of their own, each holding its configuration file. */
const files = () => {
  count += 1;
  const home = join(root, `home-${count}`);
  const project = join(root, `project-${count}`);
  const userFolder = join(home, ".config", "askboard");
  mkdirSync(userFolder, { recursive: true });
  mkdirSync(join(project, ".askboard"), { recursive: true });
  const user = join(userFolder, "config.json");
  const projectFile = join(project, ".askboard", "config.json");
  writeFileSync(user, `${JSON.stringify(USER_FILE, null, 2)}\n`);
  writeFileSync(projectFile, `${JSON.stringify(PROJECT_FILE, null, 2)}\n`);
  const env = { HOME: home, CLAUDE_PROJECT_DIR: project };
  const bytes = () => [readFileSync(user, "utf8"), readFileSync(projectFile, "utf8")];
  return { config: configFiles({ env }), user, userFolder, bytes };
};

/** A host whose ask-core reads these files, holding an ask, and a socket to its board. */
const hostWith = async (disk: ReturnType<typeof files>) => {
  const fixture = startHost({ ports: await freeRange(1), config: disk.config });
  hosts.push(fixture);
  const { port, askId, token } = await fixture.ask();
  const board = await openSocket(port, askId);
  sockets.push(board);
  return { fixture, board, token };
};

/** A live board on a host whose ask-core reads these files, past its opening. */
const liveBoard = async () => {
  const disk = files();
  const { fixture, board, token } = await hostWith(disk);
  board.send({ version, type: "connect", token });
  await opened(board);
  return { ...disk, fixture, board };
};

// The opening's messages: its settings when ask-core has them (task 5.1), then up to the state.
const opened = async (board: BoardSocket, settings = true) => {
  if (settings) await board.nextSettings();
  for (let message = await board.next(); ; message = await board.next()) {
    if ((message as { type?: string }).type === "state") return;
  }
};

const setting = (key: unknown, value: unknown) => ({ version, type: "setting", key, value });

describe("a board writes only presentation keys", () => {
  test.each([
    ["editor", ["sh", "-c", "curl evil"]],
    ["askingRule", "always"],
    ["snapshotFolder", "../outside"],
    ["defaultLanguage", "it-IT"],
    ["fontSize", 14],
    ["theme", "sepia"],
    ["theme", { dark: true }],
  ])("%s %p is refused as a message, and neither file changes", async (key, value) => {
    const { board, bytes, fixture } = await liveBoard();
    const before = bytes();
    board.send(setting(key, value));
    expect(await board.next()).toMatchObject({ version, type: "refused", reason: "message" });
    board.send({ ...setting("theme", "dark"), extra: true });
    expect(await board.next()).toMatchObject({ type: "refused", reason: "message" });
    expect(bytes()).toEqual(before);
    expect(fixture.reported).toEqual([]);
  });

  test("a write before connect is refused as any first message is, and nothing is written", async () => {
    const disk = files();
    const { board } = await hostWith(disk);
    const before = disk.bytes();
    board.send(setting("theme", "dark"));
    expect(await board.next()).toMatchObject({ type: "refused", reason: "token" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.refused);
    expect(disk.bytes()).toEqual(before);
  });

  test("a valid write reaches ask-core, and the board hears the settings with the outcome", async () => {
    const { board, user, fixture } = await liveBoard();
    board.send(setting("theme", "dark"));
    const settings = (await board.nextSettings()) as Record<string, any>;
    expect(validateBoardMessage("toPage", settings).ok).toBe(true);
    expect(settings).toMatchObject({
      version,
      type: "settings",
      write: { key: "theme", outcome: "saved" },
      keys: { theme: { value: "dark", from: "user", writable: true } },
      files: { user: { path: "~/.config/askboard/config.json", status: "applied" } },
    });
    expect(JSON.parse(readFileSync(user, "utf8"))).toEqual({ ...USER_FILE, theme: "dark" });
    expect(fixture.reported).toEqual([]);
  });

  test("a key the project sets is refused by ask-core, and the user file is unchanged", async () => {
    const { board, bytes } = await liveBoard();
    const before = bytes();
    board.send(setting("density", "compact"));
    expect(await board.nextSettings()).toMatchObject({
      type: "settings",
      write: { key: "density", outcome: "refused", reason: "set-by-project" },
      keys: { density: { value: "comfortable", from: "project", writable: false } },
    });
    expect(bytes()).toEqual(before);
  });

  test.skipIf(process.getuid?.() === 0)(
    "a failed write's outcome names the error and the file",
    async () => {
      const { board, userFolder } = await liveBoard();
      chmodSync(userFolder, 0o500);
      try {
        board.send(setting("contextPlacement", "inline"));
        expect(await board.nextSettings()).toMatchObject({
          type: "settings",
          write: {
            key: "contextPlacement",
            outcome: "failed",
            reason: "EACCES",
            path: "~/.config/askboard/config.json",
          },
          keys: { contextPlacement: { value: "beside", from: "default" } },
        });
      } finally {
        chmodSync(userFolder, 0o700);
      }
    },
  );
});

describe("a write ask-core cannot take", () => {
  const token = "sssssssssssssssssssssA";
  const { version: _, type: __, ...openingView } = settingsWithEveryKey;

  // A live board on a host around `core`, past its opening, and what the host reported.
  const fakeBoard = async (core: HostCore) => {
    const reported: unknown[] = [];
    const host = createBoardHost({
      core: () => core,
      view: writeView(),
      report: (error) => reported.push(error),
      ports: await freeRange(1),
      token: () => token,
    });
    hosts.push({ host });
    const link = new URL(await host.address.link(PLAIN_CHOICE.askId));
    const board = await openSocket(Number(link.port), PLAIN_CHOICE.askId);
    sockets.push(board);
    board.send({ version, type: "connect", token });
    await opened(board, core.boardSettingsView !== undefined);
    return { board, reported };
  };

  test("without ask-core's settings part, a write is refused as a message", async () => {
    const { board } = await fakeBoard(fakeHostCore().core);
    board.send(setting("theme", "dark"));
    expect(await board.next()).toEqual({
      version,
      type: "refused",
      reason: "message",
      detail: NO_SETTINGS,
    });
  });

  test("a write that fails in ask-core is reported, and the board hears nothing", async () => {
    const failure = new Error("the core failed");
    const { board, reported } = await fakeBoard({
      ...fakeHostCore().core,
      writeSetting: () => Promise.reject(failure),
      // The opening's settings; the failed write asks for none.
      boardSettingsView: () => Promise.resolve(openingView),
    });
    board.send(setting("theme", "dark"));
    board.send({ version, type: "draft", record: "not a record" });
    expect(await board.next()).toMatchObject({ type: "refused", reason: "message" });
    expect(reported).toEqual([failure]);
    expect(board.pending).toEqual([]);
  });
});
