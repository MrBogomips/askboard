import { describe, expect, test } from "bun:test";
import { isRecord, itemsIn, itemsOf, rendererOf, textOf } from "./layout.ts";

// What the layout chunks share (layouts, task 3.2): the items a layout holds, read from its props,
// and the renderer it needs. A layout that cannot read either throws, so its item fails.

const leaf = { type: "text-field", id: "a", props: {} };

describe("the items a layout holds", () => {
  test("itemsOf reads props.items as a list of {type, id, props}", () => {
    expect(itemsOf("Stack", "s", { items: [leaf] })).toEqual([leaf]);
    expect(itemsIn("Tabs", "t", [leaf, leaf])).toHaveLength(2);
  });

  test("props with no list, a list of anything else, or inherited names fail, naming the layout", () => {
    expect(() => itemsOf("Stack", "s", undefined)).toThrow('the Stack "s" holds no list of items');
    expect(() => itemsOf("Row", "r", {})).toThrow('the Row "r"');
    expect(() => itemsOf("Group", "g", { items: [1] })).toThrow('the Group "g"');
    expect(() => itemsOf("Group", "g", { items: [{ id: 3, type: "x" }] })).toThrow("holds no list");
    expect(() => itemsOf("Stack", "s", Object.create({ items: [leaf] }))).toThrow("holds no list");
    expect(() => itemsIn("Tabs", "t", "no")).toThrow('the Tabs "t"');
  });
});

describe("the renderer and the text", () => {
  test("rendererOf gives the shell's renderer and fails without one", () => {
    const render = () => null;
    expect(rendererOf("Stack", "s", render)).toBe(render);
    expect(() => rendererOf("Stack", "s", undefined)).toThrow(
      'the Stack "s" has no renderer for the items it holds',
    );
  });

  test("textOf reads an own string and nothing else", () => {
    expect(textOf({ title: "T" }, "title")).toBe("T");
    expect(textOf({ title: 3 }, "title")).toBeUndefined();
    expect(textOf({}, "title")).toBeUndefined();
    expect(textOf(Object.create({ title: "T" }), "title")).toBeUndefined();
    expect(textOf(null, "title")).toBeUndefined();
    expect(isRecord([])).toBe(false);
  });
});
