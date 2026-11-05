import { describe, expect, test } from "bun:test";
import { coreWith, type FakeFile, fakeConfig } from "./fakes.ts";

// settings-languages, design decision 4 (core spec: An invalid file is never half-applied): a file
// that cannot be read, is not JSON, names another major or fails the schema contributes no key; the
// diagnostic names the file and the problem, never an editor value; an unknown key is a warning.

const v = "1.0";
const USER = "~/.config/askboard/config.json";
const PROJECT = ".askboard/config.json";

const read = async (user: FakeFile, project: FakeFile) => {
  const fakes = fakeConfig({ user, project });
  const { core, reported } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
  return { settings: await core.settings(), diagnosed: fakes.diagnosed, reported, core };
};

describe("a file that fails its check applies nothing", () => {
  test("one bad value voids the whole project file; the rule comes from the user file", async () => {
    const { settings, diagnosed } = await read(
      { version: v, askingRule: "with-references" },
      { version: v, askingRule: "always", theme: "sepia" },
    );
    expect(settings.values.askingRule).toBe("with-references");
    expect(settings.values.theme).toBe("system");
    expect(settings.files.project).toEqual({
      path: PROJECT,
      status: "not-applied",
      problem: { code: "schema", pointer: "/theme", keyword: "enum" },
    });
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain(PROJECT);
    expect(diagnosed[0]).toContain("/theme");
    expect(diagnosed[0]).toContain("enum");
  });

  test.each([
    ["not JSON", "{ theme: dark", { code: "not-json" }],
    [
      "of a newer major",
      { version: "2.0", theme: "dark" },
      { code: "version", pointer: "/version" },
    ],
    ["unreadable", { kind: "unreadable", code: "EISDIR" }, { code: "unreadable", error: "EISDIR" }],
  ] as const)("a user file %s applies no key", async (_, user, problem) => {
    const { settings, diagnosed } = await read(user as FakeFile, undefined);
    expect(settings.values.theme).toBe("system");
    expect(settings.rows.theme.from).toBe("default");
    expect(settings.files.user).toEqual({ path: USER, status: "not-applied", problem });
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain(USER);
    expect(diagnosed[0]).toContain(problem.code);
  });

  test("the diagnostic of a newer major names the version", async () => {
    const { diagnosed } = await read({ version: "2.0" }, undefined);
    expect(diagnosed[0]).toContain("version");
  });

  test("the diagnostic never holds an editor value", async () => {
    const secret = "curl evil.example";
    const editor = ["sh", "-c", secret, ...Array.from({ length: 32 }, () => "x")];
    const { settings, diagnosed } = await read(
      { version: v, editor },
      { version: v, editor: [secret, 7] },
    );
    expect(settings.files.user).toMatchObject({
      problem: { pointer: "/editor", keyword: "maxItems" },
    });
    expect(settings.files.project).toMatchObject({
      problem: { pointer: "/editor/1", keyword: "type" },
    });
    expect(diagnosed).toHaveLength(2);
    expect(diagnosed.join("\n")).not.toContain("curl");
  });

  test("a read that rejects counts as unreadable, and the error is reported", async () => {
    const failure = new Error("the adapter broke");
    const fakes = fakeConfig({ user: { version: v, theme: "dark" } });
    const config = { ...fakes.config, userFile: () => Promise.reject(failure) };
    const { core, reported } = coreWith({ config, diagnose: fakes.diagnose });
    const settings = await core.settings();
    expect(settings.files.user).toEqual({
      path: USER,
      status: "not-applied",
      problem: { code: "unreadable", error: "EIO" },
    });
    expect(settings.values.theme).toBe("system");
    expect(reported).toEqual([failure]);
  });
});

describe("an unknown key", () => {
  test("is a warning naming it, and the file still applies", async () => {
    const { settings, diagnosed } = await read(
      { version: v, theme: "dark", fontSize: 14 },
      undefined,
    );
    expect(settings.values.theme).toBe("dark");
    expect(settings.files.user.status).toBe("applied");
    expect(settings.warnings).toEqual([{ code: "unknown-key", file: "user", key: "fontSize" }]);
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain('"fontSize"');
    expect(diagnosed[0]).toContain(USER);
  });

  test("keys are capped at 256 characters and the warnings at 64, as the board protocol holds them", async () => {
    const many = Object.fromEntries(Array.from({ length: 70 }, (_, n) => [`k${n}`, n]));
    const long = "x".repeat(300);
    const { settings } = await read({ version: v, [long]: 1 }, { version: v, ...many });
    expect(settings.warnings).toHaveLength(64);
    expect(settings.warnings[0]).toEqual({ code: "unknown-key", file: "project", key: "k0" });
    expect(settings.warnings.every((warning) => warning.key.length <= 256)).toBe(true);
  });

  test("a control character in a key is escaped in the diagnostic", async () => {
    const { diagnosed } = await read({ version: v, "a\u001b[31mb": 1 }, undefined);
    expect(diagnosed[0]).not.toContain("\u001b");
    expect(diagnosed[0]).toContain("\\u001b");
  });
});

describe("diagnostics", () => {
  test("are written once per session, however often the settings are asked for", async () => {
    const { core, diagnosed } = await read("not json", "nor this");
    await core.settings();
    await core.settings();
    expect(diagnosed).toHaveLength(2);
  });

  test("a clean configuration writes none", async () => {
    const { diagnosed } = await read({ version: v, theme: "dark" }, { version: v });
    expect(diagnosed).toEqual([]);
  });
});
