import { describe, expect, test } from "bun:test";
import { changedKeyActions, type Locale, type SettingsMessage } from "@askboard/contract";
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
    expect(controls[1]?.error).toBe("Could not save density to /home/u/config.json: EACCES");
    expect(controls[0]?.error).toBeUndefined();
    expect(data(settingsSaved).controls.map((control) => control.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
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
      source: ".askboard/config.json · defaultLanguage",
    });
    expect(rows[2]?.source).toBe("default · ~/.config/askboard/config.json · snapshotFolder");
    expect(rows[2]?.warnings).toEqual([
      `${isolate("../x")} in .askboard/config.json is outside the project: the default is used`,
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
      "also in ~/.config/askboard/config.json: none (not used)",
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
      `.askboard/config.json is not applied: it does not match the schema at ${isolate("/density")}`,
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
      "~/.config/askboard/config.json is not applied: it cannot be read (EACCES)",
    ]);
  });

  test("an unknown key is a warning of the panel", () => {
    expect(data().warnings).toEqual([
      `${isolate("fontSize")} is not a known key of ~/.config/askboard/config.json`,
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
      source: "~/.config/askboard/config.json · keys",
      note: "Applies to boards opened after a change",
      warnings: [],
    });
  });

  test("with the user's keys it counts the actions changed, in the user file", () => {
    const row = data(settingsWithKeys).keys;
    expect(row.value).toBe("3 actions changed");
    expect(row.source).toBe("~/.config/askboard/config.json · keys");
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
      `Your keys in ~/.config/askboard/config.json are not applied: ${isolate("Alt+Shift+ArrowUp")} for ${isolate("move.top")} is already the key of ${isolate("move.up")}`,
    ]);
    expect(shown.warnings).toEqual(data().warnings);
  });

  test("the project's keys ignored, as the fixture holds them: the warning is on the Keys row", () => {
    const shown = data(settingsKeysIgnored);
    expect(shown.keys.warnings).toEqual([
      "The project's keys in .askboard/config.json are ignored: only the user file sets them",
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
      "Your keys in ~/.config/askboard/config.json are not applied: a key does not pass the check",
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
  const HOSTILE = "a\nb\u001bc\u2028d\u202ee\u2069f";
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
          problem: { code: "schema", pointer: `/keys/${HOSTILE}`, keyword: "type" },
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
    const shown = data(hostile({ action: HOSTILE, binding: HOSTILE, with: HOSTILE }));
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
      warnings: [{ code: "unknown-key", file: "user", key: HOSTILE }],
    };
    const [warning] = data(message).warnings;
    expect(raw(withoutOurIsolates(warning ?? ""))).toBe(false);
  });

  test("a value holding {action} is shown as it is: slots are filled in one pass", () => {
    const [warning] = data(hostile({ action: "{action}", binding: "{binding}", with: "{with}" }))
      .keys.warnings;
    expect(warning).toBe(
      `Your keys in ~/.config/askboard/config.json are not applied: ${isolate("{binding}")} for ${isolate("{action}")} is already the key of ${isolate("{with}")}`,
    );
  });

  test("text in other scripts and emoji shows as it is", () => {
    const [warning] = data(hostile({ action: "mover\u{1f600}", binding: "k", with: "w" })).keys
      .warnings;
    expect(warning).toContain(isolate("mover\u{1f600}"));
  });
});
