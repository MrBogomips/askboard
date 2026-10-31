import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { chain, flat } from "../../../test/tree-model.ts";
import {
  focusAfterRemove,
  focusOn,
  navigate,
  openView,
  type TreeFocus,
  type TreeView,
  toggle,
  toolbarFocus,
  toolbarStop,
} from "./focus.ts";
import type { FocusMove } from "./keys.ts";

// The treegrid's focus and expansion (design decision 5; proposal, open questions 8, 9 and 10):
// view state, never draft. The focus is on a row or on one of its cells, 0 the name and then one
// per column; the arrow keys, Home and End move it as in a WAI-ARIA treegrid, and Right and Left
// also expand and collapse.
const fixture = treeBoardDocument.items[0].props.items[0].props;

const row = (nodeId: string): TreeFocus => ({ nodeId });
const cell = (nodeId: string, at: number): TreeFocus => ({ nodeId, cell: at });
const viewOf = (focus: TreeFocus | undefined, collapsed: string[] = []): TreeView => ({
  focus,
  collapsed: new Set(collapsed),
});
const stateOf = ({ focus, collapsed }: TreeView) => ({ focus, collapsed: [...collapsed].sort() });

describe("opening the treegrid", () => {
  test("focuses the first row, with nothing collapsed (open question 8)", () => {
    expect(stateOf(openView(fixture))).toEqual({ focus: row("design"), collapsed: [] });
  });

  test("focuses nothing in an empty Tree", () => {
    expect(stateOf(openView({ nodes: [] }))).toEqual({ focus: undefined, collapsed: [] });
  });
});

describe("the focus moves (WAI-ARIA treegrid)", () => {
  // [from, collapsed, key, to, collapsed after]
  test.each<[TreeFocus, string[], FocusMove, TreeFocus, string[]]>([
    [row("ux"), [], "down", row("architecture"), []],
    [row("ux"), [], "up", row("design"), []],
    [row("billing"), [], "home", row("design"), []],
    [row("ux"), [], "end", row("reporting"), []],
    [cell("ux", 2), [], "down", cell("architecture", 2), []],
    [cell("prototype", 1), [], "down", cell("build", 1), []],
    [cell("build", 3), [], "up", cell("prototype", 3), []],
    [cell("portal", 2), [], "home", cell("portal", 0), []],
    [cell("portal", 0), [], "end", cell("portal", 3), []],
    [row("design"), [], "right", cell("design", 0), []],
    [row("ux"), [], "right", cell("ux", 0), []],
    [row("build"), ["build"], "right", row("build"), []],
    [cell("ux", 0), [], "right", cell("ux", 1), []],
    [row("design"), [], "left", row("design"), ["design"]],
    [row("ux"), [], "left", row("design"), []],
    [row("reporting"), [], "left", row("build"), []],
    [cell("ux", 0), [], "left", row("ux"), []],
    [cell("ux", 2), [], "left", cell("ux", 1), []],
    [row("prototype"), ["build"], "down", row("build"), ["build"]],
    [row("design"), ["design"], "down", row("build"), ["design"]],
    [row("design"), ["build"], "end", row("build"), ["build"]],
  ])("from %p, with %p collapsed, %s gives %p", (from, collapsed, move, to, after) => {
    expect(stateOf(navigate(viewOf(from, collapsed), move, fixture))).toEqual({
      focus: to,
      collapsed: after,
    });
  });

  // [from, collapsed, key]: at an edge, the same view comes back.
  test.each<[TreeFocus, string[], FocusMove]>([
    [row("design"), [], "up"],
    [row("design"), [], "home"],
    [row("reporting"), [], "down"],
    [row("reporting"), [], "end"],
    [cell("design", 3), [], "up"],
    [cell("reporting", 1), [], "down"],
    [cell("ux", 3), [], "right"],
    [cell("ux", 0), [], "home"],
    [cell("ux", 3), [], "end"],
    [row("design"), ["design"], "left"],
    [row("build"), ["build"], "down"],
  ])("from %p, with %p collapsed, %s changes nothing", (from, collapsed, move) => {
    const view = viewOf(from, collapsed);
    expect(navigate(view, move, fixture)).toBe(view);
  });

  test("move among a single cell in a Tree without columns", () => {
    const bare: TreeProps = { nodes: flat(2) };
    const view = viewOf(cell("n0", 0));
    expect(navigate(view, "right", bare)).toBe(view);
    expect(navigate(view, "end", bare)).toBe(view);
    expect(stateOf(navigate(view, "down", bare)).focus).toEqual(cell("n1", 0));
  });

  test("change nothing with no focus, or a focus on a hidden or unknown node", () => {
    for (const view of [viewOf(undefined), viewOf(row("ux"), ["design"]), viewOf(row("x"))]) {
      for (const move of ["up", "down", "left", "right", "home", "end"] as const) {
        expect(navigate(view, move, fixture)).toBe(view);
      }
    }
  });

  test("give frozen views, and leave their inputs untouched", () => {
    const view = viewOf(row("design"));
    const next = navigate(view, "left", fixture);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.focus)).toBe(true);
    expect([...view.collapsed]).toEqual([]);
    expect(Object.isFrozen(view.focus)).toBe(false);
    expect(Object.isFrozen(navigate(view, "down", fixture).focus)).toBe(true);
  });
});

describe("a click on a chevron", () => {
  test("collapses an open node and expands a closed one", () => {
    expect(stateOf(toggle(viewOf(row("ux")), "build", fixture))).toEqual({
      focus: row("ux"),
      collapsed: ["build"],
    });
    expect(stateOf(toggle(viewOf(row("ux"), ["build"]), "build", fixture)).collapsed).toEqual([]);
  });

  test("moves a focus it hides to the collapsed node, in the same column", () => {
    expect(stateOf(toggle(viewOf(cell("architecture", 2)), "design", fixture))).toEqual({
      focus: cell("design", 2),
      collapsed: ["design"],
    });
    const nested = viewOf(row("n3"));
    expect(stateOf(toggle(nested, "n1", { nodes: chain(3) })).focus).toEqual(row("n1"));
  });

  test("changes nothing on a leaf or an unknown node", () => {
    const view = viewOf(row("ux"));
    expect(toggle(view, "ux", fixture)).toBe(view);
    expect(toggle(view, "nowhere", fixture)).toBe(view);
  });
});

describe("focusing a node, as a move, an add or an indent leaves it", () => {
  test("focuses it and expands its ancestors, the node itself and others staying as they are", () => {
    expect(stateOf(focusOn(viewOf(row("ux"), ["build", "design"]), fixture, "billing"))).toEqual({
      focus: row("billing"),
      collapsed: ["design"],
    });
    expect(stateOf(focusOn(viewOf(row("ux"), ["build"]), fixture, "build"))).toEqual({
      focus: row("build"),
      collapsed: ["build"],
    });
    const deep = focusOn(viewOf(row("n1"), ["n1", "n2", "x"]), { nodes: chain(4) }, "n4", 0);
    expect(stateOf(deep)).toEqual({ focus: cell("n4", 0), collapsed: ["x"] });
  });

  test("changes nothing for an unknown node", () => {
    const view = viewOf(row("ux"));
    expect(focusOn(view, fixture, "nowhere")).toBe(view);
  });
});

describe("the focus after a delete", () => {
  // [deleted, focus after]: the next sibling, else the previous one, else the parent.
  test.each<[string, TreeFocus]>([
    ["reporting", row("billing")],
    ["portal", row("billing")],
    ["billing", row("reporting")],
    ["design", row("build")],
    ["build", row("design")],
  ])("deleting %s focuses %p", (nodeId, focus) => {
    expect(focusAfterRemove(viewOf(row(nodeId)), fixture, nodeId).focus).toEqual(focus);
  });

  test("goes to the parent after its only child, and to nothing after the last node", () => {
    expect(focusAfterRemove(viewOf(row("n2")), { nodes: chain(2) }, "n2").focus).toEqual(row("n1"));
    expect(focusAfterRemove(viewOf(row("n0")), { nodes: flat(1) }, "n0").focus).toBeUndefined();
  });

  test("keeps the column", () => {
    expect(focusAfterRemove(viewOf(cell("reporting", 2)), fixture, "reporting").focus).toEqual(
      cell("billing", 2),
    );
  });

  test("forgets the removed branch's collapsed nodes", () => {
    const view = viewOf(row("design"), ["design", "build"]);
    expect(stateOf(focusAfterRemove(view, fixture, "design")).collapsed).toEqual(["build"]);
  });

  test("changes nothing for an unknown node", () => {
    const view = viewOf(row("ux"));
    expect(focusAfterRemove(view, fixture, "nowhere")).toBe(view);
  });
});

describe("the toolbar's roving focus (open question 10)", () => {
  // Add node, Add child, Move up (disabled), Move down, Indent (disabled), Outdent, Delete.
  const enabled = [true, true, false, true, false, true, true];

  test.each<[number, "previous" | "next" | "first" | "last", number]>([
    [1, "next", 3],
    [3, "next", 5],
    [3, "previous", 1],
    [5, "previous", 3],
    [6, "next", 6],
    [0, "previous", 0],
    [3, "first", 0],
    [3, "last", 6],
  ])("from tool %i, %s goes to tool %i, skipping disabled tools", (from, move, to) => {
    expect(toolbarFocus(enabled, from, move)).toBe(to);
  });

  test("skips disabled tools at the ends too, and stays when none is enabled", () => {
    const ends = [false, true, true, false];
    expect(toolbarFocus(ends, 2, "first")).toBe(1);
    expect(toolbarFocus(ends, 1, "last")).toBe(2);
    expect(toolbarFocus(ends, 2, "next")).toBe(2);
    expect(toolbarFocus([false, false], 1, "first")).toBe(1);
  });

  test("keeps its Tab stop on an enabled tool, moving it when that tool turns disabled", () => {
    expect(toolbarStop(enabled, 3)).toBe(3);
    expect(toolbarStop(enabled, 2)).toBe(3);
    expect(toolbarStop([true, true, false, false], 3)).toBe(1);
    expect(toolbarStop([false, false, false], 1)).toBeUndefined();
  });
});
