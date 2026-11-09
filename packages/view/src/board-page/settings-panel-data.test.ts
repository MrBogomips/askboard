import { describe, expect, test } from "bun:test";
import {
  changedKeyActions,
  escapeFileText,
  type Locale,
  type SettingsMessage,
} from "@askboard/contract";
import {
  keyOverridesExample,
  settingsKeysIgnored,
  settingsKeysNotApplied,
  settingsSaved,
  settingsWithEveryKey,
  settingsWithKeys,
} from "@askboard/contract/fixtures";
import type { ViewPresentation } from "../view-protocol.ts";
import { languageIndicator, panelData } from "./settings-panel-data.ts";

// File text, as the panel shows it: between U+2068 and U+2069, which isolate it from the sentence.
const isolate = (text: string): string => `\u2068${text}\u2069`;

const presentation: ViewPresentation = {
  theme: "dark",
  density: "compact",
  contextPlacement: "inline",
  locked: ["contextPlacement"],
};
const data = (message: SettingsMessage = settingsWithEveryKey, language: Locale = "en-US") =>
  panelData(message, presentation, language, language);

describe("the language indicator", () => {
  test("names the language and its code, and the formats only when the locale differs", () => {
    expect(languageIndicator("en-US", "en-US")).toBe("English (en-US)");
    expect(languageIndicator("it-IT", "it-IT")).toBe("Italiano (it-IT)");
    expect(languageIndicator("en-US", "it-IT")).toBe("English (en-US) · formats it-IT");
    expect(languageIndicator("it-IT", "en-US")).toBe("Italiano (it-IT) · formati en-US");
  });
});

describe("the presentation controls", () => {
  test("hold the choices, the value in effect and the file and key that fix one", () => {
    const [theme, density, placement] = data().controls;
    expect(theme?.segments.map((segment) => segment.label)).toEqual(["System", "Light", "Dark"]);
    expect(theme?.value).toBe("dark");
    expect(theme?.fixedBy).toBeUndefined();
    expect(density?.segments.map((segment) => segment.label)).toEqual(["Compact", "Comfortable"]);
    expect(placement?.segments.map((segment) => segment.label)).toEqual(["Beside", "Inline"]);
    expect(placement?.fixedBy).toBe(".askboard/config.json · contextPlacement");
  });

  test("show a failed write under its own key with the path, and a saved one nowhere", () => {
    const failed: SettingsMessage = {
      ...settingsWithEveryKey,
      write: { key: "density", outcome: "failed", reason: "EACCES", path: "/home/u/config.json" },
    };
    const controls = data(failed).controls;
    expect(controls[1]?.error).toBe(
      `Could not save density to ${isolate("/home/u/config.json")}: EACCES`,
    );
    expect(controls[0]?.error).toBeUndefined();
    expect(data(settingsSaved).controls.map((control) => control.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  test("show a failed write that names no path with the user file's, between the isolates", () => {
    const failed: SettingsMessage = {
      ...settingsWithEveryKey,
      write: { key: "density", outcome: "failed", reason: "EACCES" },
    };
    expect(data(failed).controls[1]?.error).toBe(
      `Could not save density to ${isolate("~/.config/askboard/config.json")}: EACCES`,
    );
  });

  test("show a refused write without a path", () => {
    const refused: SettingsMessage = {
      ...settingsWithEveryKey,
      write: { key: "theme", outcome: "refused", reason: "file-not-applied" },
    };
    expect(data(refused).controls[0]?.error).toBe("theme was not saved: file-not-applied");
  });
});

describe("the behaviour rows", () => {
  test("show the value, its file and key, the other file's value and the warnings", () => {
    const rows = data().rows;
    expect(rows.map((row) => row.label)).toEqual([
      "Default language",
      "Asking rules",
      "Snapshot folder",
      "Editor",
    ]);
    expect(rows[0]).toMatchObject({
      value: "it-IT",
      source: `${isolate(".askboard/config.json")} · defaultLanguage`,
    });
    expect(rows[2]?.source).toBe(
      `default · ${isolate("~/.config/askboard/config.json")} · snapshotFolder`,
    );
    expect(rows[2]?.warnings).toEqual([
      `${isolate("../x")} in ${isolate(".askboard/config.json")} is outside the project: the default is used`,
    ]);
    expect(rows[3]?.value).toBe("code --goto {file}:{line}");
    expect(rows[3]?.warnings).toEqual(["The project's editor is ignored"]);
  });

  test("name the other file when both set a key", () => {
    const placement: SettingsMessage = {
      ...settingsWithEveryKey,
      keys: {
        ...settingsWithEveryKey.keys,
        askingRule: {
          value: "always",
          from: "project",
          writable: false,
          other: { file: "user", value: "none" },
        },
      },
    };
    expect(data(placement).rows[1]?.alsoIn).toBe(
      `also in ${isolate("~/.config/askboard/config.json")}: none (not used)`,
    );
  });

  test("say so when a key has no value", () => {
    const unset: SettingsMessage = {
      ...settingsWithEveryKey,
      keys: { ...settingsWithEveryKey.keys, editor: { from: "default", writable: false } },
    };
    expect(data(unset).rows[3]?.value).toBe("not set");
  });

  test("speak Italian in an Italian ask", () => {
    const italian = data(settingsWithEveryKey, "it-IT");
    expect(italian.title).toBe("Impostazioni");
    expect(italian.nextSession).toBe("Si applica dalla prossima sessione");
    expect(italian.rows[0]?.label).toBe("Lingua predefinita");
  });
});

describe("the files not applied and the warnings no row holds", () => {
  test("a file not applied shows once with its problem", () => {
    const broken: SettingsMessage = {
      ...settingsWithEveryKey,
      files: {
        ...settingsWithEveryKey.files,
        project: {
          path: ".askboard/config.json",
          status: "not-applied",
          problem: { code: "schema", pointer: "/density", keyword: "enum" },
        },
      },
    };
    expect(data(broken).notApplied).toEqual([
      `${isolate(".askboard/config.json")} is not applied: it does not match the schema at ${isolate("/density")}`,
    ]);
    expect(data().notApplied).toEqual([]);
  });

  test("an unreadable file names the system's error", () => {
    const unreadable: SettingsMessage = {
      ...settingsWithEveryKey,
      files: {
        ...settingsWithEveryKey.files,
        user: { status: "not-applied", problem: { code: "unreadable", error: "EACCES" } },
      },
    };
    expect(data(unreadable).notApplied).toEqual([
      `${isolate("~/.config/askboard/config.json")} is not applied: it cannot be read (EACCES)`,
    ]);
  });

  test("an unknown key is a warning of the panel", () => {
    expect(data().warnings).toEqual([
      `${isolate("fontSize")} is not a known key of ${isolate("~/.config/askboard/config.json")}`,
    ]);
  });
});

// The Keys row and the warnings of the user's keys (keyboard-shortcuts-help, task 10.3; design
// decision 19; view spec: The settings panel). The messages are the contract's fixtures exactly as
// they hold them: the warnings of a refused user file are on the `keys` row, the project's are
// among the message's own (review 8.6, S-27).
describe("the Keys row", () => {
  test("with no keys from the user it reads Default keys, its source and the note", () => {
    const row = data().keys;
    expect(row).toEqual({
      label: "Keys",
      value: "Default keys",
      source: `${isolate("~/.config/askboard/config.json")} · keys`,
      note: "Applies to boards opened after a change",
      warnings: [],
    });
  });

  test("with the user's keys it counts the actions changed, in the user file", () => {
    const row = data(settingsWithKeys).keys;
    expect(row.value).toBe("3 actions changed");
    expect(row.source).toBe(`${isolate("~/.config/askboard/config.json")} · keys`);
    expect(row.warnings).toEqual([]);
    expect(Object.keys(keyOverridesExample)).toHaveLength(3);
  });

  test("keys equal to the defaults read Default keys, as {} does (S-42)", () => {
    const withValue = (value: Record<string, readonly string[]>): SettingsMessage => ({
      ...settingsWithKeys,
      keys: { ...settingsWithKeys.keys, keys: { from: "user", writable: false, value } },
    });
    expect(data(withValue({})).keys.value).toBe("Default keys");
    const same = withValue({ "move.top": ["Mod+Shift+ArrowUp", "Alt+Shift+Home"] });
    expect(data(same).keys.value).toBe("Default keys");
    expect(data(same, "it-IT").keys.value).toBe("Tasti predefiniti");
  });

  test("the count is the actions that differ: move.top given one key alone reads 1 action changed", () => {
    const value = { "move.top": ["Mod+Alt+ArrowUp"], "select.none": ["Escape"] };
    const message: SettingsMessage = {
      ...settingsWithKeys,
      keys: { ...settingsWithKeys.keys, keys: { from: "user", writable: false, value } },
    };
    expect(changedKeyActions(value)).toEqual(["move.top"]);
    expect(data(message).keys.value).toBe("1 action changed");
    expect(data(settingsWithKeys).keys.value).toBe(
      `${changedKeyActions(keyOverridesExample).length} actions changed`,
    );
  });

  test("one action reads in the singular", () => {
    const one: SettingsMessage = {
      ...settingsWithKeys,
      keys: {
        ...settingsWithKeys.keys,
        keys: { from: "user", writable: false, value: { "move.top": [] } },
      },
    };
    expect(data(one).keys.value).toBe("1 action changed");
    expect(data(one, "it-IT").keys.value).toBe("1 azione cambiata");
  });

  test("in Italian, label, value and note follow the board's language", () => {
    const row = data(settingsWithKeys, "it-IT").keys;
    expect(row.label).toBe("Tasti");
    expect(row.value).toBe("3 azioni cambiate");
    expect(row.note).toBe("Si applica alle lavagne aperte dopo una modifica");
    expect(data(settingsWithEveryKey, "it-IT").keys.value).toBe("Tasti predefiniti");
  });

  test("keys is the panel's own row, not one of the behaviour rows", () => {
    expect(data(settingsWithKeys).rows.map((row) => row.key)).not.toContain("keys");
  });

  test("the keys not applied, as the fixture holds them: the warning is on the Keys row, worded by its rule", () => {
    const shown = data(settingsKeysNotApplied);
    expect(shown.keys.value).toBe("Default keys");
    expect(shown.keys.warnings).toEqual([
      `Your keys in ${isolate("~/.config/askboard/config.json")} are not applied: ${isolate("Alt+Shift+ArrowUp")} for ${isolate("move.top")} is already the key of ${isolate("move.up")}`,
    ]);
    expect(shown.warnings).toEqual(data().warnings);
  });

  test("the project's keys ignored, as the fixture holds them: the warning is on the Keys row", () => {
    const shown = data(settingsKeysIgnored);
    expect(shown.keys.warnings).toEqual([
      `The project's keys in ${isolate(".askboard/config.json")} are ignored: only the user file sets them`,
    ]);
    expect(shown.warnings).toEqual([]);
    expect(data(settingsKeysIgnored, "it-IT").keys.warnings[0]).toContain("sono ignorati");
  });

  test("the project's warning comes first, then the user's", () => {
    const both: SettingsMessage = {
      ...settingsKeysNotApplied,
      warnings: [...settingsWithEveryKey.warnings, ...settingsKeysIgnored.warnings],
    };
    const [first, second] = data(both).keys.warnings;
    expect(first).toContain("The project's keys");
    expect(second).toContain("Your keys");
  });

  test("each rule has its own wording, in each language", () => {
    const warn = (rule: string, fields: Record<string, string> = {}): SettingsMessage => ({
      ...settingsWithEveryKey,
      keys: {
        ...settingsWithEveryKey.keys,
        keys: {
          from: "default",
          writable: false,
          warnings: [{ code: "keys-not-applied", file: "user", key: "keys", rule, ...fields }],
        },
      } as SettingsMessage["keys"],
    });
    const wording = (message: SettingsMessage, language: Locale = "en-US") =>
      (data(message, language).keys.warnings[0] ?? "").split(": ").slice(1).join(": ");
    expect(wording(warn("action", { action: "nope" }))).toBe(
      `${isolate("nope")} is not an action that has keys`,
    );
    expect(wording(warn("native", { action: "a" }))).toBe(
      `the keys of ${isolate("a")} belong to the control and cannot change`,
    );
    expect(wording(warn("notation", { action: "a", binding: "Ctrl+x" }))).toBe(
      `${isolate("Ctrl+x")} for ${isolate("a")} is not a key combination`,
    );
    expect(wording(warn("hold", { action: "a", binding: "Alt+x" }))).toBe(
      `${isolate("Alt+x")} for ${isolate("a")} is not a key AskBoard can bind`,
    );
    expect(wording(warn("reserved", { action: "a", binding: "Tab" }))).toBe(
      `${isolate("Tab")} for ${isolate("a")} is reserved and cannot be used`,
    );
    expect(wording(warn("exit", { action: "edit.cancel" }))).toBe(
      `${isolate("edit.cancel")} must keep a key: it is how the user backs out`,
    );
    expect(wording(warn("conflict", { action: "a", binding: "Home", with: "b" }), "it-IT")).toBe(
      `${isolate("Home")} per ${isolate("a")} è già il tasto di ${isolate("b")}`,
    );
  });
});

describe("a warning of the user's keys that lacks its optional fields (security re-review 8.13, guard 2)", () => {
  const lacking = (fields: Record<string, unknown>): SettingsMessage =>
    ({
      ...settingsWithEveryKey,
      keys: {
        ...settingsWithEveryKey.keys,
        keys: {
          from: "default",
          writable: false,
          warnings: [{ code: "keys-not-applied", file: "user", key: "keys", ...fields }],
        },
      },
    }) as SettingsMessage;

  test("renders, with a generic problem, and never throws", () => {
    for (const fields of [
      {},
      { rule: "conflict" },
      { rule: "conflict", action: "move.top" },
      { rule: "conflict", action: "move.top", binding: "Home" },
      { rule: "notation", action: "move.top" },
      { rule: "action" },
      { rule: "exit" },
      { rule: "no-such-rule", action: "a", binding: "b", with: "c" },
    ]) {
      for (const language of ["en-US", "it-IT"] as const) {
        const [text] = data(lacking(fields), language).keys.warnings;
        expect(typeof text).toBe("string");
        expect(text).not.toContain("undefined");
        expect(text).not.toMatch(/\{[a-z]+\}/);
      }
    }
    expect(data(lacking({})).keys.warnings).toEqual([
      `Your keys in ${isolate("~/.config/askboard/config.json")} are not applied: a key does not pass the check`,
    ]);
  });

  test("a message with a warning of another code lacking its fields renders too", () => {
    const message: SettingsMessage = {
      ...settingsWithEveryKey,
      warnings: [{ code: "snapshot-folder-replaced", file: "project", key: "snapshotFolder" }],
    };
    expect(data(message).warnings[0]).toContain("is outside the project");
  });
});

describe("file text in the panel (view spec: File text in the panel; review 8.6, X-1)", () => {
  const hostilePath = "a\nb\u001bc\u2028d\u202ee\u2069f";
  // Whether a code point is one a file must not get out raw: C0 and C1 controls, the separators, the bidi controls.
  const raw = (text: string): boolean =>
    Array.from(text).some((point) => {
      const code = point.codePointAt(0) as number;
      return (
        code < 0x20 ||
        (code >= 0x7f && code <= 0x9f) ||
        code === 0x2028 ||
        code === 0x2029 ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      );
    });
  // Remove the isolates the panel adds, then no control may be left raw.
  const withoutOurIsolates = (text: string): string =>
    text.replaceAll("\u2068", "").replace(/\u2069/g, "");

  const hostile = (fields: Record<string, string>): SettingsMessage =>
    ({
      ...settingsWithEveryKey,
      files: {
        ...settingsWithEveryKey.files,
        user: {
          path: "~/.config/askboard/config.json",
          status: "not-applied",
          problem: { code: "schema", pointer: `/keys/${hostilePath}`, keyword: "type" },
        },
      },
      keys: {
        ...settingsWithEveryKey.keys,
        keys: {
          from: "default",
          writable: false,
          warnings: [
            {
              code: "keys-not-applied",
              file: "user",
              key: "keys",
              rule: "conflict",
              ...fields,
            },
          ],
        },
      },
    }) as SettingsMessage;

  test("a pointer, an action, a combination and the other action hold no control raw, each between an isolate pair", () => {
    const shown = data(hostile({ action: hostilePath, binding: hostilePath, with: hostilePath }));
    const [warning] = shown.keys.warnings;
    const [notice] = shown.notApplied;
    for (const text of [warning ?? "", notice ?? ""]) {
      expect(raw(withoutOurIsolates(text))).toBe(false);
    }
    const escaped = "a\\nb\\u001bc\\u2028d\\u202ee\\u2069f";
    expect(warning).toContain(isolate(escaped));
    expect((warning ?? "").split(isolate(escaped))).toHaveLength(4);
    expect(notice).toContain(isolate(`/keys/${escaped}`));
  });

  test("a file's own isolate close cannot end ours early: it is escaped", () => {
    const [warning] = data(hostile({ action: "x\u2069y", binding: "k", with: "w" })).keys.warnings;
    expect(warning).toContain(isolate("x\\u2069y"));
  });

  test("an unknown key and a replaced folder are file text too", () => {
    const message: SettingsMessage = {
      ...settingsWithEveryKey,
      warnings: [{ code: "unknown-key", file: "user", key: hostilePath }],
    };
    const [warning] = data(message).warnings;
    expect(raw(withoutOurIsolates(warning ?? ""))).toBe(false);
  });

  test("a value holding {action} is shown as it is: slots are filled in one pass", () => {
    const [warning] = data(hostile({ action: "{action}", binding: "{binding}", with: "{with}" }))
      .keys.warnings;
    expect(warning).toBe(
      `Your keys in ${isolate("~/.config/askboard/config.json")} are not applied: ${isolate("{binding}")} for ${isolate("{action}")} is already the key of ${isolate("{with}")}`,
    );
  });

  test("text in other scripts and emoji shows as it is", () => {
    const [warning] = data(hostile({ action: "mover\u{1f600}", binding: "k", with: "w" })).keys
      .warnings;
    expect(warning).toContain(isolate("mover\u{1f600}"));
  });
});

// File paths in the panel (task 10.11, review 10.5, X-7; view spec: The settings panel, scenario
// "File text in the panel"): a path is text a folder's name chose, so every sentence and source
// that names one shows it escaped and between one isolate pair, like any other file text.
describe("a file's path in the panel", () => {
  const hostilePath = (name: string): string => `/w/${name}\n\u202e\u2069/config.json`;
  const projectPath = hostilePath("project");
  const userPath = hostilePath("user");
  const shown = (path: string): string => isolate(escapeFileText(path));
  const SNAPSHOT = "../snap\n\u202e\u2069";
  const keyWarning = {
    code: "keys-not-applied",
    file: "user",
    key: "keys",
    rule: "conflict",
    action: "move.top",
    binding: "Alt+Shift+ArrowUp",
    with: "move.up",
  } as const;

  const hostile: SettingsMessage = {
    ...settingsWithEveryKey,
    keys: {
      ...settingsWithEveryKey.keys,
      keys: {
        from: "default",
        writable: false,
        warnings: [keyWarning, { code: "project-keys-ignored", file: "project", key: "keys" }],
      },
      askingRule: {
        value: "always",
        from: "project",
        writable: false,
        other: { file: "user", value: "none" },
      },
      defaultLanguage: {
        value: "it-IT",
        from: "user",
        writable: false,
        other: { file: "project", value: "en-US" },
      },
      snapshotFolder: {
        value: SNAPSHOT,
        from: "project",
        writable: false,
        other: { file: "user", value: ".askboard/snapshots" },
        warnings: [
          { code: "snapshot-folder-replaced", file: "project", key: "snapshotFolder", value: "x" },
        ],
      },
    },
    files: {
      user: { path: userPath, status: "applied" },
      project: {
        path: projectPath,
        status: "not-applied",
        problem: { code: "not-json", error: "Unexpected token" },
      },
    },
    warnings: [{ code: "unknown-key", file: "project", key: "fontSize" }],
    write: { key: "density", outcome: "failed", reason: "EACCES", path: userPath },
  };

  const strings = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : typeof value === "object" && value !== null
        ? Object.values(value).flatMap(strings)
        : [];

  test.each(["en-US", "it-IT"] as const)(
    "every sentence that names a path holds it escaped, in %s",
    (language) => {
      const panel = data(hostile, language);
      const all = strings(panel);
      for (const text of all) {
        expect(text).not.toMatch(/[\n\u202e]/);
        // Every isolate opened is closed, and the file's own U+2069 is escaped, so it ends none early.
        expect(text.split("\u2068").length).toBe(text.split("\u2069").length);
      }
      const holding = all.filter(
        (text) =>
          text.includes(escapeFileText(projectPath)) || text.includes(escapeFileText(userPath)),
      );
      expect(holding.length).toBeGreaterThanOrEqual(8);
      for (const text of holding) {
        const wrapped = text.includes(shown(projectPath)) || text.includes(shown(userPath));
        expect({ text, wrapped }).toEqual({ text, wrapped: true });
      }
    },
  );

  test("each slot names its path between one isolate pair", () => {
    const panel = data(hostile);
    expect(panel.keys.source).toBe(`${shown(userPath)} · keys`);
    expect(panel.keys.warnings.join("\n")).toContain(
      `Your keys in ${shown(userPath)} are not applied`,
    );
    expect(panel.keys.warnings.join("\n")).toContain(
      `The project's keys in ${shown(projectPath)} are ignored`,
    );
    expect(panel.notApplied[0]).toStartWith(`${shown(projectPath)} is not applied`);
    expect(panel.controls[1]?.error).toBe(`Could not save density to ${shown(userPath)}: EACCES`);
    const [language, asking, snapshot] = panel.rows;
    expect(asking?.source).toBe(`${shown(projectPath)} · askingRule`);
    expect(asking?.alsoIn).toBe(`also in ${shown(userPath)}: none (not used)`);
    expect(language?.alsoIn).toBe(`also in ${shown(projectPath)}: en-US (not used)`);
    expect(snapshot?.warnings[0]).toContain(`in ${shown(projectPath)} is outside the project`);
    expect(panel.warnings[0]).toContain(`of ${shown(projectPath)}`);
  });

  test("the default's source names the user file between the isolates too", () => {
    const row = data({
      ...hostile,
      keys: { ...hostile.keys, density: { from: "default", writable: true } },
    });
    expect(row.rows.every((each) => !/[\n\u202e]/.test(each.source))).toBe(true);
    const unset: SettingsMessage = {
      ...hostile,
      keys: { ...hostile.keys, snapshotFolder: { from: "default", writable: false } },
    };
    expect(data(unset).rows[2]?.source).toBe(`default · ${shown(userPath)} · snapshotFolder`);
  });

  test("the project's Snapshot folder is escaped and isolated, in its row and as the other file's value", () => {
    const [, , snapshot] = data(hostile).rows;
    expect(snapshot?.value).toBe(isolate(escapeFileText(SNAPSHOT)));
    const other: SettingsMessage = {
      ...hostile,
      keys: {
        ...hostile.keys,
        snapshotFolder: {
          value: ".askboard/snapshots",
          from: "user",
          writable: false,
          other: { file: "project", value: SNAPSHOT },
        },
      },
    };
    expect(data(other).rows[2]?.alsoIn).toBe(
      `also in ${shown(projectPath)}: ${isolate(escapeFileText(SNAPSHOT))} (not used)`,
    );
  });

  test("a path with none of them shows as today, between the isolates", () => {
    const plain = data({
      ...hostile,
      files: {
        user: { path: "/home/u/.config/askboard/config.json", status: "applied" },
        project: { path: ".askboard/config.json", status: "applied" },
      },
      write: undefined,
    });
    expect(plain.keys.source).toBe(`${isolate("/home/u/.config/askboard/config.json")} · keys`);
    expect(plain.rows[1]?.source).toBe(`${isolate(".askboard/config.json")} · askingRule`);
    expect(plain.notApplied).toEqual([]);
  });
});
