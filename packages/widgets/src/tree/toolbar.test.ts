import { describe, expect, test } from "bun:test";
import { TREE_KEYS } from "@askboard/contract";
import { type Say, say as sayIn } from "@askboard/view/catalog";
import { COUNTER, TOOLS } from "./classes.ts";
import { NO_SELECTION } from "./model/selection.ts";
import { itemsOf, undoTitle } from "./toolbar-items.ts";

// Review F-16: the counter truncates before it overprints a tool, its idle text is "No changes"
// from the catalogue, and the move tools go into "More" when the row is crowded. The rendering is
// checked in the browser (tree-toolbar.browser.ts); this holds what a unit can.
const source = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

describe("the Tree toolbar's counter", () => {
  test("gives way: it may shrink and truncates, while the tools keep their width", () => {
    expect(COUNTER).toContain("min-w-0");
    expect(COUNTER).not.toContain("shrink-0");
    expect(TOOLS).toContain("shrink-0");
  });

  test("reads its words from the catalogue, never the old idle text", async () => {
    const toolbar = await source("./toolbar.tsx");
    expect(toolbar).toContain('"widget.noChanges"');
    expect(toolbar).toContain('"widget.yourChanges"');
    expect(toolbar).not.toContain("none yet");
    expect(toolbar).not.toContain("Your changes:");
  });

  test("offers the move tools in a More menu, measured by the overflow model", async () => {
    const toolbar = await source("./toolbar.tsx");
    expect(toolbar).toContain('"widget.more"');
    expect(toolbar).toContain("DropdownMenu");
    expect(toolbar).toContain("useCrowded");
    expect(await source("../shared/use-crowded.ts")).toContain("isCrowded");
    expect(await source("./toolbar-items.ts")).toContain("OVERFLOW_TOOLS");
  });
});

// Tree undo (tree-edit-undo design decisions 5 and 6): "Undo" is a permanent tool, and the key table's
// tool entries and the toolbar's items name each other.
const tools = (canUndo: boolean) => ({
  selection: NO_SELECTION,
  value: { nodes: [] },
  disabled: false,
  canUndo,
  onSelectAll: () => undefined,
  onSelectNone: () => undefined,
  onApply: () => undefined,
  onUndo: () => undefined,
});
const items = (canUndo: boolean) =>
  itemsOf(
    [],
    () => undefined,
    tools(canUndo) as never,
    () => undefined,
    ((key) => key) as Say,
    "other",
  );

describe("the Tree toolbar's Undo", () => {
  test("every tool entry of the key table has an item and every item an entry, with Undo shown when nothing can be undone", () => {
    const labels: string[] = items(false).map((item) => item.label);
    const entries = TREE_KEYS.filter((entry) => entry.shows === "tool").map((entry) => entry.label);
    expect([...labels].sort()).toEqual([...entries].sort());
    expect(labels).toContain("tree.tool.undo");
  });

  test("Undo is a permanent tool that never goes into More, disabled when there is nothing to undo", () => {
    const undo = (canUndo: boolean) => items(canUndo).find((item) => item.key === "undo");
    expect(undo(false)?.enabled).toBe(false);
    expect(undo(true)?.enabled).toBe(true);
    expect(undo(true)?.overflow).toBe(false);
    expect(undo(true)?.shortcut).toBe("Control+Z Meta+Z");
  });

  test("its tooltip names the key in the platform's form, in the board's language", () => {
    const say =
      (language: "en-US" | "it-IT"): Say =>
      (key, slots) =>
        sayIn(language, key, slots);
    expect(undoTitle("mac", say("en-US"))).toBe("Undo (⌘Z)");
    expect(undoTitle("other", say("en-US"))).toBe("Undo (Ctrl+Z)");
    expect(undoTitle("other", say("it-IT"))).toBe("Annulla (Ctrl+Z)");
  });
});
