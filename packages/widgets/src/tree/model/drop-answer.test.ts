import { describe, expect, test } from "bun:test";
import { elementChanges, TREE_SHAPE, type TreeProps } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeChanges } from "@askboard/contract/validate";
import { applyDrop, type DropZone, dropOn } from "./drop.ts";
import { indent, moveDown, moveUp, outdent } from "./edits.ts";
import { marksOf } from "./marks.ts";

// A drag is a change as the buttons' moves are (spec, "Tree drag has a keyboard path and is a
// change"): the same `move` operations either way, the node counted once, none once it is back.
const { id: ITEM, props: sent } = treeBoardDocument.items[0].props.items[0];

const FRACTION: Readonly<Record<DropZone, number>> = { before: 0.1, after: 0.9, into: 0.5 };
const dragged = (value: TreeProps, nodeId: string, targetId: string, zone: DropZone) =>
  applyDrop(value, nodeId, dropOn(value, nodeId, targetId, FRACTION[zone]));
const changesOf = (edited: TreeProps) => elementChanges(ITEM, sent, edited, TREE_SHAPE);
const press = (value: TreeProps, nodeId: string, ...moves: (typeof moveUp)[]): TreeProps =>
  moves.reduce((current, move) => move(current, nodeId), value);

describe("a drag and the buttons give the same changes", () => {
  test("billing before portal is one Alt+Shift+ArrowUp", () => {
    const byDrag = dragged(sent, "billing", "portal", "before");
    const byKeys = press(sent, "billing", moveUp);
    expect(changesOf(byDrag)).toEqual(changesOf(byKeys));
    expect(changesOf(byDrag)).toEqual([{ op: "move", target: `${ITEM}.billing`, parent: "build" }]);
  });

  test("billing into portal is one Alt+Shift+ArrowRight, an indent into its previous sibling (The keyboard path)", () => {
    const intoPortal = dragged(sent, "billing", "portal", "into");
    const byKeys = press(sent, "billing", indent);
    expect(changesOf(intoPortal)).toEqual(changesOf(byKeys));
    expect(changesOf(intoPortal)).toEqual([
      { op: "move", target: `${ITEM}.billing`, parent: "portal" },
    ]);
  });

  test("reporting after build is an outdent, carrying its place", () => {
    const byDrag = dragged(sent, "reporting", "build", "after");
    const byKeys = press(sent, "reporting", outdent);
    expect(changesOf(byDrag)).toEqual(changesOf(byKeys));
    expect(changesOf(byDrag)).toEqual([
      { op: "move", target: `${ITEM}.reporting`, after: "build" },
    ]);
  });

  test("every drop of the fixture gives the changes of the moves that reach its position", () => {
    const moves = [moveUp, moveDown, indent, outdent];
    // The keys' paths to each position, by a search over the node's moves.
    const paths = (nodeId: string): Map<string, TreeProps> => {
      const seen = new Map<string, TreeProps>([[JSON.stringify(sent.nodes), sent]]);
      for (const value of seen.values())
        for (const move of moves) {
          const next = move(value, nodeId);
          if (!seen.has(JSON.stringify(next.nodes))) seen.set(JSON.stringify(next.nodes), next);
        }
      return seen;
    };
    const ids = [
      "design",
      "ux",
      "architecture",
      "prototype",
      "build",
      "portal",
      "billing",
      "reporting",
    ];
    for (const nodeId of ids) {
      const reachable = paths(nodeId);
      for (const targetId of ids)
        for (const zone of ["before", "after", "into"] as const) {
          const byDrag = dragged(sent, nodeId, targetId, zone);
          const byKeys = reachable.get(JSON.stringify(byDrag.nodes));
          expect({ nodeId, targetId, zone, reached: byKeys !== undefined }).toEqual({
            nodeId,
            targetId,
            zone,
            reached: true,
          });
          expect(changesOf(byDrag)).toEqual(changesOf(byKeys as TreeProps));
        }
    }
  });
});

describe("the highlight and the answer of a drag", () => {
  test("billing before portal counts once, marks billing moved, and its move validates as Tree changes", () => {
    const edited = dragged(sent, "billing", "portal", "before");
    const { byNode, count } = marksOf(sent, edited);
    expect(count).toBe(1);
    expect(byNode.get("billing")?.moved).toBe(true);
    const checked = validateTreeChanges(ITEM, changesOf(edited), sent);
    expect(checked.ok).toBe(true);
  });

  test("the first place carries no `after`, a later one the node it follows", () => {
    const first = changesOf(dragged(sent, "reporting", "design", "before"));
    expect(first).toEqual([{ op: "move", target: `${ITEM}.reporting` }]);
    const later = changesOf(dragged(sent, "reporting", "design", "after"));
    expect(later).toEqual([{ op: "move", target: `${ITEM}.reporting`, after: "design" }]);
    for (const changes of [first, later])
      expect(validateTreeChanges(ITEM, changes, sent).ok).toBe(true);
  });

  test("a node dragged away and back leaves no change (Back where it was)", () => {
    const away = dragged(sent, "billing", "portal", "into");
    expect(changesOf(away)).toHaveLength(1);
    const back = dragged(away, "billing", "portal", "after");
    expect(changesOf(back)).toEqual([]);
    expect(marksOf(sent, back).count).toBe(0);
    const reporting = dragged(sent, "reporting", "design", "before");
    const home = dragged(reporting, "reporting", "billing", "after");
    expect(changesOf(home)).toEqual([]);
  });

  test("a refused drop gives no change", () => {
    const refused = dragged(sent, "build", "portal", "into");
    expect(refused).toBe(sent);
    expect(changesOf(refused)).toEqual([]);
  });
});
