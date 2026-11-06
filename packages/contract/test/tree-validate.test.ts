import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type Change,
  SCHEMA_IDS,
  SCHEMA_SETS,
  TREE_MAX_DEPTH,
  type TreeProps,
} from "../src/index.ts";
import { validateAgainst, validateTreeChanges, validateTreeProps } from "../src/validate.ts";

// The Tree's validators (design decision 2): each the widget validator of its schema, then the
// Tree's checks, returning E1's `Checked` with problems in E1's shape.
const PROPS = "urn:askboard:input:tree-props";
const CHANGES = "urn:askboard:output:tree-changes";

const unknownToE1 = (id: string) => () => validateAgainst(id, {});

// Since widget-answers (task 1.1) both schemas are set parts, so the contract's shared validator
// knows them from the start and the widget validators run against the same schemas.
describe("the contract's shared validator (spec, Widget schemas in the schema sets)", () => {
  test("knows both $ids, and the sets and SCHEMA_IDS list them", () => {
    for (const id of [PROPS, CHANGES]) {
      expect(unknownToE1(id)).not.toThrow();
    }
    expect(validateTreeProps({ nodes: [] }, "agent").ok).toBe(true);
    expect(validateTreeChanges("wbs", [], { nodes: [] }).ok).toBe(true);
    const ids = SCHEMA_SETS.flatMap((set) => set.schemas.map((s) => (s as { $id: string }).$id));
    expect(ids).toContain(PROPS);
    expect(ids).toContain(CHANGES);
    expect(Object.values(SCHEMA_IDS)).toContain(PROPS);
    expect(Object.values(SCHEMA_IDS)).toContain(CHANGES);
  });
});

const props: TreeProps = {
  columns: [
    { field: "owner", label: "Owner", type: "text" },
    { field: "days", label: "Days", type: "number" },
  ],
  nodes: [
    {
      id: "design",
      label: "Design",
      children: [{ id: "ux", label: "UX design", owner: "Ada", days: 5 }],
    },
    { id: "build", label: "Build", children: [{ id: "portal", label: "Portal", days: 12 }] },
  ],
};

describe("validateTreeProps", () => {
  test("passes a valid Tree, returning it", () => {
    expect(validateTreeProps(props, "agent")).toEqual({ ok: true, value: props });
  });

  test("a schema problem comes in E1's shape, before any check runs", () => {
    const tree = { ...props, nodes: [{ id: "ux", label: "UX", Owner: "Ada", days: "five" }] };
    expect(validateTreeProps(tree, "agent")).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/nodes/0/Owner", message: 'unknown field "Owner"' }],
    });
  });

  test.each(["children", "Owner", "A1"])(
    "a column declaring the field %s fails, naming the column's field",
    (field) => {
      const tree = { columns: [{ field, label: "F", type: "text" }], nodes: [] };
      const checked = validateTreeProps(tree, "agent");
      expect(checked.ok).toBe(false);
      expect(checked.ok ? [] : checked.problems.map(({ path }) => path)).toEqual([
        "/columns/0/field",
      ]);
    },
  );

  test("then the checks: an undeclared field names the node's ID and the field", () => {
    const tree = { nodes: [{ id: "ux", label: "UX", owner: "Ada" }] };
    expect(validateTreeProps(tree, "agent")).toEqual({
      ok: false,
      reason: "schema",
      problems: [
        {
          path: "/nodes/0/owner",
          message: 'the node "ux" holds the field "owner", which no column declares',
        },
      ],
    });
  });

  test("a value of the wrong type names the node's ID and the field", () => {
    const tree = { ...props, nodes: [{ id: "ux", label: "UX", days: "five" }] };
    expect(validateTreeProps(tree, "agent")).toMatchObject({
      ok: false,
      problems: [
        { path: "/nodes/0/days", message: 'the field "days" of the node "ux" takes a number' },
      ],
    });
  });

  test("one ID at two levels names the repeated ID", () => {
    const tree = {
      nodes: [
        {
          id: "design",
          label: "Design",
          children: [{ id: "ux", label: "UX", children: [{ id: "design", label: "Again" }] }],
        },
      ],
    };
    expect(validateTreeProps(tree, "edited")).toMatchObject({
      ok: false,
      problems: [{ message: 'the ID "design" is used by another node already' }],
    });
  });

  test("the agent's u-1 is refused; the user's u-1 passes as an edited value", () => {
    const tree = {
      nodes: [{ id: "build", label: "Build", children: [{ id: "u-1", label: "New" }] }],
    };
    expect(validateTreeProps(tree, "agent")).toMatchObject({
      ok: false,
      problems: [
        {
          path: "/nodes/0/children/0/id",
          message: 'the ID "u-1" starts with "u-", which is reserved for IDs the board makes',
        },
      ],
    });
    expect(validateTreeProps(tree, "edited")).toEqual({ ok: true, value: tree as TreeProps });
  });

  test("too deep and too many name their limits", () => {
    let node: TreeProps["nodes"][number] = { id: "leaf", label: "Leaf" };
    for (let level = TREE_MAX_DEPTH; level >= 1; level -= 1) {
      node = { id: `n${level}`, label: `Level ${level}`, children: [node] };
    }
    expect(validateTreeProps({ nodes: [node] }, "agent")).toMatchObject({
      ok: false,
      problems: [{ message: expect.stringContaining('"leaf" sits at level 9') }],
    });
    const nodes = Array.from({ length: 501 }, (_, at) => ({ id: `n${at}`, label: "N" }));
    expect(validateTreeProps({ nodes }, "agent")).toMatchObject({
      ok: false,
      problems: [{ path: "/nodes", message: expect.stringContaining("the limit of 500 nodes") }],
    });
  });
});

describe("validateTreeChanges", () => {
  test("passes valid changes, returning them, and an empty list", () => {
    const changes: Change[] = [
      { op: "add", target: "wbs.u-1", value: { label: "First" } },
      { op: "move", target: "wbs.portal", parent: "design", after: "ux" },
      { op: "set", target: "wbs.ux.days", value: null },
    ];
    expect(validateTreeChanges("wbs", changes, props)).toEqual({ ok: true, value: changes });
    expect(validateTreeChanges("wbs", [], props)).toEqual({ ok: true, value: [] });
  });

  test("an add first at the top level, with neither parent nor after, passes", () => {
    const changes = [{ op: "add", target: "wbs.u-1", value: { label: "First" } }];
    expect(validateTreeChanges("wbs", changes, props).ok).toBe(true);
  });

  test.each([
    ["add", "parent"],
    ["add", "after"],
    ["move", "parent"],
    ["move", "after"],
  ])("an %s whose %s is null fails, naming the field", (op, key) => {
    const value = op === "add" ? { value: { label: "New" } } : {};
    const checked = validateTreeChanges(
      "wbs",
      [{ op, target: "wbs.u-1", ...value, [key]: null }],
      props,
    );
    expect(checked.ok).toBe(false);
    expect(checked.ok ? [] : checked.problems.map(({ path }) => path)).toContain(`/0/${key}`);
  });

  test("a set on the children names the target", () => {
    const changes = [{ op: "set", target: "wbs.build.children", value: [] }];
    expect(validateTreeChanges("wbs", changes, props)).toEqual({
      ok: false,
      reason: "schema",
      problems: [
        { path: "/0/target", message: 'set "wbs.build.children": "children" is not a field' },
      ],
    });
  });

  test("a schema problem comes first, in E1's shape", () => {
    expect(validateTreeChanges("wbs", [{ op: "set", target: "wbs.ux" }], props)).toEqual({
      ok: false,
      reason: "schema",
      problems: expect.arrayContaining([{ path: "/0/value", message: 'missing field "value"' }]),
    });
    expect(validateTreeChanges("wbs", { op: "remove" }, props)).toMatchObject({
      ok: false,
      problems: [{ path: "/" }],
    });
  });
});

describe("the checks module the tree chunk bundles (design, Risks / Trade-offs)", () => {
  test("carries no schema and no Ajv when bundled", async () => {
    const entry = join(import.meta.dir, "../src/widgets/tree/checks.ts");
    const built = await Bun.build({ entrypoints: [entry], target: "browser" });
    expect(built.success).toBe(true);
    const code = (await Promise.all(built.outputs.map((output) => output.text()))).join("\n");
    expect(code).toContain("treePropsProblems");
    expect(code).not.toContain("urn:askboard");
    expect(code.toLowerCase()).not.toContain("ajv");
  });
});
