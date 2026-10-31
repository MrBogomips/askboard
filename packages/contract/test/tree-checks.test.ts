import { describe, expect, test } from "bun:test";
import {
  type Change,
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_TEXT_MAX_CHARS,
  type TreeNode,
  type TreeProps,
  treeChangesProblems,
  treePropsProblems,
} from "../src/index.ts";

// The Tree's checks (design decision 2): what its schemas cannot say. `treePropsProblems` runs on
// values no schema has seen, in the tree chunk, so it never throws and refuses what it cannot read.
const COLUMNS = [
  { field: "owner", label: "Owner", type: "text" },
  { field: "days", label: "Days", type: "number" },
] as const;

const sample: TreeProps = {
  columns: COLUMNS,
  nodes: [
    {
      id: "design",
      label: "Design",
      children: [
        { id: "ux", label: "UX design", owner: "Ada", days: 5 },
        { id: "architecture", label: "Architecture", days: 4 },
      ],
    },
    {
      id: "build",
      label: "Build",
      children: [
        { id: "portal", label: "Customer portal", days: 12 },
        { id: "billing", label: "Billing", days: 8 },
      ],
    },
  ],
};

const withNodes = (...nodes: unknown[]) => ({ columns: COLUMNS, nodes });

// A chain of `depth` nodes, each the only child of the one before.
const chain = (depth: number): TreeNode => {
  let node: TreeNode = { id: `n${depth}`, label: `Level ${depth}` };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { id: `n${level}`, label: `Level ${level}`, children: [node] };
  }
  return node;
};

const flat = (count: number): TreeProps => ({
  nodes: Array.from({ length: count }, (_, at) => ({ id: `n${at}`, label: `Node ${at}` })),
});

describe("treePropsProblems", () => {
  test("a valid Tree has none, from the agent and as an edited value", () => {
    expect(treePropsProblems(sample, "agent")).toEqual([]);
    expect(treePropsProblems(sample, "edited")).toEqual([]);
    expect(treePropsProblems({ nodes: [] }, "agent")).toEqual([]);
  });

  test("an undeclared field names the node's ID and the field", () => {
    const tree = withNodes({ id: "ux", label: "UX", owner: "Ada", reviewer: "Lin" });
    expect(treePropsProblems(tree, "agent")).toEqual([
      {
        path: "/nodes/0/reviewer",
        message: 'the node "ux" holds the field "reviewer", which no column declares',
      },
    ]);
    expect(
      treePropsProblems({ nodes: [{ id: "ux", label: "UX", owner: "Ada" }] }, "agent"),
    ).toEqual([
      {
        path: "/nodes/0/owner",
        message: 'the node "ux" holds the field "owner", which no column declares',
      },
    ]);
  });

  test("a value of the wrong type names the node's ID and the field", () => {
    expect(treePropsProblems(withNodes({ id: "ux", label: "UX", days: "five" }), "agent")).toEqual([
      { path: "/nodes/0/days", message: 'the field "days" of the node "ux" takes a number' },
    ]);
    const owner = (value: unknown) => withNodes({ id: "ux", label: "UX", owner: value });
    const text = `takes text of 1 to ${TREE_TEXT_MAX_CHARS} characters`;
    expect(treePropsProblems(owner(5), "agent")).toEqual([
      { path: "/nodes/0/owner", message: `the field "owner" of the node "ux" ${text}` },
    ]);
    expect(treePropsProblems(owner(""), "agent")).toHaveLength(1);
    expect(treePropsProblems(owner("x".repeat(TREE_TEXT_MAX_CHARS + 1)), "agent")).toHaveLength(1);
    expect(treePropsProblems(owner("😀".repeat(TREE_TEXT_MAX_CHARS)), "agent")).toEqual([]);
    expect(
      treePropsProblems(withNodes({ id: "ux", label: "UX", days: Number.NaN }), "agent"),
    ).toEqual([
      { path: "/nodes/0/days", message: 'the field "days" of the node "ux" takes a number' },
    ]);
  });

  test("one ID at two levels names the repeated ID", () => {
    const tree = withNodes({
      id: "design",
      label: "Design",
      children: [{ id: "ux", label: "UX", children: [{ id: "design", label: "Design again" }] }],
    });
    expect(treePropsProblems(tree, "agent")).toEqual([
      {
        path: "/nodes/0/children/0/children/0/id",
        message: 'the ID "design" is used by another node already',
      },
    ]);
  });

  test("the view's prefix is refused from the agent and accepted in an edited value", () => {
    const tree = withNodes({
      id: "build",
      label: "Build",
      children: [{ id: "u-1", label: "New" }],
    });
    expect(treePropsProblems(tree, "agent")).toEqual([
      {
        path: "/nodes/0/children/0/id",
        message: 'the ID "u-1" starts with "u-", which is reserved for IDs the board makes',
      },
    ]);
    expect(treePropsProblems(tree, "edited")).toEqual([]);
  });

  test("a repeated column field names the column and the field", () => {
    const columns = [...COLUMNS, { field: "owner", label: "Owner again", type: "number" }];
    expect(treePropsProblems({ columns, nodes: [] }, "agent")).toEqual([
      {
        path: "/columns/2/field",
        message: 'the field "owner" is declared by another column already',
      },
    ]);
  });

  test("a name is 1 to 200 characters, for nodes and columns", () => {
    const long = "x".repeat(TREE_LABEL_MAX_CHARS + 1);
    expect(treePropsProblems(withNodes({ id: "ux", label: long }), "agent")).toEqual([
      {
        path: "/nodes/0/label",
        message: `the name of the node "ux" holds ${TREE_LABEL_MAX_CHARS + 1} characters, over the limit of ${TREE_LABEL_MAX_CHARS}`,
      },
    ]);
    expect(treePropsProblems(withNodes({ id: "ux" }), "agent")).toEqual([
      { path: "/nodes/0/label", message: 'the node "ux" has no name' },
    ]);
    const column = { field: "owner", label: "", type: "text" };
    expect(treePropsProblems({ columns: [column], nodes: [] }, "agent")).toEqual([
      { path: "/columns/0/label", message: 'the column "owner" has no name' },
    ]);
  });

  test(`${TREE_MAX_NODES + 1} nodes name the limit of ${TREE_MAX_NODES}`, () => {
    expect(treePropsProblems(flat(TREE_MAX_NODES), "agent")).toEqual([]);
    expect(treePropsProblems(flat(TREE_MAX_NODES + 1), "agent")).toEqual([
      {
        path: "/nodes",
        message: `the Tree holds ${TREE_MAX_NODES + 1} nodes, over the limit of ${TREE_MAX_NODES} nodes`,
      },
    ]);
  });

  test("a node at the ninth level names the node and the limit of 8 levels", () => {
    expect(treePropsProblems({ nodes: [chain(TREE_MAX_DEPTH)] }, "agent")).toEqual([]);
    const path = `/nodes/0${"/children/0".repeat(TREE_MAX_DEPTH)}`;
    expect(treePropsProblems({ nodes: [chain(TREE_MAX_DEPTH + 2)] }, "agent")).toEqual([
      {
        path,
        message: `the node "n${TREE_MAX_DEPTH + 1}" sits at level ${TREE_MAX_DEPTH + 1}, deeper than the limit of ${TREE_MAX_DEPTH} levels`,
      },
    ]);
  });

  test.each([
    ["null", null, "/", "a Tree's props are an object"],
    ["a list", [], "/", "a Tree's props are an object"],
    ["no nodes", { columns: [] }, "/nodes", "the Tree holds no list of nodes"],
    ["nodes that are no list", { nodes: {} }, "/nodes", "the Tree holds no list of nodes"],
    ["columns that are no list", { columns: {}, nodes: [] }, "/columns", "the columns are no list"],
    [
      "a column that is no object",
      { columns: [3], nodes: [] },
      "/columns/0",
      "a column is no object",
    ],
    [
      "a column with no field",
      { columns: [{ label: "L", type: "text" }], nodes: [] },
      "/columns/0/field",
      "a column has no field",
    ],
    [
      "a column of an unknown type",
      { columns: [{ field: "due", label: "Due", type: "date" }], nodes: [] },
      "/columns/0/type",
      'the column "due" is of the type "date", where a column is text or number',
    ],
    ["a node that is no object", { nodes: ["ux"] }, "/nodes/0", "a node is no object"],
    ["a node with no ID", { nodes: [{ id: 7, label: "L" }] }, "/nodes/0/id", "a node has no ID"],
    [
      "children that are no list",
      { nodes: [{ id: "ux", label: "UX", children: "none" }] },
      "/nodes/0/children",
      'the children of the node "ux" are no list',
    ],
  ])("%s is refused, never thrown", (_, props, path, message) => {
    expect(treePropsProblems(props, "agent")).toEqual([{ path, message }]);
  });

  test("a key holding / or ~ is escaped in the problem's path", () => {
    expect(treePropsProblems(withNodes({ id: "a", label: "A", "x/y~z": 1 }), "agent")).toEqual([
      {
        path: "/nodes/0/x~1y~0z",
        message: 'the node "a" holds the field "x/y~z", which no column declares',
      },
    ]);
  });

  test("problems come in document order, columns first", () => {
    const tree = {
      columns: [...COLUMNS, { field: "days", label: "Again", type: "number" }],
      nodes: [
        { id: "a", label: "A", days: "x", children: [{ id: "u-1", label: "B" }] },
        { id: "a", label: "" },
      ],
    };
    expect(treePropsProblems(tree, "agent").map(({ path }) => path)).toEqual([
      "/columns/2/field",
      "/nodes/0/days",
      "/nodes/0/children/0/id",
      "/nodes/1/id",
      "/nodes/1/label",
    ]);
  });
});

describe("treeChangesProblems", () => {
  const check = (...changes: Change[]) => treeChangesProblems("wbs", changes, sample);
  const value = { label: "Dashboards", owner: "Ada", days: 7 };

  test("valid changes of every kind have none", () => {
    expect(
      check(
        { op: "add", target: "wbs.u-1", parent: "build", after: "portal", value },
        { op: "add", target: "wbs.u-2", value: { label: "First" } },
        { op: "remove", target: "wbs.billing" },
        { op: "move", target: "wbs.ux", parent: "build" },
        { op: "move", target: "wbs.architecture" },
        { op: "set", target: "wbs.portal.label", value: "Accounts" },
        { op: "set", target: "wbs.portal.days", value: 6.5 },
        { op: "set", target: "wbs.ux.owner", value: null },
      ),
    ).toEqual([]);
    expect(check()).toEqual([]);
  });

  test("label set to null is refused: a name is never emptied", () => {
    expect(check({ op: "set", target: "wbs.portal.label", value: null })).toEqual([
      { path: "/0/value", message: 'set "wbs.portal.label": a node\'s name cannot be emptied' },
    ]);
  });

  test("a name set to anything but text of 1 to 200 characters is refused", () => {
    const message = `set "wbs.portal.label": a name is text of 1 to ${TREE_LABEL_MAX_CHARS} characters`;
    expect(
      check(
        { op: "set", target: "wbs.portal.label", value: "" },
        { op: "set", target: "wbs.portal.label", value: 5 },
      ),
    ).toEqual([
      { path: "/0/value", message },
      { path: "/1/value", message },
    ]);
    const long = "x".repeat(TREE_LABEL_MAX_CHARS + 1);
    expect(check({ op: "add", target: "wbs.u-1", value: { label: long } })).toEqual([
      {
        path: "/0/value/label",
        message: `add "wbs.u-1": the name holds ${TREE_LABEL_MAX_CHARS + 1} characters, over the limit of ${TREE_LABEL_MAX_CHARS}`,
      },
    ]);
  });

  test.each(["children", "id"])("a set on %s names the target", (key) => {
    expect(check({ op: "set", target: `wbs.build.${key}`, value: [] })).toEqual([
      { path: "/0/target", message: `set "wbs.build.${key}": "${key}" is not a field` },
    ]);
  });

  test("a set on an undeclared field, or of the wrong type, names the operation and the field", () => {
    expect(check({ op: "set", target: "wbs.ux.reviewer", value: "Lin" })).toEqual([
      {
        path: "/0/target",
        message: 'set "wbs.ux.reviewer": no column declares the field "reviewer"',
      },
    ]);
    expect(check({ op: "set", target: "wbs.ux.days", value: "five" })).toEqual([
      { path: "/0/value", message: 'set "wbs.ux.days": the field "days" takes a number' },
    ]);
    expect(check({ op: "set", target: "wbs.ux.owner", value: 3 })).toEqual([
      {
        path: "/0/value",
        message: `set "wbs.ux.owner": the field "owner" takes text of 1 to ${TREE_TEXT_MAX_CHARS} characters`,
      },
    ]);
    const long = "x".repeat(TREE_LABEL_MAX_CHARS + 1);
    expect(check({ op: "set", target: "wbs.ux.label", value: long })).toEqual([
      {
        path: "/0/value",
        message: `set "wbs.ux.label": the name holds ${TREE_LABEL_MAX_CHARS + 1} characters, over the limit of ${TREE_LABEL_MAX_CHARS}`,
      },
    ]);
  });

  test("an add's value holds a name and declared fields of their types, never id or children", () => {
    const add = (fields: unknown): Change => ({ op: "add", target: "wbs.u-1", value: fields });
    expect(check(add({ ...value, days: "seven" }))).toEqual([
      { path: "/0/value/days", message: 'add "wbs.u-1": the field "days" takes a number' },
    ]);
    expect(check(add({ ...value, id: "u-1" }), add({ ...value, children: [] }))).toEqual([
      { path: "/0/value/id", message: 'add "wbs.u-1": "id" is not a field' },
      { path: "/1/value/children", message: 'add "wbs.u-1": "children" is not a field' },
    ]);
    expect(check(add({ ...value, reviewer: "Lin" }))).toEqual([
      {
        path: "/0/value/reviewer",
        message: 'add "wbs.u-1": no column declares the field "reviewer"',
      },
    ]);
    expect(check(add({ days: 1 }), add({ ...value, label: "" }))).toEqual([
      { path: "/0/value/label", message: 'add "wbs.u-1": the new node has no name' },
      { path: "/1/value/label", message: 'add "wbs.u-1": the new node has no name' },
    ]);
    expect(check(add("Dashboards"), add(null))).toEqual([
      { path: "/0/value", message: 'add "wbs.u-1": its value is no object' },
      { path: "/1/value", message: 'add "wbs.u-1": its value is no object' },
    ]);
  });

  test("a target with too few or too many parts names the operation", () => {
    expect(
      check(
        { op: "remove", target: "wbs" },
        { op: "move", target: "wbs.ux.label" },
        { op: "add", target: "wbs.u-1.label", value },
        { op: "set", target: "wbs.portal", value: 3 },
        { op: "set", target: "wbs.portal.days.max", value: 3 },
      ),
    ).toEqual([
      { path: "/0/target", message: 'remove "wbs": a remove targets a node, as "wbs.<node>"' },
      { path: "/1/target", message: 'move "wbs.ux.label": a move targets a node, as "wbs.<node>"' },
      {
        path: "/2/target",
        message: 'add "wbs.u-1.label": an add targets a node, as "wbs.<node>"',
      },
      {
        path: "/3/target",
        message: 'set "wbs.portal": a set targets a node\'s field, as "wbs.<node>.<field>"',
      },
      {
        path: "/4/target",
        message:
          'set "wbs.portal.days.max": a set targets a node\'s field, as "wbs.<node>.<field>"',
      },
    ]);
  });

  test("a target in another item names the operation and the Tree's item", () => {
    expect(
      check(
        { op: "set", target: "schedule.u-1.dependencies", value: ["ux"] },
        { op: "remove", target: "wbsx.ux" },
      ),
    ).toEqual([
      {
        path: "/0/target",
        message: 'set "schedule.u-1.dependencies": the target is not in the item "wbs"',
      },
      { path: "/1/target", message: 'remove "wbsx.ux": the target is not in the item "wbs"' },
    ]);
  });

  test("a Tree with no columns takes sets of the name only", () => {
    const bare: TreeProps = { nodes: [{ id: "a", label: "A" }] };
    expect(
      treeChangesProblems(
        "t",
        [
          { op: "set", target: "t.a.label", value: "B" },
          { op: "set", target: "t.a.days", value: 1 },
        ],
        bare,
      ),
    ).toEqual([
      { path: "/1/target", message: 'set "t.a.days": no column declares the field "days"' },
    ]);
  });
});
