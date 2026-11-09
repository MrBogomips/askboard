import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_PROTOCOL_VERSION, type KeyOverrides } from "@askboard/contract";
import { PLAIN_CHOICE, settingsWithEveryKey } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { type BoardHost, createBoardHost, type HostCore } from "../src/board-host/index.ts";
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

// Board-host spec, Settings sent to a board when it connects and A board writes only presentation
// keys (keyboard-shortcuts-help, task 9.3; design decision 19; review 8.13, security guards): the
// user's `keys` row reaches a board before its board and again after a write, a `setting` naming
// `keys` is refused before any file is touched, and a settings view the board protocol refuses
// never makes the host throw, drop the connection or send a part of a message.

const version = BOARD_PROTOCOL_VERSION;
const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-settings-keys-")));

const hosts: (TestHost | { readonly host: BoardHost })[] = [];
const sockets: BoardSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.socket.terminate();
  for (const fixture of hosts.splice(0)) await fixture.host.close();
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  removeViews();
});

const TOP: KeyOverrides = { "move.top": ["Mod+Alt+ArrowUp"] };

let count = 0;

/** A home and a project of their own, each file holding what it is given. */
const files = (user: Record<string, unknown>, project?: Record<string, unknown>) => {
  count += 1;
  const home = join(root, `home-${count}`);
  const projectDir = join(root, `project-${count}`);
  const userFolder = join(home, ".config", "askboard");
  mkdirSync(userFolder, { recursive: true });
  mkdirSync(join(projectDir, ".askboard"), { recursive: true });
  const userFile = join(userFolder, "config.json");
  const projectFile = join(projectDir, ".askboard", "config.json");
  writeFileSync(userFile, `${JSON.stringify({ version: "1.0", ...user }, null, 2)}\n`);
  if (project !== undefined) {
    writeFileSync(projectFile, `${JSON.stringify({ version: "1.0", ...project }, null, 2)}\n`);
  }
  const real = configFiles({ env: { HOME: home, CLAUDE_PROJECT_DIR: projectDir } });
  // Every call the host makes to the files through ask-core, to show which ones it makes.
  const calls: string[] = [];
  const config: typeof real = {
    ...real,
    userFile: () => {
      calls.push("user");
      return real.userFile();
    },
    projectFile: () => {
      calls.push("project");
      return real.projectFile();
    },
    replaceUserFile: (change) => {
      calls.push("replace");
      return real.replaceUserFile(change);
    },
  };
  const bytes = () => [
    readFileSync(userFile, "utf8"),
    project === undefined ? "" : readFileSync(projectFile, "utf8"),
  ];
  return { config, calls, bytes, userFile };
};

const board = async (disk: ReturnType<typeof files>) => {
  const fixture = startHost({ ports: await freeRange(1), config: disk.config });
  hosts.push(fixture);
  const { port, askId, token } = await fixture.ask();
  const socket = await openSocket(port, askId);
  sockets.push(socket);
  socket.send({ version, type: "connect", token });
  return { fixture, socket, port, askId, token };
};

const untilState = async (socket: BoardSocket) => {
  for (let message = await socket.next(); ; message = await socket.next()) {
    if ((message as { type?: string }).type === "state") return;
  }
};

type Settings = {
  keys: { keys?: { value?: unknown; from: string; writable: boolean; warnings?: unknown[] } };
};

describe("the user's keys reach a board", () => {
  test("a board connecting with keys in the user file hears the keys row before the board", async () => {
    const { socket } = await board(files({ keys: TOP }));
    const settings = (await socket.nextSettings()) as Settings;
    await untilState(socket);
    expect(socket.types.slice(0, 3)).toEqual(["settings", "board", "state"]);
    expect(validateBoardMessage("toPage", settings).ok).toBe(true);
    expect(settings.keys.keys).toEqual({ value: TOP, from: "user", writable: false });
  });

  test("again after a presentation write", async () => {
    const { socket } = await board(files({ keys: TOP }));
    await socket.nextSettings();
    await untilState(socket);
    socket.send({ version, type: "setting", key: "theme", value: "dark" });
    const again = (await socket.nextSettings()) as Settings & { write?: unknown };
    expect(again.write).toMatchObject({ key: "theme", outcome: "saved" });
    expect(again.keys.keys).toEqual({ value: TOP, from: "user", writable: false });
    expect(validateBoardMessage("toPage", again).ok).toBe(true);
  });

  test("keys edited between two boards reach the second, which hears them before its board", async () => {
    const disk = files({ keys: TOP });
    const { socket, port, askId, token } = await board(disk);
    expect(((await socket.nextSettings()) as Settings).keys.keys?.value).toEqual(TOP);
    await untilState(socket);
    const edited: KeyOverrides = { "move.bottom": ["Mod+Alt+ArrowDown"] };
    writeFileSync(disk.userFile, `${JSON.stringify({ version: "1.0", keys: edited })}\n`);
    socket.socket.close();
    await socket.closed();
    const second = await openSocket(port, askId);
    sockets.push(second);
    second.send({ version, type: "connect", token });
    expect(((await second.nextSettings()) as Settings).keys.keys?.value).toEqual(edited);
    await untilState(second);
    expect(second.types.slice(0, 2)).toEqual(["settings", "board"]);
  });

  test("with a project keys and a user keys, the settings message passes the board protocol and the project's never reaches it", async () => {
    const { socket } = await board(
      files({ keys: TOP }, { keys: { "move.up": ["Mod+Alt+ArrowDown"] } }),
    );
    const settings = (await socket.nextSettings()) as Settings;
    expect(validateBoardMessage("toPage", settings).ok).toBe(true);
    expect(settings.keys.keys).toEqual({
      value: TOP,
      from: "user",
      writable: false,
      warnings: [{ code: "project-keys-ignored", file: "project", key: "keys" }],
    });
  });

  test("a project keys alone, and a refused user keys, pass as well, with the defaults", async () => {
    for (const disk of [
      files({}, { keys: {} }),
      files({ keys: { "move.top": ["Alt+Shift+ArrowUp"] } }),
    ]) {
      const { socket } = await board(disk);
      const settings = (await socket.nextSettings()) as Settings;
      expect(validateBoardMessage("toPage", settings).ok).toBe(true);
      expect(settings.keys.keys?.from).toBe("default");
      expect(settings.keys.keys).not.toHaveProperty("value");
      expect(settings.keys.keys?.warnings).toHaveLength(1);
    }
  });
});

describe("a board writes no keys", () => {
  test.each([
    ["the PO's example", { "move.top": ["Mod+Alt+ArrowUp"] }],
    ["an empty object", {}],
    ["an action given Enter", { "edit.start": ["Enter"] }],
    ["a value of another shape", "Mod+Alt+ArrowUp"],
  ])(
    "a setting naming keys with %s is refused as a message, and no file is read or written",
    async (_name, value) => {
      const disk = files({ keys: TOP }, { theme: "dark" });
      const { socket, fixture } = await board(disk);
      await socket.nextSettings();
      await untilState(socket);
      const before = disk.bytes();
      const calls = [...disk.calls];
      socket.send({ version, type: "setting", key: "keys", value });
      expect(await socket.next()).toMatchObject({ version, type: "refused", reason: "message" });
      expect(disk.calls).toEqual(calls);
      expect(disk.bytes()).toEqual(before);
      expect(socket.settings).toEqual([]);
      expect(fixture.reported).toEqual([]);
    },
  );
});

describe("a settings view the board protocol refuses", () => {
  const token = "sssssssssssssssssssssA";
  const { version: _, type: __, ...opening } = settingsWithEveryKey;
  // A `keys` row with an `other`, built past ask-core, as a user and a project `keys` gave before
  // task 9.1: the protocol refuses the whole message.
  const refused = {
    ...opening,
    keys: {
      ...opening.keys,
      keys: { value: {}, from: "project", writable: false, other: { file: "user", value: TOP } },
    },
  } as unknown as typeof opening;

  const connect = async (core: HostCore) => {
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
    const socket = await openSocket(Number(link.port), PLAIN_CHOICE.askId);
    sockets.push(socket);
    socket.send({ version, type: "connect", token });
    return { socket, reported };
  };

  const asBuilt = (view: object) => ({ version, type: "settings", ...view });

  test("the host does not throw, keeps the connection, still sends the board, and each settings frame is the whole message as built", async () => {
    expect(validateBoardMessage("toPage", asBuilt(refused)).ok).toBe(false);
    const { socket, reported } = await connect({
      ...fakeHostCore().core,
      writeSetting: () => Promise.resolve({ key: "theme", outcome: "saved" }),
      boardSettingsView: (write) =>
        Promise.resolve(write === undefined ? refused : { ...refused, write }),
    });
    const first = await socket.nextSettings();
    await untilState(socket);
    expect(first).toEqual(asBuilt(refused));
    expect(socket.types.slice(0, 3)).toEqual(["settings", "board", "state"]);
    socket.send({ version, type: "setting", key: "theme", value: "dark" });
    const again = await socket.nextSettings();
    expect(again).toEqual(asBuilt({ ...refused, write: { key: "theme", outcome: "saved" } }));
    expect(socket.socket.readyState).toBe(WebSocket.OPEN);
    socket.send({ version, type: "draft", record: "not a record" });
    expect(await socket.next()).toMatchObject({ type: "refused", reason: "message" });
    expect(reported).toEqual([]);
  });

  test("a settings view whose read fails is reported, and the board still opens with no settings", async () => {
    const failure = new Error("the core failed");
    const { socket, reported } = await connect({
      ...fakeHostCore().core,
      boardSettingsView: () => Promise.reject(failure),
    });
    await untilState(socket);
    expect(socket.types.slice(0, 2)).toEqual(["board", "state"]);
    expect(socket.settings).toEqual([]);
    expect(reported).toEqual([failure]);
  });
});
