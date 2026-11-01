// The Tree's rules that its schemas cannot say (design decision 2): IDs unique across levels, the
// view's prefix (decision 11), each field declared by a column and of its type, column fields
// unique, the node count and depth limits, and the Tree's rules on the output format's changes.
// The value rules (a name, a text or a number field) are written once here and hold for props and
// changes alike, since a change's value has no schema of its own.
//
// Plain ECMAScript with no JSON and no Ajv: the tree chunk bundles it and checks props no schema
// has seen (decision 6). So `treePropsProblems` never throws: it refuses what it cannot read as a
// Tree. Problems are E1's, at a JSON Pointer into the value, naming the node or operation.

import { VIEW_ID_PREFIX } from "../../constants.ts";
import type { Change } from "../../schemas/output/index.ts";
import type { Problem } from "../../validate.ts";
import {
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_TEXT_MAX_CHARS,
  type TreeColumnType,
  type TreeOrigin,
  type TreeProps,
} from "./index.ts";
import { treePertProblems } from "./pert.ts";

type Json = Record<string, unknown>;
type Path = readonly (string | number)[];

/** A node's own keys; every other key is a field. */
const NODE_KEYS: ReadonlySet<string> = new Set(["id", "label", "children"]);

/** The declared fields by name; `undefined` for a column whose type is refused. */
type Columns = ReadonlyMap<string, TreeColumnType | undefined>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pointer = (...parts: Path): string =>
  parts.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

const isName = (value: unknown): value is string => typeof value === "string" && value !== "";

// A length in code points, as JSON Schema counts it.
const overLimit = (text: string, limit: number): string | undefined => {
  const length = [...text].length;
  return length > limit ? `holds ${length} characters, over the limit of ${limit}` : undefined;
};

/** What is wrong with a field's value for a column of `type`, or `undefined`. */
const valueFault = (type: TreeColumnType, value: unknown): string | undefined => {
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? undefined : "takes a number";
  }
  if (!isName(value)) return `takes text of 1 to ${TREE_TEXT_MAX_CHARS} characters`;
  return overLimit(value, TREE_TEXT_MAX_CHARS);
};

// A name is text of 1 to 200 characters; `whose` names its node or column.
const nameProblems = (label: unknown, path: Path, whose: string): Problem[] => {
  if (!isName(label)) return [{ path: pointer(...path), message: `${whose} has no name` }];
  const over = overLimit(label, TREE_LABEL_MAX_CHARS);
  return over === undefined
    ? []
    : [{ path: pointer(...path), message: `the name of ${whose} ${over}` }];
};

const isColumnType = (type: unknown): type is TreeColumnType =>
  type === "text" || type === "number";

// One column's problems, adding its field to `columns` unless another column declared it first.
const columnProblems = (
  column: unknown,
  at: number,
  columns: Map<string, TreeColumnType | undefined>,
): Problem[] => {
  if (!isObject(column))
    return [{ path: pointer("columns", at), message: "a column is no object" }];
  const { field, label, type } = column;
  if (typeof field !== "string") {
    return [{ path: pointer("columns", at, "field"), message: "a column has no field" }];
  }
  const problems = nameProblems(label, ["columns", at, "label"], `the column "${field}"`);
  if (!isColumnType(type)) {
    const message = `the column "${field}" is of the type ${JSON.stringify(type ?? null)}, where a column is text or number`;
    problems.push({ path: pointer("columns", at, "type"), message });
  }
  if (columns.has(field)) {
    const message = `the field "${field}" is declared by another column already`;
    problems.push({ path: pointer("columns", at, "field"), message });
  } else {
    columns.set(field, isColumnType(type) ? type : undefined);
  }
  return problems;
};

type Walk = {
  readonly origin: TreeOrigin;
  readonly columns: Columns;
  readonly seen: Set<string>;
  readonly problems: Problem[];
  count: number;
};

const idProblems = (walk: Walk, id: string, path: Path): Problem[] => {
  const problems: Problem[] = [];
  if (walk.seen.has(id)) {
    const message = `the ID "${id}" is used by another node already`;
    problems.push({ path: pointer(...path, "id"), message });
  }
  walk.seen.add(id);
  if (walk.origin === "agent" && id.startsWith(VIEW_ID_PREFIX)) {
    const message = `the ID "${id}" starts with "${VIEW_ID_PREFIX}", which is reserved for IDs the board makes`;
    problems.push({ path: pointer(...path, "id"), message });
  }
  return problems;
};

const fieldProblems = (columns: Columns, node: Json, id: string, path: Path): Problem[] =>
  Object.entries(node).flatMap(([field, value]): Problem[] => {
    if (NODE_KEYS.has(field)) return [];
    if (!columns.has(field)) {
      const message = `the node "${id}" holds the field "${field}", which no column declares`;
      return [{ path: pointer(...path, field), message }];
    }
    const type = columns.get(field);
    const fault = type === undefined ? undefined : valueFault(type, value);
    const message = `the field "${field}" of the node "${id}" ${fault}`;
    return fault === undefined ? [] : [{ path: pointer(...path, field), message }];
  });

// Checks the nodes in document order; below a node past the depth limit, nothing more.
const walkNodes = (walk: Walk, list: readonly unknown[], level: number, at: Path): void => {
  list.forEach((node, index) => {
    const path = [...at, index];
    walk.count += 1;
    if (!isObject(node)) {
      walk.problems.push({ path: pointer(...path), message: "a node is no object" });
      return;
    }
    const { id, label, children } = node;
    if (typeof id !== "string") {
      walk.problems.push({ path: pointer(...path, "id"), message: "a node has no ID" });
      return;
    }
    walk.problems.push(
      ...idProblems(walk, id, path),
      ...nameProblems(label, [...path, "label"], `the node "${id}"`),
      ...fieldProblems(walk.columns, node, id, path),
    );
    if (level > TREE_MAX_DEPTH) {
      const message = `the node "${id}" sits at level ${level}, deeper than the limit of ${TREE_MAX_DEPTH} levels`;
      walk.problems.push({ path: pointer(...path), message });
      return;
    }
    if (children === undefined) return;
    if (!Array.isArray(children)) {
      const message = `the children of the node "${id}" are no list`;
      walk.problems.push({ path: pointer(...path, "children"), message });
      return;
    }
    walkNodes(walk, children, level + 1, [...path, "children"]);
  });
};

/**
 * What a schema cannot say about a Tree's props: IDs unique across levels; the view's prefix `u-`
 * refused from the agent and accepted in an edited value; each field declared by a column and of
 * its type; names and text within their limits; column fields unique; at most 500 nodes and 8
 * levels. Never throws: anything it cannot read as a Tree is a problem.
 */
export const treePropsProblems = (props: unknown, origin: TreeOrigin): Problem[] => {
  if (!isObject(props)) return [{ path: "/", message: "a Tree's props are an object" }];
  const problems: Problem[] = [];
  const columns = new Map<string, TreeColumnType | undefined>();
  if (Array.isArray(props.columns)) {
    props.columns.forEach((column: unknown, at) => {
      problems.push(...columnProblems(column, at, columns));
    });
  } else if (props.columns !== undefined) {
    problems.push({ path: "/columns", message: "the columns are no list" });
  }
  problems.push(...treePertProblems(props, columns));
  if (!Array.isArray(props.nodes)) {
    return [...problems, { path: "/nodes", message: "the Tree holds no list of nodes" }];
  }
  const walk: Walk = { origin, columns, seen: new Set(), problems, count: 0 };
  walkNodes(walk, props.nodes, 1, ["nodes"]);
  if (walk.count > TREE_MAX_NODES) {
    const message = `the Tree holds ${walk.count} nodes, over the limit of ${TREE_MAX_NODES} nodes`;
    problems.push({ path: "/nodes", message });
  }
  return problems;
};

/** Makes a problem of one change, its message naming the operation. */
type Problemer = (message: string, ...path: Path) => Problem;

const setProblems = (
  field: string,
  value: unknown,
  columns: Columns,
  problem: Problemer,
): Problem[] => {
  if (field === "label") {
    if (value === null) return [problem("a node's name cannot be emptied", "value")];
    if (!isName(value)) {
      return [problem(`a name is text of 1 to ${TREE_LABEL_MAX_CHARS} characters`, "value")];
    }
    const over = overLimit(value, TREE_LABEL_MAX_CHARS);
    return over === undefined ? [] : [problem(`the name ${over}`, "value")];
  }
  if (NODE_KEYS.has(field)) return [problem(`"${field}" is not a field`, "target")];
  const type = columns.get(field);
  if (type === undefined) return [problem(`no column declares the field "${field}"`, "target")];
  const fault = value === null ? undefined : valueFault(type, value);
  return fault === undefined ? [] : [problem(`the field "${field}" ${fault}`, "value")];
};

const addedFieldProblems = (
  field: string,
  value: unknown,
  columns: Columns,
  problem: Problemer,
) => {
  if (field === "label") {
    const over = isName(value) ? overLimit(value, TREE_LABEL_MAX_CHARS) : undefined;
    return over === undefined ? [] : [problem(`the name ${over}`, "value", field)];
  }
  if (NODE_KEYS.has(field)) return [problem(`"${field}" is not a field`, "value", field)];
  const type = columns.get(field);
  if (type === undefined) {
    return [problem(`no column declares the field "${field}"`, "value", field)];
  }
  const fault = valueFault(type, value);
  return fault === undefined ? [] : [problem(`the field "${field}" ${fault}`, "value", field)];
};

const addProblems = (value: unknown, columns: Columns, problem: Problemer): Problem[] => {
  if (!isObject(value)) return [problem("its value is no object", "value")];
  const problems = isName(value.label)
    ? []
    : [problem("the new node has no name", "value", "label")];
  for (const [field, fieldValue] of Object.entries(value)) {
    problems.push(...addedFieldProblems(field, fieldValue, columns, problem));
  }
  return problems;
};

// The Tree's rules on one change, at index `at` of the changes.
const changeProblems = (itemId: string, change: Change, at: number, columns: Columns) => {
  const problem: Problemer = (message, ...path) => ({
    path: pointer(at, ...path),
    message: `${change.op} "${change.target}": ${message}`,
  });
  const [item, node, field, ...rest] = change.target.split(".");
  if (item !== itemId) return [problem(`the target is not in the item "${itemId}"`, "target")];
  if (change.op === "set") {
    if (field === undefined || rest.length > 0) {
      return [problem(`a set targets a node's field, as "${itemId}.<node>.<field>"`, "target")];
    }
    return setProblems(field, change.value, columns, problem);
  }
  if (node === undefined || field !== undefined) {
    const article = change.op === "add" ? "an" : "a";
    return [problem(`${article} ${change.op} targets a node, as "${itemId}.<node>"`, "target")];
  }
  return change.op === "add" ? addProblems(change.value, columns, problem) : [];
};

/**
 * The Tree's rules on the output format's changes, for the Tree `itemId` whose props were sent as
 * `props`: every target is in the item; `add`, `remove` and `move` target `item.node`, `set`
 * targets `item.node.field`; an `add`'s value holds a name and declared fields of their types,
 * never `id` or `children`; a `set`'s field is `label` or a declared one, with a value of its type,
 * or `null` to empty it, never the name.
 */
export const treeChangesProblems = (
  itemId: string,
  changes: readonly Change[],
  props: TreeProps,
): Problem[] => {
  const columns: Columns = new Map((props.columns ?? []).map(({ field, type }) => [field, type]));
  return changes.flatMap((change, at) => changeProblems(itemId, change, at, columns));
};
