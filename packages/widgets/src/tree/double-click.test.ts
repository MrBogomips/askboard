// The Tree's double click as the spec states it (view spec, "Double-click opens a cell's editor"):
// it opens the editor of the cell under it, which is the cell Enter opens, so the cells that take
// an edit are exactly where it works. The treegrid's handler (`widget.tsx`, `onDoubleClick`) calls
// `start` for the cell it finds and ignores a read-only Tree, an edit under way and a chevron.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { editableCells, entryKindAt } from "./entry.ts";

// The work breakdown of UJ-2: cell 0 is the name, then the three estimates.
const TREE = uj2ExpandedBoardDocument.items[0].props.items[0].props;
const MOST_LIKELY = 2;

describe("the Tree's double click opens the cell's editor, as Enter does", () => {
  test("an estimate: portal's most likely cell opens a number editor", () => {
    expect(TREE.columns?.[MOST_LIKELY - 1]?.field).toBe("mostLikely");
    expect(entryKindAt(TREE, "portal", MOST_LIKELY)).toBe("number");
  });

  test("a name: build's name opens the name editor", () => {
    expect(entryKindAt(TREE, "build", 0)).toBe("name");
  });

  test("a parent's estimate takes no editor, and so a double click opens nothing", () => {
    expect(entryKindAt(TREE, "build", MOST_LIKELY)).toBeUndefined();
    expect(editableCells(TREE, "build").split(",")).toEqual(["0"]);
  });

  test("a read-only Tree has no cell that takes an edit", () => {
    expect(editableCells(TREE, "portal", true)).toBe("");
    expect(editableCells(TREE, "portal")).not.toBe("");
  });
});
