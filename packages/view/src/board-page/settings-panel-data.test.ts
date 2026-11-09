import { describe, expect, test } from "bun:test";
import type { Locale, SettingsMessage } from "@askboard/contract";
import {
  settingsKeysIgnored,
  settingsKeysNotApplied,
  settingsSaved,
  settingsWithEveryKey,
} from "@askboard/contract/fixtures";
import type { ViewPresentation } from "../view-protocol.ts";
import { languageIndicator, panelData } from "./settings-panel-data.ts";

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
      "../x in .askboard/config.json is outside the project: the default is used",
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
      ".askboard/config.json is not applied: it does not match the schema at /density",
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
      "fontSize is not a known key of ~/.config/askboard/config.json",
    ]);
  });
});

// The warnings of the user's keys (keyboard-shortcuts-help, board protocol): enough wording for the
// panel to show them; task 10.3 words them in full and adds the Keys row.
describe("the warnings of the user's keys", () => {
  test("the project's keys ignored, in each language", () => {
    expect(data(settingsKeysIgnored).warnings).toEqual(["The project's keys are ignored"]);
    expect(data(settingsKeysIgnored, "it-IT").warnings).toEqual([
      "I tasti del progetto sono ignorati",
    ]);
  });

  test("keys not applied, naming the rule, the action, the combination and the other action", () => {
    const message: SettingsMessage = {
      ...settingsWithEveryKey,
      warnings: settingsKeysNotApplied.keys.keys?.warnings ?? [],
    };
    expect(data(message).warnings).toEqual([
      "Your keys in ~/.config/askboard/config.json are not applied: conflict · move.top · Alt+Shift+ArrowUp · move.up",
    ]);
    const [italian] = data(message, "it-IT").warnings;
    expect(italian).toContain("conflict · move.top · Alt+Shift+ArrowUp · move.up");
    expect(italian).not.toContain("Your keys");
  });
});
