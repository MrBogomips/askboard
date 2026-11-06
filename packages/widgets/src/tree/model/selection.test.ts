import { describe, expect, test } from "bun:test";
import type { TreeNode, TreeProps } from "@askboard/contract";
import { generator } from "../../../test/tree-model.ts";
import { visibleRows } from "./rows.ts";
import {
  countOf,
  extend,
  headerState,
  NO_SELECTION,
  pruned,
  selectAll,
  selectedLeaves,
  selectNone,
  selectSubtree,
  stateOf,
  toggle,
} from "./selection.ts";

// The Tree's row selection (design decision 3; spec, Tree row selection and Tree selection is view
// state): a parent's state is derived from its subtree.
const leaf = (id: string): TreeNode => ({ id, label: id });
const NODES: readonly TreeNode[] = [
  { id: "ux", label: "ux" },
  {
    id: "build",
    label: "build",
    children: [leaf("portal"), leaf("billing"), leaf("reporting")],
  },
];
const TREE: TreeProps = { nodes: NODES } as TreeProps;
const idsOf = (selection: ReadonlySet<string>) => [...selection].sort();
const stateById = (selection: ReadonlySet<string>, id: string) => {
  const find = (list: readonly TreeNode[]): TreeNode | undefined => {
    for (const node of list) {
      const found = node.id === id ? node : find(node.children ?? []);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const node = find(NODES);
  if (node === undefined) throw new Error(`no node ${id}`);
  return stateOf(selection, node);
};

describe("toggling", () => {
  test("selecting a branch selects every node under it, and the header is partial", () => {
    const selected = toggle(NO_SELECTION, TREE, "build");
    expect(idsOf(selected)).toEqual(["billing", "build", "portal", "reporting"]);
    expect(countOf(selected)).toBe(4);
    expect(headerState(selected, TREE)).toBe("partial");
  });

  test("a leaf toggles on and off, and its parent is partial then none", () => {
    const one = toggle(NO_SELECTION, TREE, "portal");
    expect(idsOf(one)).toEqual(["portal"]);
    expect(stateById(one, "build")).toBe("partial");
    expect(toggle(one, TREE, "portal").size).toBe(0);
  });

  test("selecting every child selects the parent; clearing one clears the parent", () => {
    let selected = NO_SELECTION;
    for (const id of ["portal", "billing", "reporting"]) selected = toggle(selected, TREE, id);
    expect(stateById(selected, "build")).toBe("checked");
    expect(selected.has("build")).toBe(true);
    selected = toggle(selected, TREE, "billing");
    expect(stateById(selected, "build")).toBe("partial");
    expect(selected.has("build")).toBe(false);
  });

  test("toggling a partial parent selects its whole branch, a checked one clears it", () => {
    const partial = toggle(NO_SELECTION, TREE, "portal");
    const all = toggle(partial, TREE, "build");
    expect(all.size).toBe(4);
    expect(toggle(all, TREE, "build").size).toBe(0);
  });

  test("an unknown node changes nothing and the input is untouched", () => {
    const before = toggle(NO_SELECTION, TREE, "portal");
    expect(toggle(before, TREE, "nope")).toBe(before);
    toggle(before, TREE, "ux");
    expect(idsOf(before)).toEqual(["portal"]);
  });
});

describe("select all and none", () => {
  test("all selects every node, collapsed rows included; the header is checked", () => {
    const selected = selectAll(TREE);
    expect(selected.size).toBe(5);
    expect(headerState(selected, TREE)).toBe("checked");
    expect(headerState(selectNone(), TREE)).toBe("none");
  });

  test("the header of an empty Tree is none", () => {
    expect(headerState(NO_SELECTION, { nodes: [] } as unknown as TreeProps)).toBe("none");
  });
});

describe("a range over the visible rows", () => {
  test("from the anchor down to the target, collapsed rows skipped", () => {
    const rows = visibleRows(NODES, new Set(["build"]));
    const selected = extend(NO_SELECTION, TREE, rows, "ux", "build");
    expect(idsOf(selected)).toEqual(["billing", "build", "portal", "reporting", "ux"]);
  });

  test("works upwards and over open rows", () => {
    const rows = visibleRows(NODES, new Set());
    const selected = extend(NO_SELECTION, TREE, rows, "reporting", "portal");
    expect(idsOf(selected)).toEqual(["billing", "build", "portal", "reporting"]);
    expect(stateById(selected, "build")).toBe("checked");
  });

  test("adds to what is selected, and a hidden row changes nothing", () => {
    const rows = visibleRows(NODES, new Set(["build"]));
    const before = toggle(NO_SELECTION, TREE, "ux");
    expect(extend(before, TREE, rows, "ux", "portal")).toBe(before);
    expect(extend(before, TREE, rows, "build", "build").size).toBe(5);
  });
});

describe("pruning", () => {
  test("a deleted node leaves the selection and its parent is derived again", () => {
    const selected = selectSubtree(NO_SELECTION, TREE, "build");
    const without: TreeProps = {
      nodes: [NODES[0], { ...NODES[1], children: [leaf("portal"), leaf("billing")] }],
    } as TreeProps;
    const after = pruned(selected, without);
    expect(idsOf(after)).toEqual(["billing", "build", "portal"]);
    expect(countOf(after)).toBe(countOf(selected) - 1);
  });

  test("a value that holds all of it leaves it as it was", () => {
    const selected = selectAll(TREE);
    expect(pruned(selected, TREE)).toBe(selected);
  });
});

describe("the leaves a bulk adjustment changes", () => {
  test("only the leaves among the selected nodes, in document order", () => {
    expect(selectedLeaves(selectAll(TREE), TREE).map((node) => node.id)).toEqual([
      "ux",
      "portal",
      "billing",
      "reporting",
    ]);
    expect(selectedLeaves(toggle(NO_SELECTION, TREE, "build"), TREE)).toHaveLength(3);
  });
});

// A random tree of 1 to 4 levels.
const randomNodes = (random: ReturnType<typeof generator>, depth: number, next: { n: number }) =>
  Array.from({ length: 1 + random.int(3) }, (): TreeNode => {
    const id = `r${next.n++}`;
    return depth > 1 && random.int(2) === 0
      ? { id, label: id, children: randomNodes(random, depth - 1, next) }
      : leaf(id);
  });

const allNodes = (list: readonly TreeNode[]): TreeNode[] =>
  list.flatMap((node) => [node, ...allNodes(node.children ?? [])]);

describe("a parent's state is derived from its subtree (property)", () => {
  test("after any sequence of toggles, extends and prunes", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const random = generator(seed);
      const tree = { nodes: randomNodes(random, 4, { n: 0 }) } as TreeProps;
      const rows = visibleRows(tree.nodes, new Set());
      const ids = allNodes(tree.nodes).map((node) => node.id);
      let selection: ReadonlySet<string> = NO_SELECTION;
      for (let step = 0; step < 12; step += 1) {
        const id = random.pick(ids);
        selection =
          random.int(3) === 0
            ? extend(selection, tree, rows, random.pick(ids), id)
            : toggle(selection, tree, id);
        for (const node of allNodes(tree.nodes)) {
          const children = node.children ?? [];
          if (children.length === 0) continue;
          const states = children.map((child) => stateOf(selection, child));
          const expected = states.every((state) => state === "checked")
            ? "checked"
            : states.every((state) => state === "none")
              ? "none"
              : "partial";
          expect(stateOf(selection, node)).toBe(expected);
          expect(selection.has(node.id)).toBe(expected === "checked");
        }
      }
    }
  });
});
