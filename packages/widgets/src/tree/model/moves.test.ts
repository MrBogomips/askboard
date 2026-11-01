import { describe, expect, test } from "bun:test";
import {
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  type TreeColumn,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import {
  chain,
  flat,
  generator,
  idsOf,
  isDeepFrozen,
  objectsOf,
  randomEdit,
} from "../../../test/tree-model.ts";
import {
  addAfter,
  addChild,
  can,
  indent,
  moveDown,
  moveUp,
  outdent,
  remove,
  type TreeEdit,
} from "./edits.ts";

// The moves and `can` (design decision 5; proposal, open question 13): up and down swap with the
// neighbouring sibling and stop at the ends; indent makes the node the last child of its previous
// sibling; outdent places it right after its parent; each carries the branch. A move that is not
// possible is disabled through `can` and changes nothing; the limits come from the contract.
const sent = treeBoardDocument.items[0].props.items[0].props;

type Edit = (value: TreeProps, nodeId: string) => TreeProps;

/** Runs `edit`, checking that its input stays as it was and that a new result validates and is frozen. */
const run = (edit: Edit, value: TreeProps, nodeId: string): TreeProps => {
  const copy = structuredClone(value);
  const objects = objectsOf(value).map((object) => [object, Object.isFrozen(object)] as const);
  const result = edit(value, nodeId);
  expect(value).toEqual(copy);
  expect(objects.every(([object, frozen]) => Object.isFrozen(object) === frozen)).toBe(true);
  if (result !== value) {
    const checked = validateTreeProps(result, "edited");
    expect(checked.ok ? [] : checked.problems).toEqual([]);
    expect(isDeepFrozen(result)).toBe(true);
  }
  return result;
};

/** The value's shape as nested IDs: a leaf is its ID, a parent `[id, children]`. */
type Outline = string | [string, Outline[]];
const outline = (nodes: readonly TreeNode[]): Outline[] =>
  nodes.map((node) => (node.children === undefined ? node.id : [node.id, outline(node.children)]));

const DESIGN: Outline = ["design", ["ux", "architecture", "prototype"]];

describe("moving up and down", () => {
  test("swaps the node with its previous sibling", () => {
    expect(outline(run(moveUp, sent, "billing").nodes)).toEqual([
      DESIGN,
      ["build", ["billing", "portal", "reporting"]],
    ]);
  });

  test("swaps the node with its next sibling", () => {
    expect(outline(run(moveDown, sent, "portal").nodes)).toEqual([
      DESIGN,
      ["build", ["billing", "portal", "reporting"]],
    ]);
  });

  test("carries the node's branch", () => {
    expect(outline(run(moveUp, sent, "build").nodes)).toEqual([
      ["build", ["portal", "billing", "reporting"]],
      DESIGN,
    ]);
    expect(run(moveDown, sent, "design").nodes[1]).toEqual(sent.nodes[0] as TreeNode);
  });

  test("stops at the ends, changing nothing", () => {
    expect(run(moveUp, sent, "portal")).toBe(sent);
    expect(run(moveUp, sent, "design")).toBe(sent);
    expect(run(moveDown, sent, "reporting")).toBe(sent);
    expect(run(moveDown, sent, "build")).toBe(sent);
  });
});

describe("indenting", () => {
  test("makes the node the last child of its previous sibling, a leaf included", () => {
    expect(outline(run(indent, sent, "billing").nodes)).toEqual([
      DESIGN,
      ["build", [["portal", ["billing"]], "reporting"]],
    ]);
  });

  test("puts the node after the previous sibling's children, carrying its branch", () => {
    expect(outline(run(indent, sent, "build").nodes)).toEqual([
      [
        "design",
        ["ux", "architecture", "prototype", ["build", ["portal", "billing", "reporting"]]],
      ],
    ]);
  });

  test("is refused on a first child and on the first top-level node", () => {
    expect(run(indent, sent, "portal")).toBe(sent);
    expect(run(indent, sent, "design")).toBe(sent);
  });

  test(`is refused when its branch would reach past level ${TREE_MAX_DEPTH}`, () => {
    // `p` and the chain `n1` … `n<depth>` at the top level: indenting `n1` puts it under `p`.
    const tree = (depth: number): TreeProps => ({
      nodes: [{ id: "p", label: "P" }, ...chain(depth)],
    });
    const tooDeep = tree(TREE_MAX_DEPTH);
    expect(run(indent, tooDeep, "n1")).toBe(tooDeep);
    const deepEnough = run(indent, tree(TREE_MAX_DEPTH - 1), "n1");
    expect(idsOf(deepEnough.nodes)).toHaveLength(TREE_MAX_DEPTH);
  });
});

describe("outdenting", () => {
  test("places the node right after its parent, its later siblings staying", () => {
    expect(outline(run(outdent, sent, "portal").nodes)).toEqual([
      DESIGN,
      ["build", ["billing", "reporting"]],
      "portal",
    ]);
    expect(outline(run(outdent, sent, "ux").nodes)).toEqual([
      ["design", ["architecture", "prototype"]],
      "ux",
      ["build", ["portal", "billing", "reporting"]],
    ]);
  });

  test("carries the node's branch, and leaves a parent with no child a leaf", () => {
    const nested: TreeProps = { nodes: chain(3) };
    expect(outline(run(outdent, nested, "n2").nodes)).toEqual(["n1", ["n2", ["n3"]]]);
    expect(run(outdent, nested, "n2").nodes[0]).toEqual({ id: "n1", label: "Level 1" });
  });

  test("is refused at the top level", () => {
    expect(run(outdent, sent, "design")).toBe(sent);
    expect(run(outdent, sent, "build")).toBe(sent);
  });
});

describe("a move of a node the value does not hold", () => {
  test.each([moveUp, moveDown, indent, outdent])("changes nothing (%#)", (move) => {
    expect(run(move, sent, "nowhere")).toBe(sent);
  });
});

const EDITS: readonly TreeEdit[] = [
  "addAfter",
  "addChild",
  "moveUp",
  "moveDown",
  "indent",
  "outdent",
  "remove",
];

// Each tool's edit, a new node named "New".
const apply: Record<TreeEdit, Edit> = {
  addAfter: (value, nodeId) => addAfter(value, nodeId, "New"),
  addChild: (value, nodeId) => addChild(value, nodeId, "New"),
  moveUp,
  moveDown,
  indent,
  outdent,
  remove,
};

describe("can, for the toolbar and the keys", () => {
  test.each<[string, Partial<Record<TreeEdit, boolean>>]>([
    ["design", { moveUp: false, indent: false, outdent: false }],
    ["build", { moveDown: false, outdent: false }],
    ["portal", { moveUp: false, indent: false }],
    ["billing", {}],
    ["reporting", { moveDown: false }],
  ])("on %s in the fixture Tree", (nodeId, refused) => {
    const allowed = Object.fromEntries(EDITS.map((edit) => [edit, refused[edit] ?? true]));
    expect(Object.fromEntries(EDITS.map((edit) => [edit, can(edit, sent, nodeId)]))).toEqual(
      allowed,
    );
  });

  test("refuses every edit on a node the value does not hold", () => {
    expect(EDITS.filter((edit) => can(edit, sent, "nowhere"))).toEqual([]);
  });

  test("with no current node, allows only adding a top-level node", () => {
    expect(EDITS.filter((edit) => can(edit, { nodes: [] }, undefined))).toEqual(["addAfter"]);
  });

  test(`refuses both adds at ${TREE_MAX_NODES} nodes`, () => {
    const full: TreeProps = { nodes: flat(TREE_MAX_NODES) };
    expect(can("addAfter", full, "n1")).toBe(false);
    expect(can("addAfter", full, undefined)).toBe(false);
    expect(can("addChild", full, "n1")).toBe(false);
    expect(can("moveUp", full, "n1")).toBe(true);
  });

  test(`refuses a child and an indent past level ${TREE_MAX_DEPTH}`, () => {
    const deepest: TreeProps = { nodes: [...chain(TREE_MAX_DEPTH), { id: "x", label: "X" }] };
    expect(can("addChild", deepest, `n${TREE_MAX_DEPTH}`)).toBe(false);
    expect(can("addChild", deepest, `n${TREE_MAX_DEPTH - 1}`)).toBe(true);
    expect(can("indent", deepest, "x")).toBe(true);
    expect(can("addAfter", deepest, `n${TREE_MAX_DEPTH}`)).toBe(true);
  });

  test("agrees with every edit on random Trees: allowed exactly when the edit changes the value", () => {
    const random = generator(20_261_031);
    let value: TreeProps = sent;
    for (let step = 0; step < 300; step += 1) {
      for (const nodeId of idsOf(value.nodes)) {
        for (const edit of EDITS) {
          const changed = apply[edit](value, nodeId) !== value;
          expect({ edit, nodeId, allowed: can(edit, value, nodeId) }).toEqual({
            edit,
            nodeId,
            allowed: changed,
          });
        }
      }
      [, value] = randomEdit(random, value);
    }
  });
});

const OWNER: TreeColumn = { field: "owner", label: "Owner", type: "text" };
const RUNS = 500;
const STEPS = 20;

describe("random edit sequences (seeded)", () => {
  test(`keep every value valid and frozen, and their inputs untouched, over ${RUNS} runs`, () => {
    const start: TreeProps = { ...sent, columns: [...(sent.columns ?? []), OWNER] };
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const random = generator(seed);
      const steps: string[] = [];
      let value = start;
      for (let at = 0; at < STEPS; at += 1) {
        const copy = structuredClone(value);
        const [step, next] = randomEdit(random, value);
        steps.push(step);
        const checked = validateTreeProps(next, "edited");
        const problems = checked.ok ? [] : checked.problems;
        expect({ seed, steps, problems }).toEqual({ seed, steps, problems: [] });
        expect(value).toEqual(copy);
        if (next !== value) expect(isDeepFrozen(next)).toBe(true);
        value = next;
      }
    }
  });
});
