import { describe, expect, test } from "bun:test";
import type { PresentationSetting } from "@askboard/contract";
import { coreWith, type FakeConfigOptions, fakeConfig } from "./fakes.ts";

// settings-languages, design decision 6 (core spec: Presentation keys read again when a board opens;
// Writing a presentation key): a board's settings re-read the user file's presentation keys over the
// first read, and a board writes one presentation key at a time into the user file, keeping every
// other key in its order.

const v = "1.0";
const USER_PATH = "~/.config/askboard/config.json";

const withConfig = (options: FakeConfigOptions) => {
  const fakes = fakeConfig(options);
  // The fake config's `calls` over the core's own.
  return { ...coreWith({ config: fakes.config, diagnose: fakes.diagnose }), ...fakes };
};

const asJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe("the settings for a board", () => {
  test("re-read the user file's presentation keys, and keep the first read for the rest", async () => {
    const { core, calls, setUser } = withConfig({
      user: { version: v, theme: "light", askingRule: "none" },
    });
    expect((await core.settings()).values.theme).toBe("light");
    setUser({ version: v, theme: "dark", askingRule: "always", fontSize: 14 });
    const board = await core.settingsForBoard();
    expect(board.rows.theme).toEqual({ value: "dark", from: "user", writable: true });
    expect(board.values.theme).toBe("dark");
    expect(board.rows.askingRule).toEqual({ value: "none", from: "user", writable: false });
    expect(board.values.askingRule).toBe("none");
    expect(board.warnings).toEqual([{ code: "unknown-key", file: "user", key: "fontSize" }]);
    expect((await core.settings()).values.theme).toBe("light");
    expect(calls.sort()).toEqual(["project", "user", "user"]);
  });

  test("the project's presentation keys come from the first read", async () => {
    const { core, calls } = withConfig({
      user: { version: v, density: "compact" },
      project: { version: v, density: "comfortable" },
    });
    const board = await core.settingsForBoard();
    expect(board.rows.density).toEqual({
      value: "comfortable",
      from: "project",
      writable: false,
      other: { file: "user", value: "compact" },
    });
    expect(calls.filter((call) => call === "project")).toEqual(["project"]);
  });

  test("a user file that fails its check now gives its presentation keys no value", async () => {
    const { core, setUser } = withConfig({
      user: { version: v, theme: "dark", askingRule: "always" },
    });
    await core.settings();
    setUser("{ not json");
    const board = await core.settingsForBoard();
    expect(board.rows.theme).toEqual({ value: "system", from: "default", writable: true });
    expect(board.files.user).toEqual({
      path: USER_PATH,
      status: "not-applied",
      problem: { code: "not-json" },
    });
    expect(board.values.askingRule).toBe("always");
  });

  test("a re-read that rejects counts as unreadable, and the error is reported", async () => {
    const fakes = fakeConfig({ user: { version: v, theme: "dark" } });
    const failure = new Error("disk gone");
    const { core, reported } = coreWith({
      config: {
        ...fakes.config,
        userFile: async () => {
          if (fakes.calls.push("user") > 1) throw failure;
          return {
            kind: "read",
            text: asJson({ version: v, theme: "dark" }),
            othersCanWrite: false,
          };
        },
      },
    });
    await core.settings();
    const board = await core.settingsForBoard();
    expect(reported).toEqual([failure]);
    expect(board.files.user).toMatchObject({ status: "not-applied", problem: { error: "EIO" } });
    expect(board.values.theme).toBe("system");
  });

  test("without the port, a board gets the defaults", async () => {
    const { core } = coreWith();
    expect(await core.settingsForBoard()).toEqual(await core.settings());
  });
});

describe("writing a presentation key", () => {
  const write = async (options: FakeConfigOptions, setting: PresentationSetting) => {
    const fakes = withConfig(options);
    const outcome = await fakes.core.writeSetting(setting);
    return { outcome, ...fakes };
  };

  test("keeps every other key, unknown ones included, in order, and adds the key last", async () => {
    const user = { version: v, editor: ["code", "{file}"], askingRule: "always", fontSize: 14 };
    const { outcome, written } = await write({ user }, { key: "density", value: "comfortable" });
    expect(outcome).toEqual({ key: "density", outcome: "saved" });
    expect(written).toEqual([asJson({ ...user, density: "comfortable" })]);
    expect(Object.keys(JSON.parse(written[0] ?? "{}"))).toEqual([
      "version",
      "editor",
      "askingRule",
      "fontSize",
      "density",
    ]);
  });

  test("changes an existing key in place", async () => {
    const user = { version: v, theme: "light", density: "compact" };
    const { written } = await write({ user }, { key: "theme", value: "dark" });
    expect(written).toEqual([asJson({ version: v, theme: "dark", density: "compact" })]);
  });

  test("a new file holds the version, then the key", async () => {
    const { outcome, written } = await write({}, { key: "theme", value: "dark" });
    expect(outcome).toEqual({ key: "theme", outcome: "saved" });
    expect(written).toEqual([`{\n  "version": "1.0",\n  "theme": "dark"\n}\n`]);
  });

  test("re-reads the file: a key added by hand since the first read is kept", async () => {
    const fakes = withConfig({ user: { version: v, theme: "light" } });
    await fakes.core.settings();
    fakes.setUser({ version: v, theme: "light", askingRule: "always" });
    await fakes.core.writeSetting({ key: "contextPlacement", value: "inline" });
    expect(fakes.written).toEqual([
      asJson({ version: v, theme: "light", askingRule: "always", contextPlacement: "inline" }),
    ]);
    expect((await fakes.core.settingsForBoard()).rows.contextPlacement).toEqual({
      value: "inline",
      from: "user",
      writable: true,
    });
  });

  test("a key the project sets is refused before the port is called", async () => {
    const { outcome, calls, written } = await write(
      { user: { version: v }, project: { version: v, theme: "light" } },
      { key: "theme", value: "dark" },
    );
    expect(outcome).toEqual({ key: "theme", outcome: "refused", reason: "set-by-project" });
    expect(calls).not.toContain("replace");
    expect(written).toEqual([]);
  });

  test.each([
    ["not JSON", "{ not json"],
    ["a newer major", asJson({ version: "2.0", theme: "light" })],
    ["a bad value", asJson({ version: v, theme: "sepia" })],
    ["no version", asJson({ theme: "light" })],
    ["an array", "[]"],
  ])(
    "a current file that fails its check (%s) is refused, naming it, and not written",
    async (_, user) => {
      const { outcome, calls, written } = await write({ user }, { key: "theme", value: "dark" });
      expect(outcome).toEqual({
        key: "theme",
        outcome: "refused",
        reason: "file-not-applied",
        path: USER_PATH,
      });
      expect(calls).toContain("replace");
      expect(written).toEqual([]);
    },
  );

  test("an unreadable current file is refused too", async () => {
    const { outcome, written } = await write(
      { user: { kind: "unreadable", code: "EACCES" } },
      { key: "density", value: "compact" },
    );
    expect(outcome).toMatchObject({ outcome: "refused", reason: "file-not-applied" });
    expect(written).toEqual([]);
  });

  test.each([
    ["editor", ["sh", "-c", "curl evil"]],
    ["askingRule", "always"],
    ["snapshotFolder", "out"],
    ["defaultLanguage", "it-IT"],
    ["fontSize", 14],
    ["version", "1.0"],
    ["__proto__", {}],
    ["theme", "sepia"],
    ["theme", { dark: true }],
    ["density", undefined],
  ])("%s %p is refused before the port is called", async (key, value) => {
    const { outcome, calls, written } = await write({ user: { version: v } }, {
      key,
      value,
    } as unknown as PresentationSetting);
    expect(outcome).toEqual({ key, outcome: "refused", reason: "invalid" } as never);
    expect(calls).not.toContain("replace");
    expect(written).toEqual([]);
  });

  test("a failed write names the error and the file", async () => {
    const { outcome } = await write(
      {
        user: { version: v },
        write: () => ({
          kind: "failed",
          path: "/home/u/.config/askboard/config.json",
          code: "EACCES",
        }),
      },
      { key: "density", value: "comfortable" },
    );
    expect(outcome).toEqual({
      key: "density",
      outcome: "failed",
      reason: "EACCES",
      path: USER_PATH,
    });
  });

  test("with no user file to write, the write fails without a path", async () => {
    const { outcome } = await write(
      {
        paths: { project: ".askboard/config.json" },
        write: () => ({ kind: "failed", code: "no-user-file" }),
      },
      { key: "theme", value: "dark" },
    );
    expect(outcome).toEqual({ key: "theme", outcome: "failed", reason: "no-user-file" });
  });

  test("a write that rejects fails, and the error is reported", async () => {
    const fakes = fakeConfig({ user: { version: v } });
    const failure = new Error("disk gone");
    const { core, reported } = coreWith({
      config: {
        ...fakes.config,
        replaceUserFile: async () => {
          throw failure;
        },
      },
    });
    expect(await core.writeSetting({ key: "theme", value: "dark" })).toEqual({
      key: "theme",
      outcome: "failed",
      reason: "EIO",
      path: USER_PATH,
    });
    expect(reported).toEqual([failure]);
  });

  test("without the port nothing is written, and the write fails", async () => {
    const { core } = coreWith();
    expect(await core.writeSetting({ key: "theme", value: "dark" })).toEqual({
      key: "theme",
      outcome: "failed",
      reason: "no-user-file",
    });
  });
});
