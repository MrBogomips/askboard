import { describe, expect, test } from "bun:test";
import { elementChanges, TREE_SHAPE, type TreeNode, type TreeProps } from "@askboard/contract";
import { treeBoardDocument, treeEditedValue } from "@askboard/contract/fixtures";
import { generator, idsOf, randomEdit } from "../../../test/tree-model.ts";
import {
  addAfter,
  addChild,
  indent,
  moveDown,
  moveUp,
  outdent,
  remove,
  rename,
  setField,
} from "./edits.ts";
import { marksOf, type NodeMark, sameNodes } from "./marks.ts";

// The change highlight's marks (design decision 5; proposal, open question 14): per node, added,
// moved, renamed or which fields changed, against the sent value, and the count "Your changes"
// shows, each added, removed, moved or edited node once. For display only: the model never builds
// `changes`, but the marks name the nodes the contract's diff touches.
const sent = treeBoardDocument.items[0].props.items[0].props;

const mark = (fields: Partial<NodeMark>): NodeMark => ({
  added: false,
  moved: false,
  renamed: false,
  fields: [],
  ...fields,
});

const marked = (edited: TreeProps) => {
  const { byNode, count } = marksOf(sent, edited);
  return { marks: Object.fromEntries(byNode), count };
};

describe("the marks against the sent value", () => {
  test("are none, with a count of 0, for the sent value", () => {
    expect(marked(sent)).toEqual({ marks: {}, count: 0 });
  });

  test("mark the approved UJ-2 edits: the fields, the rename and the added node", () => {
    expect(marked(treeEditedValue)).toEqual({
      marks: {
        ux: mark({ fields: ["mostLikely"] }),
        portal: mark({ renamed: true, fields: ["mostLikely", "optimistic", "pessimistic"] }),
        "u-1": mark({ added: true }),
        billing: mark({ fields: ["pessimistic"] }),
      },
      count: 4,
    });
  });

  test("count a rename, an add and a delete as 3, the deleted node leaving no mark", () => {
    const edited = remove(
      addAfter(rename(sent, "portal", "Customer portal: accounts"), "portal", "Dashboards"),
      "reporting",
    );
    expect(marked(edited)).toEqual({
      marks: { portal: mark({ renamed: true }), "u-1": mark({ added: true }) },
      count: 3,
    });
  });

  test("mark an emptied field as changed", () => {
    expect(marked(setField(sent, "ux", "optimistic", undefined)).marks).toEqual({
      ux: mark({ fields: ["optimistic"] }),
    });
  });

  test("mark only the added node, however it is then edited", () => {
    const added = addChild(sent, "portal", "Accounts");
    expect(marked(moveUp(addAfter(added, "u-1", "Dashboards"), "u-2"))).toEqual({
      marks: { "u-1": mark({ added: true }), "u-2": mark({ added: true }) },
      count: 2,
    });
  });

  test("mark one node moved for a swap of two siblings, whichever way it was made", () => {
    expect(marked(moveUp(sent, "billing"))).toEqual({
      marks: { billing: mark({ moved: true }) },
      count: 1,
    });
    expect(marked(moveDown(sent, "portal"))).toEqual(marked(moveUp(sent, "billing")));
    expect(marked(moveUp(sent, "build"))).toEqual({
      marks: { build: mark({ moved: true }) },
      count: 1,
    });
  });

  test("mark a node moved to another parent, and not its new or its old parent", () => {
    expect(marked(indent(sent, "billing"))).toEqual({
      marks: { billing: mark({ moved: true }) },
      count: 1,
    });
    expect(marked(outdent(sent, "portal"))).toEqual({
      marks: { portal: mark({ moved: true }) },
      count: 1,
    });
  });

  test("count every node of a removed branch", () => {
    expect(marked(remove(sent, "design"))).toEqual({ marks: {}, count: 4 });
  });

  test("count a node moved out of a removed branch once, as moved", () => {
    expect(marked(remove(outdent(sent, "ux"), "design"))).toEqual({
      marks: { ux: mark({ moved: true }) },
      count: 4,
    });
  });

  test("leave a node renamed back unmarked", () => {
    const back = rename(rename(sent, "portal", "Portal"), "portal", "Customer portal");
    expect(marked(back)).toEqual({ marks: {}, count: 0 });
  });

  test("are frozen, and leave their inputs untouched", () => {
    const edited = rename(setField(sent, "ux", "mostLikely", 6), "portal", "Portal");
    const copies = [structuredClone(sent), structuredClone(edited)];
    const marks = marksOf(sent, edited);
    expect(Object.isFrozen(marks)).toBe(true);
    expect([...marks.byNode.values()].every((one) => Object.isFrozen(one))).toBe(true);
    expect([...marks.byNode.values()].every((one) => Object.isFrozen(one.fields))).toBe(true);
    expect([sent, edited]).toEqual(copies);
  });
});

describe("the marks against the contract's diff (seeded)", () => {
  // What the diff touches, in the marks' shape: an `add` is an added node, a `move` a moved one,
  // a `set` of `label` a rename and any other `set` a changed field.
  const expected = (edited: TreeProps) => {
    const marks = new Map<string, NodeMark>();
    const at = (id: string) => marks.get(id) ?? mark({});
    for (const change of elementChanges("wbs", sent, edited, TREE_SHAPE)) {
      const [, id = "", field] = change.target.split(".");
      const now = at(id);
      if (change.op === "add") marks.set(id, { ...now, added: true });
      if (change.op === "move") marks.set(id, { ...now, moved: true });
      if (change.op === "set" && field === "label") marks.set(id, { ...now, renamed: true });
      if (change.op === "set" && field !== "label") {
        marks.set(id, { ...now, fields: [...now.fields, field ?? ""] });
      }
    }
    const kept = new Set(idsOf(edited.nodes));
    const removed = idsOf(sent.nodes).filter((id) => !kept.has(id)).length;
    return { marks: Object.fromEntries(marks), count: marks.size + removed };
  };

  test("name the nodes the diff adds, moves, renames and sets, over 500 runs", () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const random = generator(seed);
      let value = sent;
      const steps: string[] = [];
      for (let at = 0; at < 15; at += 1) {
        const [step, next] = randomEdit(random, value);
        steps.push(step);
        value = next;
      }
      expect({ seed, steps, ...marked(value) }).toEqual({ seed, steps, ...expected(value) });
    }
  });
});

describe("sameNodes", () => {
  test("is true for the same nodes, whatever the order of their keys", () => {
    const reordered = (nodes: readonly TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        const entries = Object.entries(node).reverse();
        return Object.fromEntries(
          entries.map(([key, value]) =>
            key === "children" ? [key, reordered(value as TreeNode[])] : [key, value],
          ),
        ) as TreeNode;
      });
    expect(sameNodes(sent, sent)).toBe(true);
    expect(sameNodes(sent, { ...sent, nodes: reordered(sent.nodes) })).toBe(true);
    expect(sameNodes(sent, structuredClone(sent))).toBe(true);
  });

  test("is true after a rename back, and after an add and its delete", () => {
    const back = rename(rename(sent, "portal", "Portal"), "portal", "Customer portal");
    expect(sameNodes(sent, back)).toBe(true);
    expect(sameNodes(sent, remove(addAfter(sent, "portal", "Dashboards"), "u-1"))).toBe(true);
    expect(sameNodes(sent, moveDown(moveUp(sent, "billing"), "billing"))).toBe(true);
  });

  test("is false after any change to a node, its place or its fields", () => {
    expect(sameNodes(sent, rename(sent, "portal", "Portal"))).toBe(false);
    expect(sameNodes(sent, moveUp(sent, "billing"))).toBe(false);
    expect(sameNodes(sent, indent(sent, "billing"))).toBe(false);
    expect(sameNodes(sent, setField(sent, "ux", "mostLikely", 6))).toBe(false);
    expect(sameNodes(sent, setField(sent, "ux", "mostLikely", undefined))).toBe(false);
    expect(sameNodes(sent, addAfter(sent, "portal", "Dashboards"))).toBe(false);
    expect(sameNodes(sent, remove(sent, "reporting"))).toBe(false);
    expect(sameNodes({ nodes: [] }, sent)).toBe(false);
  });

  test("compares only the nodes, which the edits change, not the columns", () => {
    expect(sameNodes(sent, { nodes: sent.nodes })).toBe(true);
  });
});
