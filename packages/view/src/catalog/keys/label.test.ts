import { describe, expect, test } from "bun:test";
import { KEY_VOCABULARY, type KeyBinding } from "@askboard/contract";
import { t } from "../../strings/index.ts";
import { keyLabel, platformOf, useKeyPlatform } from "./label.ts";

// The key labels by platform (keyboard-shortcuts-help, design decision 4; spec: Key labels by
// platform), in the board's language.

const en = (key: Parameters<typeof t>[1]) => t("en-US", key);
const it = (key: Parameters<typeof t>[1]) => t("it-IT", key);
const b = (key: string, hold: KeyBinding["hold"] = "none"): KeyBinding => ({ key, hold });

describe("keyLabel on macOS", () => {
  test("modifiers as symbols, in the order Control, Option, Shift, Command", () => {
    expect(keyLabel(b("ArrowUp", "alt+shift"), "mac", en)).toBe("⌥⇧↑");
    expect(keyLabel(b("ArrowUp", "mod+shift"), "mac", en)).toBe("⇧⌘↑");
    expect(keyLabel(b("z", "mod"), "mac", en)).toBe("⌘Z");
    expect(keyLabel(b("ArrowDown", "shift"), "mac", en)).toBe("⇧↓");
  });

  test("Enter, Backspace and Delete as ↩ ⌫ ⌦", () => {
    expect(keyLabel(b("Enter", "alt+shift"), "mac", en)).toBe("⌥⇧↩");
    expect(keyLabel(b("Backspace", "alt+shift"), "mac", en)).toBe("⌥⇧⌫");
    expect(keyLabel(b("Delete"), "mac", en)).toBe("⌦");
  });

  test("the other keys by name", () => {
    expect(keyLabel(b("Home", "alt+shift"), "mac", en)).toBe("⌥⇧Home");
    expect(keyLabel(b("Escape"), "mac", en)).toBe("Esc");
    expect(keyLabel(b(" "), "mac", en)).toBe("Space");
  });
});

describe("keyLabel elsewhere", () => {
  test("names joined with +, Cmd or Ctrl as Ctrl", () => {
    expect(keyLabel(b("ArrowUp", "alt+shift"), "other", en)).toBe("Alt+Shift+↑");
    expect(keyLabel(b("ArrowUp", "mod+shift"), "other", en)).toBe("Ctrl+Shift+↑");
    expect(keyLabel(b("a", "mod"), "other", en)).toBe("Ctrl+A");
    expect(keyLabel(b("Enter", "alt+shift"), "other", en)).toBe("Alt+Shift+Enter");
    expect(keyLabel(b("Delete", "alt+shift"), "other", en)).toBe("Alt+Shift+Delete");
    expect(keyLabel(b("Backspace"), "other", en)).toBe("Backspace");
  });

  test("a printed character and a function key as they are", () => {
    expect(keyLabel(b("%", "char"), "other", en)).toBe("%");
    expect(keyLabel(b("?", "char"), "mac", en)).toBe("?");
    expect(keyLabel(b("F2"), "other", en)).toBe("F2");
  });

  test("arrows are arrows everywhere", () => {
    for (const platform of ["mac", "other"] as const) {
      expect(keyLabel(b("ArrowLeft"), platform, en)).toBe("←");
      expect(keyLabel(b("ArrowRight"), platform, en)).toBe("→");
    }
  });
});

describe("keyLabel of Mod with Alt (keyboard-shortcuts-help, decision 17)", () => {
  test("⌥⌘ on macOS, Ctrl+Alt elsewhere", () => {
    expect(keyLabel(b("ArrowUp", "mod+alt"), "mac", en)).toBe("⌥⌘↑");
    expect(keyLabel(b("Enter", "mod+alt"), "mac", en)).toBe("⌥⌘↩");
    expect(keyLabel(b("ArrowUp", "mod+alt"), "other", en)).toBe("Ctrl+Alt+↑");
    expect(keyLabel(b("Home", "mod+alt"), "other", en)).toBe("Ctrl+Alt+Home");
  });

  test("in Italian", () => {
    expect(keyLabel(b("ArrowDown", "mod+alt"), "mac", it)).toBe("⌥⌘↓");
    expect(keyLabel(b("ArrowDown", "mod+alt"), "other", it)).toBe("Ctrl+Alt+↓");
    expect(keyLabel(b("End", "mod+alt"), "other", it)).toBe("Ctrl+Alt+Fine");
    expect(keyLabel(b("Enter", "mod+alt"), "other", it)).toBe("Ctrl+Alt+Invio");
  });
});

describe("keyLabel in Italian", () => {
  test("the key names come from the strings", () => {
    expect(keyLabel(b("Delete", "alt+shift"), "other", it)).toBe("Alt+Maiusc+Canc");
    expect(keyLabel(b("Enter"), "other", it)).toBe("Invio");
    expect(keyLabel(b("End"), "other", it)).toBe("Fine");
    expect(keyLabel(b("Delete"), "mac", it)).toBe("⌦");
  });
});

describe("every vocabulary binding", () => {
  test("has a label on each platform in each language", () => {
    for (const { keys } of Object.values(KEY_VOCABULARY)) {
      for (const binding of keys) {
        for (const platform of ["mac", "other"] as const) {
          for (const say of [en, it]) {
            expect(keyLabel(binding, platform, say).length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe("platformOf", () => {
  test("macOS from the user agent", () => {
    expect(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605")).toBe(
      "mac",
    );
    expect(platformOf("Mozilla/5.0 (Mac OS X) Gecko")).toBe("mac");
  });

  test("anything else", () => {
    expect(platformOf("Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/128.0")).toBe(
      "other",
    );
    expect(platformOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
    expect(platformOf("")).toBe("other");
  });
});

describe("useKeyPlatform", () => {
  test("reads the user agent once: the test runtime is not macOS", () => {
    expect(useKeyPlatform()).toBe("other");
    expect(useKeyPlatform()).toBe("other");
  });
});
