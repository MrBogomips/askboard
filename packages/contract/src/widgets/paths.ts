// How a path in a widget item's props reads: the key of its wording (`tree.props.nodes[].label`)
// and the element it is in (`node "ux"`, `task "t1"`). Pure functions of the path and the item, with
// no import of the request checks, so that `ask-items.ts` can use them (widget-answers, design
// decision 4).

import type { Segments } from "../problems.ts";

const isIndex = (segment: string | undefined): boolean =>
  segment !== undefined && /^(0|[1-9][0-9]*)$/.test(segment);

const NODE_KEYS: readonly string[] = ["id", "label", "children"];

// A Tree's path with each level of children folded into its node, and a column field's name
// as `{field}`: `props.nodes[0].children[1].cost` reads as `props.nodes[0].cost`'s key.
const treeRest = (rest: Segments): Segments => {
  if (rest[1] !== "nodes" || !isIndex(rest[2])) return rest;
  const head = rest.slice(0, 3);
  let tail = rest.slice(3);
  while (tail[0] === "children" && isIndex(tail[1])) tail = tail.slice(2);
  const [field] = tail;
  return field !== undefined && !NODE_KEYS.includes(field) && !isIndex(field)
    ? [...head, "{field}"]
    : [...head, ...tail];
};

/**
 * The path of a widget item's field as its wording key reads it: a map key of a plan's tasks is
 * `{task}`, a column field of a node is `{field}` and the levels of a Tree's children fold away.
 * Any other item type keeps its path.
 */
export const widgetRest = (type: string, rest: Segments): Segments => {
  if (type === "tree") return treeRest(rest);
  if (type === "gantt" && rest[1] === "tasks" && rest.length > 2 && !isIndex(rest[2])) {
    return [rest[0] as string, "tasks", "{task}", ...rest.slice(3)];
  }
  return rest;
};

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The innermost node a path from a Tree item reaches, by its ID.
const nodeOf = (props: unknown, rest: Segments): string | undefined => {
  let list = isRecord(props) ? props.nodes : undefined;
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

/**
 * The element of a widget item a path from the item is in, worded as `node "ux"` or `task "t1"`,
 * when the path enters one that has an ID; undefined otherwise.
 */
export const elementOf = (item: unknown, rest: Segments): string | undefined => {
  if (!isRecord(item) || rest[0] !== "props" || rest.length < 3) return undefined;
  if (item.type === "tree" && rest[1] === "nodes") return nodeOf(item.props, rest);
  if (item.type !== "gantt" || rest[1] !== "tasks") return undefined;
  if (!isIndex(rest[2])) return `task "${rest[2]}"`;
  const tasks = isRecord(item.props) ? item.props.tasks : undefined;
  const task: unknown = Array.isArray(tasks) ? tasks[Number(rest[2])] : undefined;
  return isRecord(task) && typeof task.id === "string" ? `task "${task.id}"` : undefined;
};
