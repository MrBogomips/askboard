// Every configuration diagnostic is one line and shows no file text raw (keyboard-shortcuts-help,
// task 8.12; design decision 19; core spec: File text on stderr is escaped; review 8.6, X-1 and
// X-2). A JSON pointer, a key, a value, an action and a combination come from a file, which an agent
// can write: each goes through `quoteFileText`, so no control character, line or paragraph
// separator or bidirectional control can split, colour or reorder a line of stderr.

import { describe, expect, test } from "bun:test";
import { CONFIGURATION_VERSION, quoteFileText, type SettingWarning } from "@askboard/contract";
import { configurationProblem } from "@askboard/contract/validate";
import { configurationDiagnostics } from "../src/config/diagnostics.ts";
import type { SettingsInEffect } from "../src/config/settings.ts";
import { coreWith, fakeConfig } from "./fakes.ts";

// ESC, CR, LF, U+0085, U+009B, U+2028 and U+202E, built from code points: a formatter writes the
// escape of U+2028 in a source file back as the raw character.
const HOSTILE = String.fromCodePoint(0x1b, 0x0d, 0x0a, 0x85, 0x9b, 0x2028, 0x202e);
const NAME = `k${HOSTILE}z`;

// What no line may hold raw: C0, DEL, C1, U+2028, U+2029, U+202A to U+202E, U+2066 to U+2069.
const isForbidden = (code: number): boolean =>
  code < 0x20 ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0x2028 ||
  code === 0x2029 ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069);

const forbiddenIn = (line: string): string[] =>
  Array.from(line)
    .map((point) => point.codePointAt(0) as number)
    .filter(isForbidden)
    .map((code) => `U+${code.toString(16).padStart(4, "0")}`);

const settingsWith = (warnings: readonly SettingWarning[]): SettingsInEffect =>
  ({
    values: {},
    rows: {},
    files: { user: { path: "/u/config.json", status: "applied" }, project: { status: "absent" } },
    warnings,
  }) as unknown as SettingsInEffect;

const lines = (warnings: readonly SettingWarning[]): string[] =>
  configurationDiagnostics(settingsWith(warnings));

const oneCleanLine = (given: readonly string[]): string => {
  expect(given).toHaveLength(1);
  const [line] = given as [string];
  expect(forbiddenIn(line)).toEqual([]);
  return line;
};

describe("a schema problem whose pointer holds a name from the file (X-1)", () => {
  const file = { version: CONFIGURATION_VERSION, keys: { [NAME]: 5 } };

  test("the pointer Ajv gives holds the name raw: the diagnostic must not", () => {
    const problem = configurationProblem(file);
    expect(problem?.code).toBe("schema");
    expect(problem?.pointer).toContain(NAME);
  });

  test("the project file is not applied, and its diagnostic is one line that quotes the pointer", async () => {
    const fakes = fakeConfig({ project: file });
    const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
    const settings = await core.settings();
    expect(settings.files.project).toMatchObject({ status: "not-applied" });
    expect(settings.rows.keys?.from ?? "default").toBe("default");
    const pointer = configurationProblem(file)?.pointer as string;
    const line = oneCleanLine(fakes.diagnosed);
    expect(line).toContain(`at ${quoteFileText(pointer)}`);
    expect(line).toContain("is not applied");
    expect(line).toEndWith("none of its keys count.");
  });

  test("the same in the user file", async () => {
    const fakes = fakeConfig({ user: file });
    const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
    await core.settings();
    const pointer = configurationProblem(file)?.pointer as string;
    expect(oneCleanLine(fakes.diagnosed)).toContain(`at ${quoteFileText(pointer)}`);
  });

  test('a pointer without a name, as before, is quoted too: at "/theme"', async () => {
    const fakes = fakeConfig({ project: { version: CONFIGURATION_VERSION, theme: "sepia" } });
    const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
    await core.settings();
    expect(oneCleanLine(fakes.diagnosed)).toContain('at "/theme" (enum)');
  });
});

describe("the other lines that quote file text (X-2)", () => {
  test("an unknown key", () => {
    const line = oneCleanLine(lines([{ code: "unknown-key", file: "user", key: NAME }]));
    expect(line).toContain(quoteFileText(NAME));
    expect(line).toContain("holds the unknown key");
  });

  test("an unknown key in a file that applies, through ask-core", async () => {
    const fakes = fakeConfig({ user: { version: CONFIGURATION_VERSION, [NAME]: 1 } });
    const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
    await core.settings();
    expect(oneCleanLine(fakes.diagnosed)).toContain(quoteFileText(NAME));
  });

  test("the Snapshot folder a project replaced", () => {
    const value = `../${HOSTILE}`;
    const line = oneCleanLine(
      lines([{ code: "snapshot-folder-replaced", file: "project", key: "snapshotFolder", value }]),
    );
    expect(line).toContain(`sets snapshotFolder to ${quoteFileText(value)}`);
  });

  test("keys not applied: the action, the combination and the other action", () => {
    const action = `a${HOSTILE}`;
    const binding = `b${HOSTILE}`;
    const other = `c${HOSTILE}`;
    const line = oneCleanLine(
      lines([
        {
          code: "keys-not-applied",
          file: "user",
          key: "keys",
          rule: "conflict",
          action,
          binding,
          with: other,
        },
      ]),
    );
    expect(line).toContain(`action ${quoteFileText(action)}`);
    expect(line).toContain(`combination ${quoteFileText(binding)}`);
    expect(line).toContain(`with ${quoteFileText(other)}`);
  });

  test("keys not applied with only an action", () => {
    const line = oneCleanLine(
      lines([
        { code: "keys-not-applied", file: "user", key: "keys", rule: "action", action: NAME },
      ]),
    );
    expect(line).toContain(`action ${quoteFileText(NAME)}`);
    expect(line).not.toContain("combination");
  });

  test("a bidirectional control and a paragraph separator in a key", () => {
    const key = String.fromCodePoint(0x2029, 0x2066, 0x2069, 0x061c, 0x7f);
    expect(oneCleanLine(lines([{ code: "unknown-key", file: "user", key }]))).toContain(
      quoteFileText(key),
    );
  });
});

describe("over every line given", () => {
  const warnings: SettingWarning[] = [
    { code: "unknown-key", file: "user", key: NAME },
    { code: "snapshot-folder-replaced", file: "project", key: "snapshotFolder", value: NAME },
    { code: "keys-not-applied", file: "user", key: "keys", rule: "action", action: NAME },
    { code: "project-editor-ignored", file: "project", key: "editor" },
    { code: "editor-file-writable-by-others", file: "user", key: "editor" },
    { code: "project-keys-ignored", file: "project", key: "keys" },
    {
      code: "keys-not-applied",
      file: "user",
      key: "keys",
      rule: "conflict",
      action: "move.top",
      binding: "Alt+Shift+ArrowUp",
      with: "move.up",
    },
    { code: "keys-not-applied", file: "user", key: "keys", rule: "action", action: "a\u001b[31mb" },
  ];

  test("no line holds a forbidden code point, and each warning is one line", () => {
    for (const warning of warnings) {
      const given = lines([warning]);
      expect(given).toHaveLength(1);
      expect({ code: warning.code, found: forbiddenIn(given[0] as string) }).toEqual({
        code: warning.code,
        found: [],
      });
    }
  });

  test("a file that fails, and every warning together, give lines with none", async () => {
    const fakes = fakeConfig({
      user: { version: CONFIGURATION_VERSION, keys: { [NAME]: 5 } },
      project: { version: CONFIGURATION_VERSION, keys: { [NAME]: 5 }, [NAME]: 1 },
    });
    const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
    await core.settings();
    expect(fakes.diagnosed).toHaveLength(2);
    for (const line of fakes.diagnosed) expect(forbiddenIn(line)).toEqual([]);
  });
});
