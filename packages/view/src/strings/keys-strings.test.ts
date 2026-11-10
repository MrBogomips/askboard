import { describe, expect, test } from "bun:test";
import { KEY_VOCABULARY, vocabularyLabel, WIDGET_TYPES } from "@askboard/contract";
import { STRINGS, t } from "./index.ts";
import { STRING_KEYS } from "./keys.ts";

// The key strings (keyboard-shortcuts-help, design decisions 4, 5 and 8; EXPERIENCE, Localization):
// every label of every key table and of every vocabulary action is a string key of both
// catalogues, with the key names, the panel's texts and the Ranking's new tools.

const KEYS: readonly string[] = STRING_KEYS;

const tableLabels = (): readonly string[] =>
  WIDGET_TYPES.flatMap((type) => (type.keys ?? []).map((entry) => `${type.type}: ${entry.label}`));

describe("the labels of the key tables", () => {
  test("there are labels to check", () => {
    expect(tableLabels().length).toBeGreaterThan(40);
  });

  test("every table label is a string key", () => {
    const missing = WIDGET_TYPES.flatMap((type) =>
      (type.keys ?? []).filter((entry) => !KEYS.includes(entry.label)).map((e) => e.label),
    );
    expect(missing).toEqual([]);
  });

  test("every vocabulary action has its label key", () => {
    const missing = Object.keys(KEY_VOCABULARY)
      .map(vocabularyLabel)
      .filter((label) => !KEYS.includes(label));
    expect(missing).toEqual([]);
  });

  test("both catalogues hold each of them", () => {
    const labels = [
      ...Object.keys(KEY_VOCABULARY).map(vocabularyLabel),
      ...WIDGET_TYPES.flatMap((type) => (type.keys ?? []).map((entry) => entry.label)),
    ];
    for (const label of labels) {
      expect(Object.hasOwn(STRINGS["en-US"], label)).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], label)).toBe(true);
    }
  });
});

describe("the other key strings", () => {
  const OTHERS = [
    "key.enter",
    "key.escape",
    "key.home",
    "key.end",
    "key.delete",
    "key.backspace",
    "key.space",
    "key.ctrl",
    "key.alt",
    "key.shift",
    "keys.button",
    "keys.panel.title",
    "keys.panel.close",
    "keys.group.cursor",
    "keys.group.selection",
    "keys.group.move",
    "keys.group.edit",
    "keys.group.other",
    "ranking.toTop",
    "ranking.toBottom",
    "ranking.selectNone",
    "ranking.selected",
  ] as const;

  test("are in both catalogues", () => {
    for (const key of OTHERS) {
      expect(KEYS).toContain(key);
      expect(Object.hasOwn(STRINGS["en-US"], key)).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key)).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "keys.panel.title", { widget: "Ranking" })).toBe("Ranking keys");
    expect(t("en-US", "ranking.toTop")).toBe("To top");
    expect(t("en-US", "ranking.toBottom")).toBe("To bottom");
    expect(t("en-US", "ranking.selectNone")).toBe("Select none");
    expect(t("en-US", "ranking.selected", { count: 3 })).toBe("3 selected");
    expect(t("en-US", "keys.action.move.up")).toBe("Move up");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "keys.panel.title", { widget: "Classifica" })).toBe("Tasti: Classifica");
    expect(t("it-IT", "ranking.toTop")).toBe("In cima");
    expect(t("it-IT", "ranking.selected", { count: 1 })).toBe("1 selezionata");
    expect(t("it-IT", "ranking.selected", { count: 3 })).toBe("3 selezionate");
    expect(t("it-IT", "key.enter")).toBe("Invio");
  });
});
