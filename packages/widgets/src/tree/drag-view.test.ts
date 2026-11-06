import { describe, expect, test } from "bun:test";
import { say } from "@askboard/view/catalog";
import { DROP_AFTER, DROP_BEFORE, DROP_INTO, DROP_REFUSED } from "./classes.ts";

// The drag in the view (spec: Tree drag and drop, Tree drag handle, Tree drops that are refused,
// Tree drag has a keyboard path). The rendering and the pointer are checked in the browser
// (tree-drag scenarios); this holds what a unit can.
const source = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

describe("the handle", () => {
  test("is named 'Drag <name>', is no tab stop and no button, and shows only on a draggable row", async () => {
    const row = await source("./row.tsx");
    expect(row).toContain('text("tree.drag.handle", { name: row.node.label })');
    expect(row).toContain("{drag === undefined ? null : (");
    expect(row).toContain('role="img"');
    expect(row).toContain('data-grab=""');
    const handle = row.slice(row.indexOf("const DragHandle"), row.indexOf("// The row's look"));
    expect(handle).not.toContain("tabIndex");
    expect(handle).not.toContain("<button");
  });

  test("shows on the row's hover and on the current row", async () => {
    const classes = await source("./classes.ts");
    expect(classes).toContain("group-hover/row:opacity-100");
    expect(classes).toContain("group-aria-[current=true]/row:opacity-100");
  });

  test("the catalogue names it, and both tips, in both languages", () => {
    for (const language of ["en-US", "it-IT"] as const) {
      expect(say(language, "tree.drag.handle", { name: "Portal" })).toContain("Portal");
      expect(say(language, "tree.drag.depth", { max: 8 })).toContain("8");
      expect(say(language, "tree.drag.moved", { name: "Portal" })).toContain("Portal");
    }
    expect(say("en-US", "tree.drag.handle", { name: "Portal" })).toBe("Drag Portal");
    expect(say("en-US", "tree.drag.ownBranch")).toBe("Cannot drop inside its own branch");
    expect(say("en-US", "tree.drag.depth", { max: 8 })).toBe("At most 8 levels");
    expect(say("it-IT", "tree.drag.handle", { name: "Portale" })).toBe("Trascina Portale");
  });
});

describe("the drag", () => {
  test("a row is draggable by its handle and a drop target, only while the Tree is editable and its cell is not edited", async () => {
    const drag = await source("./drag.ts");
    expect(drag).toContain("dragHandle: grip");
    expect(drag).toContain("dropTargetForElements");
    const row = await source("./row.tsx");
    expect(row).toContain("enabled: drag !== undefined && editing === undefined");
    const widget = await source("./widget.tsx");
    expect(widget).toContain("disabled ? undefined : { treeId: itemId, events: dragEvents }");
    expect(widget).toContain("if (disabled && dragging !== undefined) setDragging(undefined)");
  });

  test("drops from another Tree are not taken", async () => {
    expect(await source("./drag.ts")).toContain("source.data.treeId === treeId");
  });

  test("Escape calls the drag off and the drop that follows is not made", async () => {
    const widget = await source("./widget.tsx");
    expect(widget).toContain('event.key !== "Escape"');
    expect(widget).toContain("if (!cancelled.current) dropRow(");
  });

  test("a drop goes through the normal change path, the focus following the node", async () => {
    const widget = await source("./widget.tsx");
    const body = widget.slice(
      widget.indexOf("const dropRow"),
      widget.indexOf("// The events every row"),
    );
    expect(body).toContain(
      "afterDrop(dropOn(value, nodeId, targetId, fraction), value, view, nodeId)",
    );
    expect(body).toContain('focus.moveFocusTo("grid")');
    expect(body).toContain("change(moved.value)");
  });

  test("a drag never touches the draft: it is view state", async () => {
    const widget = await source("./widget.tsx");
    expect(widget).toContain("useState<DragState>()");
  });
});

describe("the drop indicator", () => {
  test("is a line above, a line below, an outline for into and a destructive outline for a refusal", () => {
    expect(DROP_BEFORE).toContain("inset_0_2px_0_0_var(--primary)");
    expect(DROP_AFTER).toContain("inset_0_-2px_0_0_var(--primary)");
    expect(DROP_INTO).toContain("inset_2px_0_0_0_var(--primary)");
    expect(DROP_INTO).toContain("inset_-2px_0_0_0_var(--primary)");
    expect(DROP_REFUSED).toContain("var(--destructive-text)");
    expect(DROP_REFUSED).not.toContain("var(--primary)");
  });
});
