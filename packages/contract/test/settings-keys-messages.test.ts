// The user's keys on the board protocol's `settings` message (keyboard-shortcuts-help, task 8.5;
// contract spec: Settings messages on the board protocol; design decisions 12 and 19): an optional
// `keys` row from the user file or the default with no value, and two warning codes, one of them
// naming the rule, the action, the combination and the other action of a key override not applied.

import { describe, expect, test } from "bun:test";
import {
  keyboardKeysTranscript,
  keyOverridesExample,
  settingsKeysIgnored,
  settingsKeysNotApplied,
  settingsKeysSaved,
  settingsWithEveryKey,
  settingsWithKeys,
} from "../src/fixtures/index.ts";
import { BOARD_PROTOCOL_VERSION, type SettingsMessage } from "../src/index.ts";
import { type Checked, validateBoardMessage } from "../src/validate.ts";

const version = BOARD_PROTOCOL_VERSION;
const pathsOf = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);
const toPage = (message: unknown) => validateBoardMessage("toPage", message);
const toHost = (message: unknown) => validateBoardMessage("toHost", message);

const withRow = (row: unknown): unknown =>
  JSON.parse(
    JSON.stringify({ ...settingsWithEveryKey, keys: { ...settingsWithEveryKey.keys, keys: row } }),
  );

const withWarning = (warning: unknown): unknown =>
  JSON.parse(JSON.stringify({ ...settingsWithEveryKey, warnings: [warning] }));

describe("a keys row", () => {
  test("from the user file validates, and carries the overrides as its value", () => {
    expect(settingsWithKeys.keys.keys).toEqual({
      value: keyOverridesExample,
      from: "user",
      writable: false,
    });
    expect(toPage(settingsWithKeys).ok).toBe(true);
  });

  test("from the default, with no value and a keys-not-applied warning naming the conflict", () => {
    expect(settingsKeysNotApplied.keys.keys).toEqual({
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
    expect(toPage(settingsKeysNotApplied).ok).toBe(true);
  });

  test("with the project's keys ignored validates", () => {
    expect(settingsKeysIgnored.keys.keys).toMatchObject({ from: "default" });
    expect(settingsKeysIgnored.warnings).toContainEqual({
      code: "project-keys-ignored",
      file: "project",
      key: "keys",
    });
    expect(toPage(settingsKeysIgnored).ok).toBe(true);
  });

  test("a settings message of the previous minor, without the row, validates", () => {
    expect("keys" in settingsWithEveryKey.keys).toBe(false);
    expect(toPage(settingsWithEveryKey).ok).toBe(true);
  });

  test("an empty list of overrides, and a value with a removed action, validate", () => {
    expect(toPage(withRow({ value: {}, from: "user", writable: false })).ok).toBe(true);
    expect(toPage(withRow({ value: { "select.all": [] }, from: "user", writable: false })).ok).toBe(
      true,
    );
  });

  test.each([
    ["a list", { value: ["move.top"], from: "user", writable: false }, "/keys/keys/value"],
    ["a text", { value: "Mod+Alt+ArrowUp", from: "user", writable: false }, "/keys/keys/value"],
    [
      "a combination that is a number",
      { value: { a: [1] }, from: "user", writable: false },
      "/keys/keys/value",
    ],
    [
      "five combinations",
      { value: { a: ["a", "b", "c", "d", "e"] }, from: "user", writable: false },
      "/keys/keys/value",
    ],
    [
      "a combination of 33 characters",
      { value: { a: ["k".repeat(33)] }, from: "user", writable: false },
      "/keys/keys/value",
    ],
    [
      "65 actions",
      {
        value: Object.fromEntries(Array.from({ length: 65 }, (_, at) => [`a${at}`, ["F2"]])),
        from: "user",
        writable: false,
      },
      "/keys/keys/value",
    ],
    ["writable", { value: {}, from: "user", writable: true }, "/keys/keys/writable"],
    ["a project source", { value: {}, from: "project", writable: false }, "/keys/keys/from"],
  ])("a row with %s fails, naming the place", (_, row, path) => {
    expect(pathsOf(toPage(withRow(row))).some((found) => found.startsWith(path))).toBe(true);
  });
});

describe("the warnings of the user's keys", () => {
  const notApplied = {
    code: "keys-not-applied",
    file: "user",
    key: "keys",
    rule: "reserved",
    action: "keys.open",
    binding: "F1",
  };

  test("each rule of the check validates, with or without a combination and another action", () => {
    for (const rule of ["action", "native", "notation", "hold", "reserved", "conflict", "exit"]) {
      expect(toPage(withWarning({ ...notApplied, rule })).ok).toBe(true);
    }
    const { binding: _binding, ...bare } = notApplied;
    expect(toPage(withWarning({ ...bare, rule: "exit", action: "edit.cancel" })).ok).toBe(true);
  });

  test("it can sit in a row's warnings and among the message's", () => {
    const row = { from: "default", writable: false, warnings: [notApplied] };
    expect(toPage(withRow(row)).ok).toBe(true);
  });

  test.each([
    ["a rule outside the list", { ...notApplied, rule: "nope" }, "/warnings/0/rule"],
    [
      "an action over 64 characters",
      { ...notApplied, action: "a".repeat(65) },
      "/warnings/0/action",
    ],
    ["an empty action", { ...notApplied, action: "" }, "/warnings/0/action"],
    [
      "a binding over 32 characters",
      { ...notApplied, binding: "b".repeat(33) },
      "/warnings/0/binding",
    ],
    [
      "an other action over 64 characters",
      { ...notApplied, rule: "conflict", with: "w".repeat(65) },
      "/warnings/0/with",
    ],
    ["no rule", { ...notApplied, rule: undefined }, "/warnings/0/rule"],
    ["no action", { ...notApplied, action: undefined }, "/warnings/0/action"],
    [
      "a rule on another code",
      { code: "project-keys-ignored", file: "project", key: "keys", rule: "exit" },
      "/warnings/0/rule",
    ],
    [
      "an action on another code",
      { code: "unknown-key", file: "user", key: "x", action: "move.up" },
      "/warnings/0/action",
    ],
    ["a field it does not define", { ...notApplied, why: "x" }, "/warnings/0/why"],
  ])("a warning with %s fails, naming the place", (_, warning, path) => {
    expect(pathsOf(toPage(withWarning(warning)))).toContain(path);
  });

  test("the previous minor's codes still validate", () => {
    for (const code of [
      "unknown-key",
      "project-editor-ignored",
      "editor-file-writable-by-others",
      "snapshot-folder-replaced",
    ]) {
      expect(toPage(withWarning({ code, file: "user", key: "editor" })).ok).toBe(true);
    }
  });
});

describe("setting, from the board page, never names keys", () => {
  test("keys fails as the key, with or without a value the configuration allows", () => {
    for (const value of [keyOverridesExample, {}, "Mod+Alt+ArrowUp"]) {
      const result = toHost({ version, type: "setting", key: "keys", value });
      expect(result).toMatchObject({ ok: false, reason: "schema" });
      expect(pathsOf(result)).toContain("/key");
    }
  });
});

describe("the keys transcript", () => {
  const kinds = keyboardKeysTranscript.steps.map((step) => `${step.from} ${step.message.type}`);

  test("connect, the settings with the user's keys before the board, then a write and the settings after it", () => {
    expect(kinds).toEqual([
      "page connect",
      "host settings",
      "host board",
      "host state",
      "page setting",
      "host settings",
    ]);
    const last = keyboardKeysTranscript.steps.at(-1)?.message as SettingsMessage;
    expect(last).toEqual(settingsKeysSaved);
    expect(settingsKeysSaved.keys.keys).toEqual(settingsWithKeys.keys.keys);
    expect(settingsKeysSaved.write).toEqual({ key: "density", outcome: "saved" });
  });

  test("every step validates in its direction, and the versions are the constant", () => {
    for (const step of keyboardKeysTranscript.steps) {
      const result = validateBoardMessage(step.from === "page" ? "toHost" : "toPage", step.message);
      expect({ step: step.message.type, ok: result.ok }).toEqual({
        step: step.message.type,
        ok: true,
      });
      expect(step.message.version).toBe(version);
    }
  });
});
