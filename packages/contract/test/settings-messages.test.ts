import { describe, expect, test } from "bun:test";
import {
  settingsSaved,
  settingsTranscript,
  settingsWithEveryKey,
  themeSetting,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_MESSAGES,
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_KEYS,
  SCHEMA_IDS,
} from "../src/index.ts";
import { type Checked, validateBoardMessage } from "../src/validate.ts";

// settings-languages, design decision 6 (contract spec: Settings messages on the board protocol):
// `settings` from board-host, before the board and after each write, and `setting` from the page,
// one presentation key with a value the configuration schema allows.
const version = BOARD_PROTOCOL_VERSION;
const pathsOf = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);
const toPage = (message: unknown) => validateBoardMessage("toPage", message);
const toHost = (message: unknown) => validateBoardMessage("toHost", message);

describe("the settings messages' place in the board protocol", () => {
  test("settings ends the host's list and setting the page's, each in SCHEMA_IDS", () => {
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toPage).at(-1)).toBe("settings");
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toHost).at(-1)).toBe("setting");
    expect(SCHEMA_IDS.settings).toBe("urn:askboard:board-protocol:settings");
    expect(SCHEMA_IDS.setting).toBe("urn:askboard:board-protocol:setting");
  });

  test("validateBoardMessage routes each by its direction", () => {
    expect(toPage(settingsWithEveryKey)).toEqual({
      ok: true,
      value: settingsWithEveryKey as never,
    });
    expect(toHost(themeSetting)).toEqual({ ok: true, value: themeSetting as never });
    expect(pathsOf(toHost(settingsWithEveryKey))).toEqual(["/type"]);
    expect(pathsOf(toPage(themeSetting))).toEqual(["/type"]);
  });
});

describe("setting, from the board page", () => {
  test.each([
    ["theme", "system"],
    ["theme", "light"],
    ["theme", "dark"],
    ["density", "compact"],
    ["density", "comfortable"],
    ["contextPlacement", "beside"],
    ["contextPlacement", "inline"],
  ])("%s %s validates", (key, value) => {
    const message = { version, type: "setting", key, value };
    expect(toHost(message)).toEqual({ ok: true, value: message as never });
  });

  test.each([
    ["editor", ["sh", "-c", "id"], "/key"],
    ["askingRule", "always", "/key"],
    ["snapshotFolder", "../shared", "/key"],
    ["defaultLanguage", "it-IT", "/key"],
    ["fontSize", 14, "/key"],
    ["theme", "sepia", "/value"],
    ["theme", { dark: true }, "/value"],
    ["density", "dark", "/value"],
    ["contextPlacement", "compact", "/value"],
  ])("%s %j fails, naming %s", (key, value, path) => {
    const result = toHost({ version, type: "setting", key, value });
    expect(result).toMatchObject({ ok: false, reason: "schema" });
    expect(pathsOf(result)).toContain(path);
  });

  test("a setting with an extra property, or without its value, fails", () => {
    expect(pathsOf(toHost({ ...themeSetting, file: "project" }))).toContain("/file");
    expect(pathsOf(toHost({ version, type: "setting", key: "theme" }))).toEqual(["/value"]);
  });
});

describe("settings, from board-host", () => {
  test("every key has its row, in the configuration's order", () => {
    expect(Object.keys(settingsWithEveryKey.keys)).toEqual([...CONFIGURATION_KEYS]);
  });

  test.each([
    ["absent", { status: "absent" }],
    ["absent without a path", { status: "absent", path: undefined }],
    [
      "not applied, unreadable",
      { status: "not-applied", problem: { code: "unreadable", error: "EISDIR" } },
    ],
    ["not applied, not JSON", { status: "not-applied", problem: { code: "not-json" } }],
    [
      "not applied, a newer major",
      { status: "not-applied", problem: { code: "version", pointer: "/version" } },
    ],
    [
      "not applied, a schema failure",
      { status: "not-applied", problem: { code: "schema", pointer: "/theme", keyword: "enum" } },
    ],
  ])("a project file %s validates", (_, file) => {
    const files = {
      ...settingsWithEveryKey.files,
      project: { path: ".askboard/config.json", ...file },
    };
    const message = JSON.parse(JSON.stringify({ ...settingsWithEveryKey, files }));
    expect(toPage(message).ok).toBe(true);
  });

  test.each([
    ["saved", { key: "density", outcome: "saved" }],
    ["refused", { key: "theme", outcome: "refused", reason: "set-by-project" }],
    [
      "failed",
      {
        key: "density",
        outcome: "failed",
        reason: "EACCES",
        path: "~/.config/askboard/config.json",
      },
    ],
    ["failed with no user file", { key: "density", outcome: "failed", reason: "no-user-file" }],
  ])("a write outcome %s validates", (_, write) => {
    expect(toPage({ ...settingsWithEveryKey, write }).ok).toBe(true);
  });

  test.each([
    [
      "a key missing",
      { keys: { ...settingsWithEveryKey.keys, editor: undefined } },
      "/keys/editor",
    ],
    [
      "a key it does not define",
      { keys: { ...settingsWithEveryKey.keys, fontSize: { from: "user", writable: false } } },
      "/keys/fontSize",
    ],
    [
      "a theme of sepia",
      {
        keys: {
          ...settingsWithEveryKey.keys,
          theme: { value: "sepia", from: "user", writable: true },
        },
      },
      "/keys/theme/value",
    ],
    [
      "a theme without its value",
      { keys: { ...settingsWithEveryKey.keys, theme: { from: "user", writable: true } } },
      "/keys/theme/value",
    ],
    [
      "an editor as one string",
      {
        keys: {
          ...settingsWithEveryKey.keys,
          editor: { value: "code -g", from: "user", writable: false },
        },
      },
      "/keys/editor/value",
    ],
    [
      "a source it does not define",
      {
        keys: {
          ...settingsWithEveryKey.keys,
          density: { value: "compact", from: "board", writable: true },
        },
      },
      "/keys/density/from",
    ],
    [
      "a file status it does not define",
      { files: { ...settingsWithEveryKey.files, user: { status: "broken" } } },
      "/files/user/status",
    ],
    [
      "a file not applied without its problem",
      { files: { ...settingsWithEveryKey.files, user: { status: "not-applied" } } },
      "/files/user/problem",
    ],
    [
      "a warning code it does not define",
      { warnings: [{ code: "odd", file: "user", key: "x" }] },
      "/warnings/0/code",
    ],
    ["a write of the editor", { write: { key: "editor", outcome: "saved" } }, "/write/key"],
    [
      "a write outcome it does not define",
      { write: { key: "theme", outcome: "maybe" } },
      "/write/outcome",
    ],
  ])("settings with %s fails, naming the place", (_, change, path) => {
    const message = JSON.parse(JSON.stringify({ ...settingsWithEveryKey, ...change }));
    expect(pathsOf(toPage(message))).toContain(path);
  });
});

describe("the settings transcript", () => {
  const kinds = settingsTranscript.steps.map((step) => `${step.from} ${step.message.type}`);

  test("connect, settings before the board, then a write and the settings it saved", () => {
    expect(kinds).toEqual([
      "page connect",
      "host settings",
      "host board",
      "host state",
      "page setting",
      "host settings",
    ]);
    expect(settingsTranscript.steps.at(-1)).toMatchObject({ message: settingsSaved });
    expect(settingsSaved.write).toEqual({ key: "theme", outcome: "saved" });
    expect(settingsSaved.keys.theme).toMatchObject({ value: "light", from: "user" });
  });

  test("every step validates in its direction", () => {
    for (const step of settingsTranscript.steps) {
      const result = validateBoardMessage(step.from === "page" ? "toHost" : "toPage", step.message);
      expect({ step: step.message.type, ok: result.ok }).toEqual({
        step: step.message.type,
        ok: true,
      });
    }
  });
});
