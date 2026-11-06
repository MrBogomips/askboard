import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { anchorOf, canAct, currentIn } from "./current.ts";
import { TREE_TOOLS } from "./keys.ts";

// The current row (spec, "Tree current row"; design decision 10): the one node the toolbar's row
// tools act on, set by a click or an arrow key and `undefined` when a Tree opens, apart from the
// focus.
const wbs = treeBoardDocument.items[0].props.items[0].props;
const empty: TreeProps = Object.freeze({ nodes: [] });

describe("the current row", () => {
  test("a Tree that has just opened has none, and every row tool is disabled", () => {
    expect(currentIn(wbs, undefined)).toBeUndefined();
    for (const { edit } of TREE_TOOLS) expect(canAct(edit, wbs, undefined)).toBe(false);
  });

  test("once a row is current, the tools are as `can` says for it", () => {
    expect(currentIn(wbs, "portal")).toBe("portal");
    expect(canAct("moveDown", wbs, "portal")).toBe(true);
    expect(canAct("remove", wbs, "portal")).toBe(true);
    expect(canAct("moveUp", wbs, "ux")).toBe(false);
  });

  test("an empty Tree may add its first node with no current row", () => {
    expect(canAct("addAfter", empty, undefined)).toBe(true);
    expect(canAct("remove", empty, undefined)).toBe(false);
  });

  test("a current row that left the value is no longer current", () => {
    expect(currentIn(wbs, "gone")).toBeUndefined();
    expect(canAct("remove", wbs, currentIn(wbs, "gone"))).toBe(false);
  });

  test("an add starts from the current row, whatever cell the focus is on", () => {
    expect(anchorOf({ focus: { nodeId: "ux", cell: 2 }, collapsed: new Set() }, "ux")).toEqual({
      nodeId: "ux",
      cell: 2,
    });
    expect(anchorOf({ focus: { nodeId: "ux" }, collapsed: new Set() }, "portal")).toEqual({
      nodeId: "portal",
    });
    expect(anchorOf({ focus: { nodeId: "ux" }, collapsed: new Set() }, undefined)).toBeUndefined();
  });
});
