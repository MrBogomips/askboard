// The user's keys read again when a board opens (keyboard-shortcuts-help, task 9.2; design decision
// 19; core spec: Read once, on first use; Presentation keys read again when a board opens): a board
// of any running session opens with the user file's `keys` as they are now, checked as at first use,
// and the project's warning is the first read's. Task 9.1's rules hold at every read.

import { describe, expect, spyOn, test } from "bun:test";
import * as contract from "@askboard/contract";
import {
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_VERSION,
  KEY_VOCABULARY,
  type KeyOverrides,
  SETTING_ROW_WARNINGS_MAX,
  type SettingWarning,
} from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import { coreWith, type FakeFile, fakeConfig } from "./fakes.ts";

const version = CONFIGURATION_VERSION;
const TOP: KeyOverrides = { "move.top": ["Mod+Alt+ArrowUp"] };
const BOTTOM: KeyOverrides = { "move.bottom": ["Mod+Alt+ArrowDown"] };
const CONFLICT: KeyOverrides = { "move.top": ["Alt+Shift+ArrowUp"] };
const BAD = ["Ctrl+q", "Ctrl+w", "Ctrl+e", "Ctrl+r"];
const MANY: KeyOverrides = Object.fromEntries([
  ...Object.keys(KEY_VOCABULARY).map((action) => [action, BAD]),
  ...Array.from({ length: 64 - Object.keys(KEY_VOCABULARY).length }, (_, n) => [
    `probe.act${n}`,
    BAD,
  ]),
]);

const open = (options: { user?: FakeFile; project?: FakeFile }) => {
  const fakes = fakeConfig(options);
  return { ...coreWith({ config: fakes.config, diagnose: fakes.diagnose }), ...fakes };
};

const valid = async (core: { boardSettingsView(): Promise<object> }) => {
  const view = await core.boardSettingsView();
  const message = { version: BOARD_PROTOCOL_VERSION, type: "settings", ...view };
  expect(validateBoardMessage("toPage", message).ok).toBe(true);
};

describe("a board reads the user's keys again", () => {
  test("keys added to the user file between two boards reach the second", async () => {
    const { core, setUser } = open({ user: { version, theme: "dark" } });
    const first = await core.boardSettingsView();
    expect(first.keys.keys).toEqual({ from: "default", writable: false });
    setUser({ version, theme: "dark", keys: TOP });
    const second = await core.boardSettingsView();
    expect(second.keys.keys).toEqual({ value: TOP, from: "user", writable: false });
    await valid(core);
  });

  test("keys changed, or removed, between two boards, by this session or another", async () => {
    const { core, setUser } = open({ user: { version, keys: TOP } });
    expect((await core.boardSettingsView()).keys.keys?.value).toEqual(TOP);
    setUser({ version, keys: BOTTOM });
    expect((await core.boardSettingsView()).keys.keys?.value).toEqual(BOTTOM);
    setUser({ version });
    expect((await core.boardSettingsView()).keys.keys).toEqual({
      from: "default",
      writable: false,
    });
    const board = await core.settingsForBoard();
    expect(board.values.keys).toBeUndefined();
  });

  test("the first read's settings keep the keys they read", async () => {
    const { core, setUser } = open({ user: { version, keys: TOP } });
    expect((await core.settings()).rows.keys?.value).toEqual(TOP);
    setUser({ version, keys: BOTTOM });
    expect((await core.settingsForBoard()).values.keys).toEqual(BOTTOM);
    expect((await core.settings()).rows.keys?.value).toEqual(TOP);
  });

  test("the project's warning comes from the first read, and the project's keys are never in the row", async () => {
    const { core, setUser } = open({ user: { version }, project: { version, keys: TOP } });
    await core.settings();
    setUser({ version, keys: BOTTOM });
    const board = await core.settingsForBoard();
    expect(board.rows.keys).toEqual({
      value: BOTTOM,
      from: "user",
      writable: false,
      warnings: [{ code: "project-keys-ignored", file: "project", key: "keys" }],
    });
    setUser({ version });
    expect((await core.settingsForBoard()).rows.keys).toEqual({
      from: "default",
      writable: false,
      warnings: [{ code: "project-keys-ignored", file: "project", key: "keys" }],
    });
    await valid(core);
  });

  test("Keys refused at a later read (core spec): that board takes the defaults, its settings carry the warning, and stderr writes no new line", async () => {
    const { core, setUser, diagnosed } = open({ user: { version, keys: TOP } });
    await core.settings();
    expect(diagnosed).toHaveLength(0);
    setUser({ version, theme: "dark", keys: CONFLICT });
    const board = await core.settingsForBoard();
    expect(diagnosed).toHaveLength(0);
    expect(board.rows.keys).toEqual({
      from: "default",
      writable: false,
      warnings: [
        {
          code: "keys-not-applied",
          file: "user",
          key: "keys",
          rule: "conflict",
          action: "move.top",
          binding: "Alt+Shift+ArrowUp",
          with: "move.up",
        },
      ],
    });
    expect(board.values.keys).toBeUndefined();
    expect(board.rows.theme.value).toBe("dark");
    await valid(core);
  });

  test("a user file that fails its check at the second read gives the keys no value and no warning of theirs", async () => {
    const { core, setUser } = open({ user: { version, keys: TOP } });
    await core.settings();
    setUser({ version, keys: ["Mod+Alt+ArrowUp"] });
    const board = await core.settingsForBoard();
    expect(board.files.user.status).toBe("not-applied");
    expect(board.rows.keys).toEqual({ from: "default", writable: false });
    await valid(core);
  });
});

describe("task 9.1's rules hold at every read", () => {
  test("a keys the schema passed is checked at the second read; one it did not is never", async () => {
    const check = spyOn(contract, "keyOverridesProblems");
    try {
      const { core, setUser } = open({
        user: { version, keys: TOP },
        project: { version, keys: TOP },
      });
      await core.settings();
      expect(check).toHaveBeenCalledTimes(1);
      setUser({ version, keys: BOTTOM });
      await core.settingsForBoard();
      expect(check).toHaveBeenCalledTimes(2);
      setUser({ version, keys: { "move.top": "x" } });
      await core.settingsForBoard();
      setUser({ version, keys: [1] });
      await core.settingsForBoard();
      expect(check).toHaveBeenCalledTimes(2);
    } finally {
      check.mockRestore();
    }
  });

  test("at most eight warnings at the second read, the project's first, and the message passes", async () => {
    const { core, setUser } = open({
      user: { version, keys: TOP },
      project: { version, keys: {} },
    });
    await core.settings();
    setUser({ version, keys: MANY });
    const board = await core.settingsForBoard();
    const warnings = board.rows.keys?.warnings as readonly SettingWarning[];
    expect(warnings).toHaveLength(SETTING_ROW_WARNINGS_MAX);
    expect(warnings[0]?.code).toBe("project-keys-ignored");
    expect(board.rows.keys?.from).toBe("default");
    expect(board.rows.keys).not.toHaveProperty("value");
    await valid(core);
  });

  test("the second read writes nothing to stderr, which the first read did", async () => {
    const { core, setUser, diagnosed } = open({ user: { version, keys: CONFLICT } });
    await core.settings();
    expect(diagnosed).toHaveLength(1);
    setUser({ version, keys: MANY });
    await core.settingsForBoard();
    expect(diagnosed).toHaveLength(1);
  });
});
