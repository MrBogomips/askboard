import { describe, expect, test } from "bun:test";
import type { TreeNode, TreeProps } from "@askboard/contract";
import { treeBoardDocument, uj2ExpandedQuestion } from "@askboard/contract/fixtures";
import { openingCollapsed, visibleRows } from "./rows.ts";

// The visible rows of a Tree (design decision 5): one per node whose ancestors are all expanded,
// in document order, with what the treegrid's roles need. All expanded by default (open question 8).
const fixture = treeBoardDocument.items[0].props.items[0].props;
const NONE: ReadonlySet<string> = new Set();

const summary = (nodes: readonly TreeNode[], collapsed: ReadonlySet<string>) =>
  visibleRows(nodes, collapsed).map(({ node, level, parentId, position, setSize, ...rest }) => [
    node.id,
    level,
    parentId ?? null,
    position,
    setSize,
    rest.hasChildren,
    rest.expanded,
  ]);

// A tree of `top` nodes, each with `perNode` leaves: `top * (1 + perNode)` nodes.
const wideTree = (top: number, perNode: number): TreeNode[] =>
  Array.from({ length: top }, (_, at) => ({
    id: `n${at}`,
    label: `Node ${at}`,
    children: Array.from({ length: perNode }, (_, leaf) => ({
      id: `n${at}-${leaf}`,
      label: `Leaf ${at}.${leaf}`,
    })),
  }));

describe("the visible rows (design decision 5)", () => {
  test("give the fixture Tree's nodes in document order, with level, parent, position and set size", () => {
    expect(summary(fixture.nodes, NONE)).toEqual([
      ["design", 1, null, 1, 2, true, true],
      ["ux", 2, "design", 1, 3, false, false],
      ["architecture", 2, "design", 2, 3, false, false],
      ["prototype", 2, "design", 3, 3, false, false],
      ["build", 1, null, 2, 2, true, true],
      ["portal", 2, "build", 1, 3, false, false],
      ["billing", 2, "build", 2, 3, false, false],
      ["reporting", 2, "build", 3, 3, false, false],
    ]);
  });

  test("hold each node as it is in the value", () => {
    const rows = visibleRows(fixture.nodes, NONE);
    expect(rows[0]?.node).toBe(fixture.nodes[0] as TreeNode);
    expect(rows[5]?.node).toBe(fixture.nodes[1]?.children?.[0] as TreeNode);
  });

  test("show every node when nothing is collapsed (open question 8)", () => {
    const rows = visibleRows(fixture.nodes, NONE);
    expect(rows).toHaveLength(8);
    expect(rows.filter((row) => row.hasChildren).every((row) => row.expanded)).toBe(true);
  });

  test("hide the children of a collapsed node, which stays visible and closed", () => {
    expect(summary(fixture.nodes, new Set(["build"]))).toEqual([
      ["design", 1, null, 1, 2, true, true],
      ["ux", 2, "design", 1, 3, false, false],
      ["architecture", 2, "design", 2, 3, false, false],
      ["prototype", 2, "design", 3, 3, false, false],
      ["build", 1, null, 2, 2, true, false],
    ]);
  });

  test("hide every descendant of a collapsed node, an expanded one included", () => {
    const nodes: TreeNode[] = [
      {
        id: "a",
        label: "A",
        children: [{ id: "b", label: "B", children: [{ id: "c", label: "C" }] }],
      },
      { id: "d", label: "D" },
    ];
    expect(visibleRows(nodes, new Set(["a"])).map((row) => row.node.id)).toEqual(["a", "d"]);
    expect(visibleRows(nodes, new Set(["b"])).map((row) => row.node.id)).toEqual(["a", "b", "d"]);
    expect(summary(nodes, NONE)[2]).toEqual(["c", 3, "b", 1, 1, false, false]);
  });

  test("ignore a collapsed leaf and an ID the value does not hold", () => {
    expect(summary(fixture.nodes, new Set(["ux", "nowhere"]))).toEqual(
      summary(fixture.nodes, NONE),
    );
  });

  test("are none for an empty Tree", () => {
    expect(visibleRows([], NONE)).toEqual([]);
  });

  test("give a row per node of a 200-node Tree (FR-20)", () => {
    const rows = visibleRows(wideTree(10, 19), NONE);
    expect(rows).toHaveLength(200);
    expect(rows[0]).toMatchObject({ level: 1, position: 1, setSize: 10, hasChildren: true });
    expect(rows[20]).toMatchObject({ level: 1, parentId: undefined, position: 2, setSize: 10 });
    expect(rows[21]).toMatchObject({ level: 2, parentId: "n1", position: 1, setSize: 19 });
    expect(rows[199]?.node.id).toBe("n9-18");
    expect(visibleRows(wideTree(10, 19), new Set(["n0", "n9"]))).toHaveLength(200 - 2 * 19);
  });

  test("are frozen, and leave their inputs untouched", () => {
    const nodes = wideTree(2, 2);
    const before = structuredClone(nodes);
    const collapsed = new Set(["n1"]);
    const rows = visibleRows(nodes, collapsed);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(rows.every((row) => Object.isFrozen(row))).toBe(true);
    expect(nodes).toEqual(before);
    expect([...collapsed]).toEqual(["n1"]);
  });
});

describe("the rows a work breakdown opens with (molecules design decision 14; view spec, WBS opening depth)", () => {
  // The expanded UJ-2 work breakdown: `pert`, `openDepth` 2, Design and Build with three leaves each.
  const wbs = uj2ExpandedQuestion.props.items[0].props;
  const opening = (props: TreeProps) =>
    visibleRows(props.nodes, openingCollapsed(props)).map((row) => [row.node.id, row.expanded]);
  // The work breakdown with the portal given a child, a third level.
  const deeper: TreeProps = {
    ...wbs,
    nodes: wbs.nodes.map((node) =>
      node.id !== "build"
        ? node
        : {
            ...node,
            children: (node.children ?? []).map((child) =>
              child.id === "portal"
                ? { ...child, children: [{ id: "u-1", label: "Login" }] }
                : child,
            ),
          },
    ),
  };

  test("with openDepth 2, Design and Build open and their six children show", () => {
    expect(opening(wbs)).toEqual([
      ["design", true],
      ["ux", false],
      ["architecture", false],
      ["prototype", false],
      ["build", true],
      ["portal", false],
      ["billing", false],
      ["reporting", false],
    ]);
  });

  test("with openDepth 1, only Design and Build show, closed", () => {
    expect(opening({ ...wbs, openDepth: 1 } as TreeProps)).toEqual([
      ["design", false],
      ["build", false],
    ]);
  });

  test("a node with children at the opening depth opens closed, and the levels above it open", () => {
    const rows = opening(deeper);
    expect(rows).toContainEqual(["build", true]);
    expect(rows).toContainEqual(["portal", false]);
    expect(rows.map(([id]) => id)).not.toContain("u-1");
    expect(opening({ ...deeper, openDepth: 3 } as TreeProps)).toContainEqual(["u-1", false]);
  });

  test("a node below the opening depth opens closed too, once its parent is expanded", () => {
    const collapsed = openingCollapsed({ ...deeper, openDepth: 1 } as TreeProps);
    expect([...collapsed].sort()).toEqual(["build", "design", "portal"]);
  });

  test("a work breakdown that sets no openDepth opens two levels (EXPERIENCE, WBS with PERT)", () => {
    const { openDepth, ...unset } = wbs;
    expect(openDepth).toBe(2);
    expect(openingCollapsed(unset)).toEqual(openingCollapsed(wbs));
    expect(openingCollapsed({ ...deeper, openDepth: undefined } as TreeProps)).toEqual(
      new Set(["portal"]),
    );
  });

  test("a Tree without pert still opens fully expanded (tree-widget open question 8)", () => {
    expect(openingCollapsed(fixture).size).toBe(0);
    const { pert, openDepth, ...plain } = deeper as TreeProps & { pert?: true; openDepth?: number };
    expect([pert, openDepth]).toEqual([true, 2]);
    expect(openingCollapsed(plain).size).toBe(0);
    expect(visibleRows(plain.nodes, openingCollapsed(plain))).toHaveLength(9);
  });
});
