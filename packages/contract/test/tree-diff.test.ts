import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type Change,
  elementChanges,
  TREE_MAX_DEPTH,
  TREE_SHAPE,
  type TreeFieldValue,
  type TreeProps,
} from "../src/index.ts";
import { validateTreeChanges, validateTreeProps } from "../src/validate.ts";

// The generic element diff on Tree values (spec, Computing a Tree's changes): the Tree declares
// only its shape, and every diff of two valid Tree values is a valid Tree's changes.
const ITEM = "wbs";
const RUNS = 500;
const COLUMNS = [
  { field: "owner", label: "Owner", type: "text" },
  { field: "days", label: "Days", type: "number" },
  { field: "estimate", label: "Estimate", type: "number" },
] as const;

type Node = {
  id: string;
  label: string;
  children?: Node[];
  [field: string]: TreeFieldValue | Node[] | undefined;
};
type Tree = { columns: typeof COLUMNS; nodes: Node[] };

const refusal = (changes: readonly Change[], sent: TreeProps): string | undefined => {
  const checked = validateTreeChanges(ITEM, changes, sent);
  return checked.ok ? undefined : checked.problems.map((p) => `${p.path} ${p.message}`).join("; ");
};

test("the Tree's shape is its nodes with their children", () => {
  expect(TREE_SHAPE).toEqual({ elements: "nodes", children: "children" });
});

// FR-20's example: 200 nodes, 10 work packages of 19 tasks each.
const twoHundred = (): Tree => ({
  columns: COLUMNS,
  nodes: Array.from({ length: 10 }, (_, p) => ({
    id: `p${p}`,
    label: `Package ${p}`,
    children: Array.from({ length: 19 }, (_, c) => ({
      id: `p${p}c${c}`,
      label: `Task ${p}.${c}`,
      days: c + 1,
    })),
  })),
});

describe("the diff on Tree values", () => {
  test("three changes in a 200-node Tree give exactly three operations (FR-20)", () => {
    const sent = twoHundred();
    const edited = structuredClone(sent);
    const [p3, p5, p7] = [3, 5, 7].map((at) => edited.nodes[at]?.children as Node[]);
    (p3?.[4] as Node).label = "Task 3.4, split";
    (p5?.[2] as Node).days = 9;
    p7?.unshift(p7.pop() as Node);
    const changes = elementChanges(ITEM, sent, edited, TREE_SHAPE);
    expect(changes).toEqual([
      { op: "set", target: "wbs.p3c4.label", value: "Task 3.4, split" },
      { op: "set", target: "wbs.p5c2.days", value: 9 },
      { op: "move", target: "wbs.p7c18", parent: "p7" },
    ]);
    expect(refusal(changes, sent)).toBeUndefined();
    expect(applyElementChanges(ITEM, sent, changes, TREE_SHAPE)).toEqual(edited);
  });

  test("a deleted node with three children gives one remove", () => {
    const sent = twoHundred();
    sent.nodes[0] = { ...(sent.nodes[0] as Node), children: sent.nodes[0]?.children?.slice(0, 3) };
    const edited = { ...sent, nodes: sent.nodes.slice(1) };
    const changes = elementChanges(ITEM, sent, edited, TREE_SHAPE);
    expect(changes).toEqual([{ op: "remove", target: "wbs.p0" }]);
    expect(refusal(changes, sent)).toBeUndefined();
  });

  test("twelve leaves' estimates raised at once give twelve sets, which validate (bulk adjustment)", () => {
    const sent = twoHundred();
    const edited = structuredClone(sent);
    const leaves = (edited.nodes[2]?.children ?? []).slice(0, 12);
    for (const leaf of leaves) leaf.estimate = Math.round((leaf.days as number) * 11) / 10;
    const changes = elementChanges(ITEM, sent, edited, TREE_SHAPE);
    expect(changes).toEqual(
      leaves.map((leaf) => ({
        op: "set",
        target: `wbs.${leaf.id}.estimate`,
        value: leaf.estimate,
      })),
    );
    expect(changes).toHaveLength(12);
    expect(refusal(changes, sent)).toBeUndefined();
    expect(applyElementChanges(ITEM, sent, changes, TREE_SHAPE)).toEqual(edited);
  });

  test("a node moved and moved back gives no operation for it (drag and drop)", () => {
    const sent = twoHundred();
    const edited = structuredClone(sent);
    const [from, to] = [edited.nodes[1]?.children as Node[], edited.nodes[4]?.children as Node[]];
    to.splice(3, 0, from.splice(5, 1)[0] as Node);
    expect(elementChanges(ITEM, sent, edited, TREE_SHAPE)).toHaveLength(1);
    from.splice(5, 0, to.splice(3, 1)[0] as Node);
    const changes = elementChanges(ITEM, sent, edited, TREE_SHAPE);
    expect(changes).toEqual([]);
    expect(refusal(changes, sent)).toBeUndefined();
  });

  test("an unchanged Tree gives no operation, which validates", () => {
    const sent = twoHundred();
    const changes = elementChanges(ITEM, sent, structuredClone(sent), TREE_SHAPE);
    expect(changes).toEqual([]);
    expect(refusal(changes, sent)).toBeUndefined();
  });
});

// mulberry32, a small seeded generator.
const generator = (seed: number) => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (count: number): number => Math.floor(next() * count);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T;
  return { int, pick };
};
type Random = ReturnType<typeof generator>;

const FIELDS = ["owner", "days", "estimate"];
const fieldValue = (random: Random, field: string): TreeFieldValue =>
  field === "owner" ? random.pick(["Ada", "Lin", "Sara Conti"]) : random.int(4) + random.int(2) / 2;

const randomNode = (random: Random, id: string): Node => ({
  id,
  label: `Node ${random.int(5)}`,
  ...Object.fromEntries(
    FIELDS.filter(() => random.int(2) === 0).map((field) => [field, fieldValue(random, field)]),
  ),
});

const randomList = (random: Random, depth: number, nextId: () => string): Node[] =>
  Array.from({ length: random.int(depth === 1 ? 6 : 4) }, () => {
    const node = randomNode(random, nextId());
    if (depth < 3 && random.int(2) === 0) {
      const children = randomList(random, depth + 1, nextId);
      if (children.length > 0) node.children = children;
    }
    return node;
  });

type Place = { readonly node: Node; readonly list: Node[]; readonly parent?: Node };

const places = (tree: Tree): Place[] => {
  const found: Place[] = [];
  const walk = (list: Node[], parent?: Node) => {
    for (const node of list) {
      found.push({ node, list, ...(parent === undefined ? {} : { parent }) });
      if (node.children !== undefined) walk(node.children, node);
    }
  };
  walk(tree.nodes);
  return found;
};

// Takes a node and its subtree out; a children list left empty goes, as a leaf holds none.
const detach = ({ node, list, parent }: Place): void => {
  list.splice(list.indexOf(node), 1);
  if (parent !== undefined && list.length === 0) delete parent.children;
};

const insert = (tree: Tree, random: Random, node: Node): void => {
  const all = places(tree);
  const parent = all.length > 0 && random.int(3) > 0 ? random.pick(all).node : undefined;
  let list = tree.nodes;
  if (parent !== undefined) {
    parent.children ??= [];
    list = parent.children;
  }
  list.splice(random.int(list.length + 1), 0, node);
};

const depthOf = (list: readonly Node[]): number =>
  list.reduce((deepest, node) => Math.max(deepest, 1 + depthOf(node.children ?? [])), 0);

type Edit = (tree: Tree, random: Random, nextId: () => string) => void;

// The edits a user makes on the board: add, delete, move, rename, set or empty a field.
const EDITS: Record<string, Edit> = {
  add: (tree, random, nextId) => insert(tree, random, randomNode(random, nextId())),
  remove: (tree, random) => {
    const all = places(tree);
    if (all.length > 0) detach(random.pick(all));
  },
  move: (tree, random) => {
    const all = places(tree);
    if (all.length === 0) return;
    const place = random.pick(all);
    detach(place);
    insert(tree, random, place.node);
  },
  rename: (tree, random) => {
    const all = places(tree);
    if (all.length > 0) random.pick(all).node.label = `Node ${random.int(5)}`;
  },
  set: (tree, random) => {
    const all = places(tree);
    if (all.length === 0) return;
    const { node } = random.pick(all);
    const field = random.pick(FIELDS);
    if (random.int(3) === 0) delete node[field];
    else node[field] = fieldValue(random, field);
  },
};

const randomRun = (seed: number) => {
  const random = generator(seed);
  let agentIds = 0;
  let viewIds = 0;
  const sent: Tree = { columns: COLUMNS, nodes: randomList(random, 1, () => `n${++agentIds}`) };
  let edited = structuredClone(sent);
  const steps = 1 + random.int(8);
  for (let step = 0; step < steps; step += 1) {
    const before = structuredClone(edited);
    (EDITS[random.pick(Object.keys(EDITS))] as Edit)(edited, random, () => `u-${++viewIds}`);
    // The board refuses an edit past the depth limit.
    if (depthOf(edited.nodes) > TREE_MAX_DEPTH) edited = before;
  }
  return { sent, edited };
};

test(`applying the diff of ${RUNS} seeded Tree edit sequences rebuilds the edited Tree`, () => {
  const failures: string[] = [];
  const counts: Record<string, number> = { add: 0, remove: 0, move: 0, set: 0 };
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const { sent, edited } = randomRun(seed);
    if (!validateTreeProps(sent, "agent").ok) failures.push(`seed ${seed}: sent Tree invalid`);
    if (!validateTreeProps(edited, "edited").ok) failures.push(`seed ${seed}: edited Tree invalid`);
    const changes = elementChanges(ITEM, sent, edited, TREE_SHAPE);
    for (const { op } of changes) counts[op] = (counts[op] ?? 0) + 1;
    const refused = refusal(changes, sent);
    if (refused !== undefined) failures.push(`seed ${seed}: ${refused}`);
    try {
      const applied = applyElementChanges(ITEM, sent, changes, TREE_SHAPE);
      if (!Bun.deepEquals(applied, edited, true)) failures.push(`seed ${seed}: not rebuilt`);
    } catch (error) {
      failures.push(`seed ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  expect(failures).toEqual([]);
  // Every operation kind occurs often enough for the runs to mean something.
  for (const op of ["add", "remove", "move", "set"]) {
    expect({ op, enough: (counts[op] ?? 0) >= 100 }).toEqual({ op, enough: true });
  }
});
