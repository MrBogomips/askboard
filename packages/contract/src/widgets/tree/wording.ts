// How a request's wording reads a Tree's props (widget-answers, design decision 4; widget-registry,
// design decision 5): the expected shape and the field list of each of its objects, keyed
// `tree.props.nodes[].label`, how a path folds into such a key and which node a path is in. Moved
// here from `widgets/wording.ts` and `widgets/paths.ts`, word for word. Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  TREE_FIELD_PATTERN,
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_COLUMNS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_TEXT_MAX_CHARS,
} from "./index.ts";

export const TREE_EXPECTED: Readonly<Record<string, string>> = {
  "tree.props": "a Tree's props {columns?, nodes, pert?, openDepth?}",
  "tree.props.columns": `a list of at most ${TREE_MAX_COLUMNS} columns, each {field, label, type}`,
  "tree.props.columns[]": "a column {field, label, type}",
  "tree.props.columns[].field": `a field name matching ${TREE_FIELD_PATTERN}, never id, label or children, unique among the columns`,
  "tree.props.columns[].label": text(TREE_LABEL_MAX_CHARS),
  "tree.props.columns[].type": '"text" or "number"',
  "tree.props.nodes": `a list of nodes, at most ${TREE_MAX_NODES} in all and ${TREE_MAX_DEPTH} levels deep`,
  "tree.props.nodes[]": "a node {id, label, children?} with a value for each column field it has",
  "tree.props.nodes[].id": `${ID_SHAPE}, unique among the Tree's nodes at every level`,
  "tree.props.nodes[].label": text(TREE_LABEL_MAX_CHARS),
  "tree.props.nodes[].children": "a non-empty list of nodes",
  "tree.props.nodes[].{field}": `a value for a field a column declares: text of 1 to ${TREE_TEXT_MAX_CHARS} characters for a text column, a number for a number column`,
  "tree.props.pert":
    "true, on a Tree whose columns declare optimistic, mostLikely and pessimistic as numbers",
  "tree.props.openDepth": `a whole number of 1 to ${TREE_MAX_DEPTH}, with pert only`,
};

export const TREE_FIELDS: Readonly<Record<string, string>> = {
  "tree.props": "a Tree's props hold only columns, nodes, pert and openDepth",
  "tree.props.columns[]": "a column holds only field, label and type",
  "tree.props.nodes[]": "a node holds only id, label, children and the fields its columns declare",
};

const NODE_KEYS: readonly string[] = ["id", "label", "children"];

/**
 * A Tree's path with each level of children folded into its node, and a column field's name as
 * `{field}`: `props.nodes[0].children[1].cost` reads as `props.nodes[0].cost`'s key.
 */
export const treeRest = (rest: Segments): Segments => {
  if (rest[1] !== "nodes" || !isIndex(rest[2])) return rest;
  const head = rest.slice(0, 3);
  let tail = rest.slice(3);
  while (tail[0] === "children" && isIndex(tail[1])) tail = tail.slice(2);
  const [field] = tail;
  return field !== undefined && !NODE_KEYS.includes(field) && !isIndex(field)
    ? [...head, "{field}"]
    : [...head, ...tail];
};

/** The innermost node a path from a Tree item reaches, by its ID, worded `node "ux"`. */
export const treeElementOf = (item: unknown, rest: Segments): string | undefined => {
  if (!isRecord(item) || rest[1] !== "nodes") return undefined;
  let list = isRecord(item.props) ? item.props.nodes : undefined;
  let found: string | undefined;
  let at = 2;
  while (Array.isArray(list) && isIndex(rest[at])) {
    const node: unknown = list[Number(rest[at])];
    if (!isRecord(node)) break;
    if (typeof node.id === "string") found = node.id;
    if (rest[at + 1] !== "children" || !isIndex(rest[at + 2])) break;
    list = node.children;
    at += 2;
  }
  return found === undefined ? undefined : `node "${found}"`;
};
