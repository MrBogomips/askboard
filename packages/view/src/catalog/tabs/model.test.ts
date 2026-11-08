import { describe, expect, test } from "bun:test";
import { needsCorrection, type Tab, tabsOf } from "./model.ts";

// View-and-widgets spec, A tab holding a field to correct (layouts, task 3.3): the tabs of the
// props, and the mark of a tab whose panel holds, at any depth, a field with an entry.

const field = (id: string) => ({ type: "number-field", id, props: {} });
const group = (id: string, ...items: unknown[]) => ({
  type: "group",
  id,
  props: { title: id, items },
});
const tab = (id: string, ...items: unknown[]) => ({ id, title: id.toUpperCase(), items });

describe("the tabs of a Tabs layout's props", () => {
  test("each has an ID, a title and its items", () => {
    const tabs = tabsOf("t", { tabs: [tab("a", field("x")), tab("b", field("y"))] });
    expect(tabs.map(({ id, title }) => [id, title])).toEqual([
      ["a", "A"],
      ["b", "B"],
    ]);
    expect(tabs[0]?.items.map(({ id }) => id)).toEqual(["x"]);
  });

  test("props with no tabs, or a tab with no ID, title or items, fail naming the Tabs", () => {
    expect(() => tabsOf("t", {})).toThrow('the Tabs layout "t" holds no tabs');
    expect(() => tabsOf("t", { tabs: [] })).toThrow("holds no tabs");
    expect(() => tabsOf("t", { tabs: [{ id: "a", items: [] }] })).toThrow("no ID or title");
    expect(() => tabsOf("t", { tabs: [{ id: "a", title: "A" }] })).toThrow(
      "holds no list of items",
    );
    expect(() => tabsOf("t", Object.create({ tabs: [tab("a")] }))).toThrow("holds no tabs");
  });
});

describe("the mark of a tab", () => {
  const panel = (...items: unknown[]) => tabsOf("t", { tabs: [tab("a", ...items)] })[0] as Tab;

  test("shows while the panel holds, at any depth, a field with an entry", () => {
    const deep = panel(group("g1", group("g2", field("x"))));
    expect(needsCorrection(deep, new Set(["x"]))).toBe(true);
    expect(needsCorrection(deep, new Set(["elsewhere"]))).toBe(false);
  });

  test("clears once the entry is corrected or cleared, and with no entries at all", () => {
    const flat = panel(field("x"));
    expect(needsCorrection(flat, new Set())).toBe(false);
    expect(needsCorrection(flat, undefined)).toBe(false);
  });
});
