import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_CLOSE_CODES, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { PLAIN_CHOICE, settingsWithEveryKey } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { type BoardHost, createBoardHost, type HostCore } from "../src/board-host/index.ts";
import { configFiles } from "../src/config-files.ts";
import { type FakeHostCore, fakeHostCore } from "./board-host/fake-core.ts";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  removeViews,
  startHost,
  type TestHost,
  writeView,
} from "./board-host/helpers.ts";

// Board-host spec, Settings sent to a board when it connects (settings-languages, task 5.1): a
// board that connects with its token hears the settings in effect before its board, as ask-core
// reads them now; a reconnect and a takeover hear them again, re-read; a refused connect hears
// none.

const version = BOARD_PROTOCOL_VERSION;
const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-settings-connect-")));

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

let count = 0;

/** A home and a project of their own, the user file setting `theme` and the project's rule. */
const files = (theme: string) => {
  count += 1;
  const home = join(root, `home-${count}`);
  const project = join(root, `project-${count}`);
  const userFolder = join(home, ".config", "askboard");
  mkdirSync(userFolder, { recursive: true });
  mkdirSync(join(project, ".askboard"), { recursive: true });
  const user = join(userFolder, "config.json");
  const writeUser = (value: string) =>
    writeFileSync(user, `${JSON.stringify({ version: "1.0", theme: value })}\n`);
  writeUser(theme);
  writeFileSync(
    join(project, ".askboard", "config.json"),
    `${JSON.stringify({ version: "1.0", askingRule: "with-references" })}\n`,
  );
  return { config: configFiles({ env: { HOME: home, CLAUDE_PROJECT_DIR: project } }), writeUser };
};

/** A host whose ask-core reads these files, holding an ask. */
const hostWith = async (disk: ReturnType<typeof files>) => {
  const fixture = startHost({ ports: await freeRange(1), config: disk.config });
  hosts.push(fixture);
  return { fixture, ...(await fixture.ask()) };
};

const board = async (port: number, askId: string) => {
  const socket = await openSocket(port, askId);
  sockets.push(socket);
  return socket;
};

// The opening's messages after the settings, up to the state.
const openedPast = async (socket: BoardSocket) => {
  for (let message = await socket.next(); ; message = await socket.next()) {
    if ((message as { type?: string }).type === "state") return;
  }
};

type Settings = { keys: Record<string, { value?: unknown; from: string }> };

describe("settings sent to a board when it connects", () => {
  test("a board opens with the user's theme, the settings before the board", async () => {
    const { port, askId, token } = await hostWith(files("dark"));
    const socket = await board(port, askId);
    socket.send({ version, type: "connect", token });
    const settings = (await socket.nextSettings()) as Settings;
    await openedPast(socket);
    expect(socket.types.slice(0, 3)).toEqual(["settings", "board", "state"]);
    expect(validateBoardMessage("toPage", settings).ok).toBe(true);
    expect(settings.keys.theme).toMatchObject({ value: "dark", from: "user" });
  });

  test("read-only rows name their file and key", async () => {
    const { port, askId, token } = await hostWith(files("dark"));
    const socket = await board(port, askId);
    socket.send({ version, type: "connect", token });
    const settings = (await socket.nextSettings()) as Settings;
    expect(settings.keys.askingRule).toMatchObject({ value: "with-references", from: "project" });
  });

  test("a reconnect hears the settings again, the user file read again", async () => {
    const disk = files("dark");
    const { port, askId, token } = await hostWith(disk);
    const first = await board(port, askId);
    first.send({ version, type: "connect", token });
    await first.nextSettings();
    await openedPast(first);
    first.socket.close();
    await first.closed();
    disk.writeUser("light");
    const again = await board(port, askId);
    again.send({ version, type: "connect", token });
    expect(((await again.nextSettings()) as Settings).keys.theme).toMatchObject({ value: "light" });
    await openedPast(again);
    expect(again.types.slice(0, 2)).toEqual(["settings", "board"]);
  });

  test("a tab that takes the board over hears the settings when it opens", async () => {
    const { port, askId, token } = await hostWith(files("dark"));
    const first = await board(port, askId);
    first.send({ version, type: "connect", token });
    await openedPast(first);
    const next = await board(port, askId);
    next.send({ version, type: "connect", token });
    expect(await first.next()).toMatchObject({ type: "moved" });
    first.send({ version, type: "draft", record: { items: {} } });
    expect(((await next.nextSettings()) as Settings).keys.theme).toMatchObject({ value: "dark" });
    await openedPast(next);
    expect(next.types.slice(0, 2)).toEqual(["settings", "board"]);
  });

  test("a connect with a bad token hears no settings", async () => {
    const { port, askId } = await hostWith(files("dark"));
    const socket = await board(port, askId);
    socket.send({ version, type: "connect", token: "not-the-token-of-this-board" });
    expect(await socket.next()).toMatchObject({ type: "refused", reason: "token" });
    expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
    expect(socket.types).toEqual(["refused"]);
  });
});

describe("an opening that waits for the settings", () => {
  const token = "sssssssssssssssssssssA";

  // A socket to a host around `core`, its connect sent, and what the host reported.
  const connected = async (core: HostCore) => {
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
    const socket = await board(Number(link.port), PLAIN_CHOICE.askId);
    socket.send({ version, type: "connect", token });
    return { socket, reported };
  };

  const { version: _, type: __, ...view } = settingsWithEveryKey;

  // A fake core whose settings arrive when the test says so.
  const held = () => {
    const fake = fakeHostCore();
    let give: (value: typeof view) => void = () => undefined;
    let fail: (error: unknown) => void = () => undefined;
    const core: HostCore = {
      ...fake.core,
      boardSettingsView: () =>
        new Promise((resolve, reject) => {
          give = resolve;
          fail = reject;
        }),
    };
    return {
      fake,
      core,
      give: (value = view) => give(value),
      fail: (error: unknown) => fail(error),
    };
  };

  const waitedFor = async (fake: FakeHostCore) => {
    for (let tries = 0; tries < 200 && fake.reports().length === 0; tries += 1) await Bun.sleep(5);
  };

  test("the board, the state and the rest wait for the settings", async () => {
    const pending = held();
    const { socket } = await connected(pending.core);
    await waitedFor(pending.fake);
    await Bun.sleep(20);
    expect(socket.types).toEqual([]);
    pending.give();
    expect(await socket.nextSettings()).toEqual(settingsWithEveryKey);
    await openedPast(socket);
    expect(socket.types.slice(0, 3)).toEqual(["settings", "board", "state"]);
  });

  test("settings that fail are reported, and the board opens without them", async () => {
    const pending = held();
    const { socket, reported } = await connected(pending.core);
    await waitedFor(pending.fake);
    const failure = new Error("the configuration failed");
    pending.fail(failure);
    await openedPast(socket);
    expect(socket.types.slice(0, 2)).toEqual(["board", "state"]);
    expect(reported).toEqual([failure]);
  });

  test("an ask discarded while the settings are read opens nothing", async () => {
    const pending = held();
    const { socket } = await connected(pending.core);
    await waitedFor(pending.fake);
    pending.fake.view = { askId: PLAIN_CHOICE.askId, state: "discarded" };
    pending.fake.emit({ type: "discarded", askId: PLAIN_CHOICE.askId, reason: "board-closed" });
    expect(await socket.next()).toMatchObject({ type: "discarded" });
    pending.give();
    await Bun.sleep(30);
    expect(socket.types).toEqual(["discarded"]);
  });

  test("a board that closed while the settings are read opens nothing", async () => {
    const pending = held();
    const { socket } = await connected(pending.core);
    await waitedFor(pending.fake);
    socket.socket.close();
    await socket.closed();
    pending.give();
    await Bun.sleep(30);
    expect(socket.types).toEqual([]);
  });

  test("without ask-core's settings part, the board opens at once, with no settings", async () => {
    const { socket } = await connected(fakeHostCore().core);
    await openedPast(socket);
    expect(socket.types.slice(0, 2)).toEqual(["board", "state"]);
  });
});
