import { describe, expect, test } from "bun:test";
import { SCHEMA_IDS, SCHEMA_SETS } from "../src/index.ts";
import { createAjv, type Problem, problemOf } from "../src/validate.ts";
import {
  TREE_FIELD_PATTERN,
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_COLUMNS,
  TREE_TEXT_MAX_CHARS,
} from "../src/widgets/tree/index.ts";
import treeChanges from "../src/widgets/tree/tree-changes.json" with { type: "json" };
import treeProps from "../src/widgets/tree/tree-props.json" with { type: "json" };

// The Tree's standalone schemas (design decision 2), compiled in strict mode in an Ajv made by
// `createAjv()`, which holds E1's ID schema and answer event. They belong to no set yet, so the
// Consistency Conventions' shape rules are checked here directly, not through `schemaSetProblems`.
const PROPS = "urn:askboard:input:tree-props";
const CHANGES = "urn:askboard:output:tree-changes";
const CHANGE = "urn:askboard:output:answer-event#/$defs/change";
const DIALECT = "https://json-schema.org/draft/2020-12/schema";

type Json = Record<string, unknown>;

const ajv = createAjv();

const problemsOf = (id: string, value: unknown): Problem[] => {
  const validate = ajv.getSchema(id);
  if (validate === undefined) throw new Error(`no schema ${id}`);
  return validate(value) ? [] : (validate.errors ?? []).map(problemOf);
};
const pathsOf = (id: string, value: unknown) => problemsOf(id, value).map(({ path }) => path);

const COLUMNS = [
  { field: "owner", label: "Owner", type: "text" },
  { field: "days", label: "Days", type: "number" },
];
const nested = {
  columns: COLUMNS,
  nodes: [
    {
      id: "design",
      label: "Design",
      children: [
        { id: "ux", label: "UX design", owner: "Ada", days: 5 },
        { id: "ui", label: "UI", children: [{ id: "icons", label: "Icons", days: 0.5 }] },
      ],
    },
    { id: "build", label: "Build", owner: "Lin" },
  ],
};
const withNode = (node: Record<string, unknown>) => ({ columns: COLUMNS, nodes: [node] });
const withColumn = (column: Record<string, unknown>) => ({ columns: [column], nodes: [] });

describe("the Tree's schemas (design decision 2)", () => {
  test("both compile in strict mode beside E1's schemas", () => {
    expect(ajv.opts.strict).toBe(true);
    expect(typeof ajv.getSchema(PROPS)).toBe("function");
    expect(typeof ajv.getSchema(CHANGES)).toBe("function");
  });

  test("each is JSON Schema 2020-12 with its $id in its future set's namespace", () => {
    expect(treeProps.$schema).toBe(DIALECT);
    expect(treeChanges.$schema).toBe(DIALECT);
    expect(treeProps.$id).toBe(PROPS);
    expect(treeChanges.$id).toBe(CHANGES);
    expect(treeProps.$id.startsWith("urn:askboard:input:")).toBe(true);
    expect(treeChanges.$id.startsWith("urn:askboard:output:")).toBe(true);
  });

  test.each(["oneOf", "anyOf", "allOf"])("neither has a root %s", (keyword) => {
    expect(keyword in treeProps).toBe(false);
    expect(keyword in treeChanges).toBe(false);
  });

  test("the changes are an array whose items are only the output format's change", () => {
    expect(treeChanges.type).toBe("array");
    expect(treeChanges.items).toEqual({ $ref: CHANGE });
    expect("minItems" in treeChanges).toBe(false);
  });

  test("the sets and SCHEMA_IDS hold both $ids since widget-answers", () => {
    const ids = SCHEMA_SETS.flatMap((set) => set.schemas.map((schema) => (schema as Json).$id));
    expect(ids).toContain(PROPS);
    expect(ids).toContain(CHANGES);
    expect(Object.values(SCHEMA_IDS)).toContain(PROPS);
    expect(Object.values(SCHEMA_IDS)).toContain(CHANGES);
  });

  test("the schema states the contract's limits and field pattern", () => {
    const { column, node, value } = treeProps.$defs;
    expect(treeProps.properties.columns.maxItems).toBe(TREE_MAX_COLUMNS);
    expect(column.properties.label.maxLength).toBe(TREE_LABEL_MAX_CHARS);
    expect(node.properties.label.maxLength).toBe(TREE_LABEL_MAX_CHARS);
    expect(value.anyOf[0]?.maxLength).toBe(TREE_TEXT_MAX_CHARS);
    const reserved = `^(?!(?:id|label|children)$)${TREE_FIELD_PATTERN.slice(1)}`;
    expect(column.properties.field.pattern).toBe(reserved);
    expect(Object.keys(node.patternProperties)).toEqual([reserved]);
  });
});

describe("tree-props", () => {
  test("a nested Tree validates, and a Tree with no columns or no nodes", () => {
    expect(problemsOf(PROPS, nested)).toEqual([]);
    expect(problemsOf(PROPS, { nodes: [{ id: "a", label: "A" }] })).toEqual([]);
    expect(problemsOf(PROPS, { columns: [], nodes: [] })).toEqual([]);
  });

  test("an unknown key fails, naming it, at every level", () => {
    expect(problemsOf(PROPS, { ...nested, title: "Plan" })).toEqual([
      { path: "/title", message: 'unknown field "title"' },
    ]);
    expect(problemsOf(PROPS, withColumn({ ...COLUMNS[0], width: 3 }))).toEqual([
      { path: "/columns/0/width", message: 'unknown field "width"' },
    ]);
    for (const key of ["Owner", "A1", "owner-name", "_x"]) {
      expect(problemsOf(PROPS, withNode({ id: "a", label: "A", [key]: "x" }))).toEqual([
        { path: `/nodes/0/${key}`, message: `unknown field "${key}"` },
      ]);
    }
  });

  test("a missing key fails, naming it", () => {
    expect(problemsOf(PROPS, { columns: COLUMNS })).toEqual([
      { path: "/nodes", message: 'missing field "nodes"' },
    ]);
    expect(problemsOf(PROPS, withNode({ id: "a" }))).toEqual([
      { path: "/nodes/0/label", message: 'missing field "label"' },
    ]);
    expect(problemsOf(PROPS, withColumn({ field: "owner", label: "Owner" }))).toEqual([
      { path: "/columns/0/type", message: 'missing field "type"' },
    ]);
  });

  test.each(["children", "id", "label", "Owner", "A1", "1st", "owner_name", `a${"b".repeat(64)}`])(
    "a column declaring the field %s fails, naming the column's field",
    (field) => {
      expect(pathsOf(PROPS, withColumn({ field, label: "F", type: "text" }))).toEqual([
        "/columns/0/field",
      ]);
    },
  );

  test.each(["a", "mostLikely", "x9", `a${"B".repeat(63)}`])(
    "the field %s is accepted",
    (field) => {
      const tree = { columns: [{ field, label: "F", type: "number" }], nodes: [] };
      expect(problemsOf(PROPS, tree)).toEqual([]);
      expect(problemsOf(PROPS, withNode({ id: "n", label: "N", [field]: 1 }))).toEqual([]);
    },
  );

  test("a column type other than text or number fails", () => {
    expect(pathsOf(PROPS, withColumn({ field: "due", label: "Due", type: "date" }))).toEqual([
      "/columns/0/type",
    ]);
  });

  test("a ninth column fails, naming the columns", () => {
    const columns = Array.from({ length: TREE_MAX_COLUMNS + 1 }, (_, at) => ({
      field: `f${at}`,
      label: `F${at}`,
      type: "number",
    }));
    expect(pathsOf(PROPS, { columns: columns.slice(0, -1), nodes: [] })).toEqual([]);
    expect(pathsOf(PROPS, { columns, nodes: [] })).toEqual(["/columns"]);
  });

  test("a name is 1 to 200 characters, counted as code points", () => {
    const name = (length: number) => withNode({ id: "a", label: "x".repeat(length) });
    expect(pathsOf(PROPS, name(TREE_LABEL_MAX_CHARS))).toEqual([]);
    expect(pathsOf(PROPS, withNode({ id: "a", label: "😀".repeat(TREE_LABEL_MAX_CHARS) }))).toEqual(
      [],
    );
    expect(pathsOf(PROPS, name(TREE_LABEL_MAX_CHARS + 1))).toEqual(["/nodes/0/label"]);
    expect(pathsOf(PROPS, name(0))).toEqual(["/nodes/0/label"]);
    const label = "x".repeat(TREE_LABEL_MAX_CHARS + 1);
    expect(pathsOf(PROPS, withColumn({ field: "f", label, type: "text" }))).toEqual([
      "/columns/0/label",
    ]);
  });

  test("a text field is 1 to 1,000 characters, a number field any number", () => {
    const owner = (value: unknown) => withNode({ id: "a", label: "A", owner: value });
    expect(pathsOf(PROPS, owner("x".repeat(TREE_TEXT_MAX_CHARS)))).toEqual([]);
    expect(pathsOf(PROPS, owner(-12.5))).toEqual([]);
    expect(pathsOf(PROPS, owner("x".repeat(TREE_TEXT_MAX_CHARS + 1)))).toContain("/nodes/0/owner");
    expect(pathsOf(PROPS, owner(""))).toContain("/nodes/0/owner");
    expect(pathsOf(PROPS, owner(null))).toContain("/nodes/0/owner");
    expect(pathsOf(PROPS, owner(true))).toContain("/nodes/0/owner");
    expect(pathsOf(PROPS, owner(["a"]))).toContain("/nodes/0/owner");
  });

  test("a node ID follows E1's ID schema", () => {
    expect(pathsOf(PROPS, withNode({ id: "a.b", label: "A" }))).toEqual(["/nodes/0/id"]);
    expect(pathsOf(PROPS, withNode({ id: "x".repeat(65), label: "A" }))).toEqual(["/nodes/0/id"]);
  });

  test("a children list holds at least one node, since a leaf holds none", () => {
    expect(pathsOf(PROPS, withNode({ id: "a", label: "A", children: [] }))).toEqual([
      "/nodes/0/children",
    ]);
    const deep = withNode({ id: "a", label: "A", children: [{ id: "b", label: "B", X: 1 }] });
    expect(problemsOf(PROPS, deep)).toEqual([
      { path: "/nodes/0/children/0/X", message: 'unknown field "X"' },
    ]);
  });
});

describe("tree-changes", () => {
  const value = { label: "Dashboards", days: 7 };

  test("each operation kind validates", () => {
    const changes = [
      { op: "add", target: "wbs.u-1", parent: "build", after: "portal", value },
      { op: "remove", target: "wbs.reporting" },
      { op: "move", target: "wbs.billing", parent: "design", after: "ux" },
      { op: "set", target: "wbs.portal.label", value: "Accounts" },
      { op: "set", target: "wbs.portal.days", value: null },
    ];
    expect(problemsOf(CHANGES, changes)).toEqual([]);
    expect(problemsOf(CHANGES, [])).toEqual([]);
  });

  test("an add or a move without parent and after validates", () => {
    expect(problemsOf(CHANGES, [{ op: "add", target: "wbs.u-1", value }])).toEqual([]);
    expect(problemsOf(CHANGES, [{ op: "move", target: "wbs.ux" }])).toEqual([]);
  });

  test.each([
    ["add", "parent"],
    ["add", "after"],
    ["move", "parent"],
    ["move", "after"],
  ])("an %s whose %s is null fails, naming the field", (op, key) => {
    const change = { op, target: "wbs.u-1", ...(op === "add" ? { value } : {}), [key]: null };
    expect(pathsOf(CHANGES, [change])).toContain(`/0/${key}`);
  });

  test("an operation the output format does not know fails", () => {
    expect(pathsOf(CHANGES, [{ op: "rename", target: "wbs.ux", value: "UX" }])).not.toEqual([]);
    expect(pathsOf(CHANGES, { op: "remove", target: "wbs.ux" })).toEqual(["/"]);
  });
});
