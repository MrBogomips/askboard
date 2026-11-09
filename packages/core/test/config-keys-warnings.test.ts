// The diagnostics of the user's keys' warning codes (keyboard-shortcuts-help, board protocol): the
// two codes the settings message gains have a line on stderr, the file and key and the action and
// combination JSON-quoted so no control character reaches the terminal. Task 9.1 produces them.

import { describe, expect, test } from "bun:test";
import type { SettingWarning } from "@askboard/contract";
import { configurationDiagnostics } from "../src/config/diagnostics.ts";
import type { SettingsInEffect } from "../src/config/settings.ts";

const settingsWith = (warnings: readonly SettingWarning[]): SettingsInEffect =>
  ({
    values: {},
    rows: {},
    files: { user: { path: "/u/config.json", status: "applied" }, project: { status: "absent" } },
    warnings,
  }) as unknown as SettingsInEffect;

describe("the warnings of the user's keys", () => {
  test("the project's keys are ignored", () => {
    expect(
      configurationDiagnostics(
        settingsWith([{ code: "project-keys-ignored", file: "project", key: "keys" }]),
      ),
    ).toEqual([
      "AskBoard: the project file sets keys, which AskBoard reads from the user file only: it is ignored.",
    ]);
  });

  test("keys not applied name the rule, the action, the combination and the other action", () => {
    const [line] = configurationDiagnostics(
      settingsWith([
        {
          code: "keys-not-applied",
          file: "user",
          key: "keys",
          rule: "conflict",
          action: "move.top",
          binding: "Alt+Shift+ArrowUp",
          with: "move.up",
        },
      ]),
    );
    expect(line).toBe(
      'AskBoard: /u/config.json does not apply its keys (every key is the default): rule conflict, action "move.top", combination "Alt+Shift+ArrowUp", with "move.up".',
    );
  });

  test("an action or combination with a control character is quoted as JSON", () => {
    const [line] = configurationDiagnostics(
      settingsWith([
        {
          code: "keys-not-applied",
          file: "user",
          key: "keys",
          rule: "action",
          action: "a\u001b[31mb",
        },
      ]),
    );
    expect(line).not.toContain("\u001b");
    expect(line).toContain("\\u001b");
    expect(line).not.toContain("combination");
    expect(line).not.toContain("with");
  });
});
