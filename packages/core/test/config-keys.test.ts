// The user's keys in the settings in effect (keyboard-shortcuts-help, task 9.1; design decisions 16,
// 18 and 19; core spec: Key overrides come from the user file only, Key overrides are never
// half-applied, Merged key by key, File text on stderr is escaped; reviews 8.6, S-24, and 8.13, the
// security guards): `keys` is read from the user file only, checked only when the schema passed it,
// and applied whole or not at all, with at most eight warnings on its row and as many lines on stderr.

import { describe, expect, spyOn, test } from "bun:test";
import * as contract from "@askboard/contract";
import {
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_VERSION,
  KEY_VOCABULARY,
  type KeyOverrides,
  keyOverridesProblems,
  SETTING_ROW_WARNINGS_MAX,
  type SettingWarning,
} from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import { type FileStates, mergeSettings } from "../src/config/settings.ts";
import { settingsView } from "../src/config/view.ts";
import { coreWith, type FakeFile, fakeConfig } from "./fakes.ts";

const version = CONFIGURATION_VERSION;
const TOP: KeyOverrides = { "move.top": ["Mod+Alt+ArrowUp"] };
// The PO's example of a refused file: Alt+Shift+ArrowUp is move up's.
const CONFLICT: KeyOverrides = { "move.top": ["Alt+Shift+ArrowUp"] };

const read = async (user: FakeFile, project: FakeFile) => {
  const fakes = fakeConfig({ user, project });
  const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
  return { core, ...fakes, settings: await core.settings() };
};

const asMessage = (view: object) => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "settings",
  ...view,
});

// What the `settings` message built from the files says, and whether the protocol admits it.
const message = async (user: FakeFile, project: FakeFile) => {
  const { core } = await read(user, project);
  const view = await core.boardSettingsView();
  return { view, ok: validateBoardMessage("toPage", asMessage(view)).ok };
};

// 64 actions: each of the vocabulary's with four combinations that do not parse, the rest unknown.
const BAD = ["Ctrl+q", "Ctrl+w", "Ctrl+e", "Ctrl+r"];
const MANY: KeyOverrides = Object.fromEntries([
  ...Object.keys(KEY_VOCABULARY).map((action) => [action, BAD]),
  ...Array.from({ length: 64 - Object.keys(KEY_VOCABULARY).length }, (_, n) => [
    `probe.act${n}`,
    BAD,
  ]),
]);

const keysLines = (lines: readonly string[]): string[] =>
  lines.filter((line) => /sets keys|its keys/.test(line));

describe("keys come from the user file only", () => {
  test("a project keys is dropped with the warning, whatever the user file holds", async () => {
    for (const user of [undefined, { version, keys: TOP }, { version, keys: CONFLICT }]) {
      const { settings } = await read(user, { version, keys: TOP });
      expect(settings.rows.keys?.from).not.toBe("project");
      expect(settings.rows.keys?.warnings?.[0]).toEqual({
        code: "project-keys-ignored",
        file: "project",
        key: "keys",
      });
    }
  });

  test("a project keys alone gives the row default, with no value and no other", async () => {
    const { settings } = await read(undefined, { version, keys: TOP });
    expect(settings.rows.keys).toEqual({
      from: "default",
      writable: false,
      warnings: [{ code: "project-keys-ignored", file: "project", key: "keys" }],
    });
    expect(settings.values.keys).toBeUndefined();
  });

  test("an empty project keys is dropped as well", async () => {
    const { settings } = await read({ version, keys: TOP }, { version, keys: {} });
    expect(settings.rows.keys?.from).toBe("user");
    expect(settings.rows.keys?.value).toEqual(TOP);
    expect(settings.rows.keys).not.toHaveProperty("other");
  });

  test("the user's keys apply from the user file, not writable, with the project's warning when both set keys", async () => {
    const { settings } = await read({ version, keys: TOP }, { version, keys: {} });
    expect(settings.rows.keys).toEqual({
      value: TOP,
      from: "user",
      writable: false,
      warnings: [{ code: "project-keys-ignored", file: "project", key: "keys" }],
    });
  });

  test("the user's keys alone carry no warning", async () => {
    const { settings, diagnosed } = await read({ version, keys: TOP }, undefined);
    expect(settings.rows.keys).toEqual({ value: TOP, from: "user", writable: false });
    expect(diagnosed).toEqual([]);
  });

  test("no keys gives the row default with no value", async () => {
    const { settings } = await read({ version, theme: "dark" }, { version });
    expect(settings.rows.keys).toEqual({ from: "default", writable: false });
    expect(settings.values.keys).toBeUndefined();
  });

  test("the row's value is the very object the file's parse gave", () => {
    const keys = JSON.parse('{"move.top": ["Mod+Alt+ArrowUp"]}') as KeyOverrides;
    const states: FileStates = {
      user: { status: "applied", values: { keys }, unknown: [], othersCanWrite: false },
      project: { status: "absent" },
      paths: {},
    };
    const settings = mergeSettings(states);
    expect(settings.rows.keys?.value).toBe(keys);
    expect(settings.values.keys).toBe(keys);
  });
});

describe("keys are never half-applied", () => {
  test("one refused combination drops the whole keys with one warning, and the file's theme still applies", async () => {
    const { settings, diagnosed } = await read(
      { version, theme: "dark", keys: { ...CONFLICT, "select.none": ["Mod+Alt+End"] } },
      undefined,
    );
    expect(settings.values.theme).toBe("dark");
    expect(settings.rows.theme.from).toBe("user");
    expect(settings.rows.keys).toEqual({
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
    expect(settings.values.keys).toBeUndefined();
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain('rule conflict, action "move.top"');
    expect(diagnosed[0]).toContain('combination "Alt+Shift+ArrowUp"');
    expect(diagnosed[0]).toContain('with "move.up"');
  });

  test.each([
    ["action", { "nonesuch.act": ["Mod+Alt+ArrowUp"] }],
    ["notation", { "move.top": ["Ctrl+Up"] }],
    ["reserved", { "move.top": ["Mod+w"] }],
    ["hold", { "move.top": ["Alt+ArrowUp"] }],
    ["exit", { "edit.cancel": [] }],
  ] as const)(
    "a %s problem drops the whole keys, never the valid action beside it",
    async (rule, bad) => {
      const { settings } = await read(
        { version, keys: { "cursor.up": ["Mod+Alt+ArrowUp"], ...bad } },
        undefined,
      );
      expect(settings.rows.keys?.from).toBe("default");
      expect(settings.rows.keys).not.toHaveProperty("value");
      expect(settings.rows.keys).not.toHaveProperty("other");
      expect(settings.rows.keys?.warnings?.[0]?.rule).toBe(rule);
    },
  );

  test("a keys object with an own __proto__ property is checked, refused and dropped", async () => {
    const text = JSON.stringify({ version }).replace(
      "}",
      ',"keys":{"__proto__":["Mod+Alt+ArrowUp"]}}',
    );
    const { settings } = await read(text, undefined);
    expect(settings.rows.keys?.from).toBe("default");
    expect(settings.rows.keys?.warnings?.[0]).toMatchObject({
      code: "keys-not-applied",
      rule: "action",
      action: "__proto__",
    });
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  test("a keys of another shape voids the file, as any schema failure does, and the check is never reached", async () => {
    for (const keys of [
      ["Mod+Alt+ArrowUp"],
      "x",
      5,
      { "move.top": "Mod+Alt+ArrowUp" },
      { a: [5] },
    ]) {
      const { settings, diagnosed } = await read({ version, theme: "dark", keys }, undefined);
      expect(settings.files.user.status).toBe("not-applied");
      expect(settings.values.theme).toBe("system");
      expect(settings.rows.keys).toEqual({ from: "default", writable: false });
      expect(diagnosed).toHaveLength(1);
      expect(diagnosed[0]).toContain("is not applied");
      expect(diagnosed[0]).not.toContain("does not apply its keys");
    }
  });

  test("the check runs only on a keys the schema passed: never on a keys of another shape, never on a project's", async () => {
    const check = spyOn(contract, "keyOverridesProblems");
    try {
      for (const keys of [["x"], "x", 5, { "move.top": "x" }, { a: [5] }]) {
        await read({ version, keys }, { version, keys });
      }
      expect(check).not.toHaveBeenCalled();
      await read(undefined, { version, keys: TOP });
      expect(check).not.toHaveBeenCalled();
      await read({ version, keys: TOP }, undefined);
      expect(check).toHaveBeenCalledTimes(1);
    } finally {
      check.mockRestore();
    }
  });
});

describe("the warnings of keys are at most the row's bound (eight)", () => {
  test("a keys with over a hundred problems gives a row of the most warnings", async () => {
    expect(Object.keys(MANY)).toHaveLength(64);
    expect(keyOverridesProblems(MANY).length).toBeGreaterThan(100);
    const { settings } = await read({ version, keys: MANY }, undefined);
    expect(settings.rows.keys?.warnings).toHaveLength(SETTING_ROW_WARNINGS_MAX);
    expect(settings.rows.keys?.warnings?.every(({ code }) => code === "keys-not-applied")).toBe(
      true,
    );
    expect(settings.rows.keys?.from).toBe("default");
  });

  test("with the project's warning, the bound in all, that one first", async () => {
    const { settings } = await read({ version, keys: MANY }, { version, keys: {} });
    const warnings = settings.rows.keys?.warnings as readonly SettingWarning[];
    expect(warnings).toHaveLength(SETTING_ROW_WARNINGS_MAX);
    expect(warnings[0]?.code).toBe("project-keys-ignored");
    expect(warnings.slice(1).every(({ code }) => code === "keys-not-applied")).toBe(true);
  });

  test("the bound less one problem and the project's warning fill the row; the first of the user's are kept in order", async () => {
    const problems = keyOverridesProblems(MANY);
    const { settings } = await read({ version, keys: MANY }, { version, keys: {} });
    const kept = (settings.rows.keys?.warnings ?? []).slice(1);
    expect(kept.map(({ action }) => action)).toEqual(
      problems.slice(0, SETTING_ROW_WARNINGS_MAX - 1).map(({ action }) => action),
    );
  });

  test("stderr writes the row's warnings and no more: exactly the bound's lines about keys", async () => {
    const { diagnosed } = await read({ version, keys: MANY }, undefined);
    expect(keysLines(diagnosed)).toHaveLength(SETTING_ROW_WARNINGS_MAX);
    expect(diagnosed).toHaveLength(SETTING_ROW_WARNINGS_MAX);
  });

  test("with the project's warning too, the bound's lines in all, that one first, and no 'and more' line", async () => {
    const { diagnosed } = await read({ version, keys: MANY }, { version, keys: {} });
    expect(keysLines(diagnosed)).toHaveLength(SETTING_ROW_WARNINGS_MAX);
    expect(diagnosed).toHaveLength(SETTING_ROW_WARNINGS_MAX);
    expect(diagnosed[0]).toContain("sets keys");
    expect(diagnosed.some((line) => /more/.test(line))).toBe(false);
  });

  test("each field of a line passes through the quoting helper: a hostile action name is one clean line", async () => {
    const hostile = `a${String.fromCodePoint(0x0a, 0x85, 0x202e)}b`;
    const { diagnosed } = await read(
      { version, keys: { [hostile]: ["Mod+Alt+ArrowUp"] } },
      undefined,
    );
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).not.toMatch(/[\n\u0085‮]/u);
    expect(diagnosed[0]).toContain("\\u0085");
    expect(diagnosed[0]).toContain("\\u202e");
  });
});

describe("the settings message built from both files passes the board protocol", () => {
  test("a project keys alone", async () => {
    const { ok, view } = await message(undefined, { version, keys: TOP });
    expect(ok).toBe(true);
    expect(view.keys.keys?.from).toBe("default");
  });

  test("a user keys alone", async () => {
    const { ok, view } = await message({ version, keys: TOP }, undefined);
    expect(ok).toBe(true);
    expect(view.keys.keys).toEqual({ value: TOP, from: "user", writable: false });
  });

  test("both, with {} in the project", async () => {
    const { ok, view } = await message({ version, keys: TOP }, { version, keys: {} });
    expect(ok).toBe(true);
    expect(view.keys.keys?.value).toEqual(TOP);
  });

  test("a refused user keys", async () => {
    const { ok, view } = await message({ version, keys: CONFLICT }, undefined);
    expect(ok).toBe(true);
    expect(view.keys.keys?.warnings).toHaveLength(1);
  });

  test("the eight-warning case, with and without the project's keys", async () => {
    expect((await message({ version, keys: MANY }, undefined)).ok).toBe(true);
    expect((await message({ version, keys: MANY }, { version, keys: {} })).ok).toBe(true);
  });

  test("settingsView hands the row through as the other rows go", () => {
    const keys = JSON.parse('{"move.top": ["Mod+Alt+ArrowUp"]}') as KeyOverrides;
    const view = settingsView(
      mergeSettings({
        user: { status: "applied", values: { keys }, unknown: [], othersCanWrite: false },
        project: { status: "absent" },
        paths: {},
      }),
    );
    expect(view.keys.keys?.value).toBe(keys);
  });
});
