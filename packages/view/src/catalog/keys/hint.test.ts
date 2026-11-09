import { describe, expect, test } from "bun:test";
import {
  type KeyEntry,
  type KeyPress,
  ownEntry,
  RANKING_KEYS,
  vocabularyEntry,
  WIDGET_TYPES,
} from "@askboard/contract";
import { t } from "../../strings/index.ts";
import {
  groupOf,
  hintOf,
  KEYS_OPEN_ENTRY,
  labelText,
  opensKeysPanel,
  panelGroups,
} from "./hint.ts";

// The hint's and the panel's content from a key table (keyboard-shortcuts-help, design decision 5;
// specs: Keyboard shortcuts are discoverable, The keys panel, Key labels by platform), pure.

const en = (key: Parameters<typeof t>[1], slots?: Parameters<typeof t>[2]) =>
  t("en-US", key, slots);
const it = (key: Parameters<typeof t>[1], slots?: Parameters<typeof t>[2]) =>
  t("it-IT", key, slots);

const entryOf = (action: string): KeyEntry => {
  const ranking = WIDGET_TYPES.find((type) => type.type === "ranking");
  const found = (ranking?.keys ?? RANKING_KEYS).find((entry) => entry.action === action);
  if (found === undefined) throw new Error(`no ${action} in the Ranking's table`);
  return found;
};

describe("hintOf", () => {
  test("the name, the keys as the platform writes them and aria-keyshortcuts", () => {
    const hint = hintOf(entryOf("move.up"), "other", en);
    expect(hint).toEqual({
      name: "Move up",
      caps: ["Alt+Shift+↑"],
      aria: "Alt+Shift+ArrowUp",
    });
  });

  test("the same action on macOS: symbols, and the same aria-keyshortcuts", () => {
    const hint = hintOf(entryOf("move.up"), "mac", en);
    expect(hint?.caps).toEqual(["⌥⇧↑"]);
    expect(hint?.aria).toBe("Alt+Shift+ArrowUp");
  });

  test("two bindings, Cmd or Ctrl named as both in aria-keyshortcuts", () => {
    const hint = hintOf(entryOf("move.top"), "other", en);
    expect(hint?.name).toBe("To top");
    expect(hint?.caps).toEqual(["Alt+Shift+Home", "Ctrl+Shift+↑"]);
    expect(hint?.aria).toBe("Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp");
  });

  test("in Italian the name and the key names follow the board's language", () => {
    const hint = hintOf(entryOf("move.top"), "other", it);
    expect(hint?.name).toBe("In cima");
  });

  test("a keyless entry has no hint", () => {
    const keyless = ownEntry("probe.menu", "toolbar", [], "menu", {
      readOnly: false,
      label: "kanban.moveTo",
    });
    expect(hintOf(keyless, "other", en)).toBeUndefined();
  });

  test("the Keys button's entry is the vocabulary's `?`", () => {
    expect(KEYS_OPEN_ENTRY.keys).toEqual([{ key: "?", hold: "char" }]);
    expect(hintOf(KEYS_OPEN_ENTRY, "other", en)).toEqual({ name: "Keys", caps: ["?"], aria: "?" });
  });
});

describe("labelText", () => {
  test("a string key is looked up, anything else stays as it is", () => {
    expect(labelText(en, "ranking.keep")).toBe("Keep this order");
    expect(labelText(en, "no.such.key")).toBe("no.such.key");
  });
});

describe("groupOf", () => {
  test("the family of the action", () => {
    expect(groupOf("cursor.up")).toBe("cursor");
    expect(groupOf("toolbar.next")).toBe("cursor");
    expect(groupOf("select.extendUp")).toBe("selection");
    expect(groupOf("move.top")).toBe("move");
    expect(groupOf("edit.start")).toBe("edit");
    expect(groupOf("add.after")).toBe("edit");
    expect(groupOf("delete")).toBe("edit");
    expect(groupOf("undo")).toBe("edit");
    expect(groupOf("adjust.percent")).toBe("edit");
    expect(groupOf("keys.open")).toBe("other");
    expect(groupOf("ranking.keep")).toBe("other");
  });
});

// A probe table: a `readOnly` entry of each `shows`, a non-`readOnly` navigation entry, a keyless one.
const PROBE: readonly KeyEntry[] = [
  vocabularyEntry("cursor.down", "list", "navigation"),
  vocabularyEntry("select.toggle", "list", "pointer", { readOnly: true }),
  vocabularyEntry("move.up", "list", "tool"),
  vocabularyEntry("keys.open", "list", "panel"),
  vocabularyEntry("toolbar.next", "toolbar", "navigation", { readOnly: false }),
  ownEntry("probe.menu", "toolbar", [], "menu", { readOnly: true, label: "kanban.moveTo" }),
  ownEntry("probe.tool", "list", [{ key: "k", hold: "none" }], "tool", { readOnly: true }),
  ownEntry("probe.native", "list", [{ key: " ", hold: "none" }], "native", { readOnly: true }),
];

describe("panelGroups", () => {
  test("an item that takes edits lists every entry that has keys, by group in a fixed order", () => {
    const groups = panelGroups(PROBE, true, "other", en);
    expect(groups.map((group) => group.id)).toEqual(["cursor", "selection", "move", "other"]);
    expect(groups.map((group) => group.title)).toEqual([
      "Move around",
      "Select",
      "Move items",
      "Other",
    ]);
    const rows = groups.flatMap((group) => group.rows.map((row) => row.name));
    expect(rows).toEqual([
      "Go down",
      "Next tool",
      "Select",
      "Move up",
      "Show the keys",
      "keys.action.probe.tool",
      "keys.action.probe.native",
    ]);
  });

  test("a keyless entry is never listed", () => {
    const names = panelGroups(PROBE, true, "other", en).flatMap((g) => g.rows.map((r) => r.name));
    expect(names).not.toContain("Move to…");
  });

  test("an item that takes no edits lists only its readOnly entries with keys", () => {
    const groups = panelGroups(PROBE, false, "other", en);
    const rows = groups.flatMap((group) => group.rows.map((row) => row.name));
    expect(rows).toEqual([
      "Go down",
      "Select",
      "Show the keys",
      "keys.action.probe.tool",
      "keys.action.probe.native",
    ]);
    expect(rows).not.toContain("Move up");
    expect(rows).not.toContain("Next tool");
  });

  test("each row carries its caps for the platform", () => {
    const [cursor] = panelGroups(PROBE, true, "mac", en);
    expect(cursor?.rows[0]).toEqual({ name: "Go down", caps: ["↓"] });
  });

  test("a table with nothing to list gives no group", () => {
    expect(panelGroups([], true, "other", en)).toEqual([]);
  });
});

describe("opensKeysPanel (spec: The keys panel; EXPERIENCE: `?` outside text fields)", () => {
  const press = (fields: Partial<KeyPress> = {}): KeyPress => ({
    key: "?",
    hold: "none",
    composing: false,
    inText: false,
    ...fields,
  });

  test("`?` with or without Shift opens it", () => {
    expect(opensKeysPanel(press())).toBe(true);
    expect(opensKeysPanel(press({ hold: "shift" }))).toBe(true);
  });

  test("not in a text field, not while an input method composes, not with another modifier", () => {
    expect(opensKeysPanel(press({ inText: true }))).toBe(false);
    expect(opensKeysPanel(press({ composing: true }))).toBe(false);
    expect(opensKeysPanel(press({ hold: "mod" }))).toBe(false);
    expect(opensKeysPanel(press({ hold: "other" }))).toBe(false);
  });

  test("no other key does", () => {
    expect(opensKeysPanel(press({ key: "/" }))).toBe(false);
    expect(opensKeysPanel(press({ key: "Escape" }))).toBe(false);
  });
});
