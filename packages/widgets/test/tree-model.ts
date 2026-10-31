// Trees, checks and random edits for the Tree model's tests (packages/widgets/src/tree/model/).

import type { TreeNode, TreeProps } from "@askboard/contract";
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
} from "../src/tree/model/edits.ts";

/** `count` top-level leaves `n0`, `n1`, … */
export const flat = (count: number): TreeNode[] =>
  Array.from({ length: count }, (_, at) => ({ id: `n${at}`, label: `Node ${at}` }));

/** A chain of `depth` nodes, each the only child of the one before: `n1` at level 1 down to `n<depth>`. */
export const chain = (depth: number, idOf = (level: number) => `n${level}`): TreeNode[] => {
  let nodes: TreeNode[] = [];
  for (let level = depth; level >= 1; level -= 1) {
    const node = { id: idOf(level), label: `Level ${level}` };
    nodes = [nodes.length === 0 ? node : { ...node, children: nodes }];
  }
  return nodes;
};

/** Every object and array in `value`, itself included. */
export const objectsOf = (value: unknown): object[] =>
  typeof value === "object" && value !== null
    ? [value, ...Object.values(value).flatMap(objectsOf)]
    : [];

/** Whether `value` and every object and array in it are frozen. */
export const isDeepFrozen = (value: unknown): boolean =>
  objectsOf(value).every((object) => Object.isFrozen(object));

/** Every node's ID, in document order. */
export const idsOf = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) => [node.id, ...idsOf(node.children ?? [])]);

/** mulberry32, a small seeded generator, as in the contract's property tests. */
export const generator = (seed: number) => {
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
export type Random = ReturnType<typeof generator>;

// Adds weigh twice, so that sequences grow as well as shrink.
const KINDS = [
  "addAfter",
  "addAfter",
  "addChild",
  "addChild",
  "rename",
  "setField",
  "setField",
  "remove",
  "moveUp",
  "moveDown",
  "indent",
  "outdent",
] as const;
const NAMES = ["Alpha", "Beta", "Customer portal", "\u{1F600} smile", ""];

// A value for one of the Tree's fields, valid or not, an empty one included.
const randomInput = (random: Random, value: TreeProps): [string, string | number | undefined] => {
  const column = random.pick(value.columns ?? [{ field: "estimate", label: "E", type: "number" }]);
  const inputs =
    column.type === "number" ? [0, 1, 2.5, -4, undefined, "3"] : ["Sara", "Luca", "", undefined, 7];
  return [column.field, random.pick(inputs)];
};

/** One random edit of the model on `value`, as a step's description and its result. */
export const randomEdit = (random: Random, value: TreeProps): [string, TreeProps] => {
  const ids = idsOf(value.nodes);
  const nodeId = ids.length === 0 ? undefined : random.pick(ids);
  const kind = random.pick(KINDS);
  const name = random.pick(NAMES);
  if (nodeId === undefined) return [`addAfter (none) "${name}"`, addAfter(value, undefined, name)];
  const step = `${kind} ${nodeId}`;
  switch (kind) {
    case "addAfter":
      return [`${step} "${name}"`, addAfter(value, nodeId, name)];
    case "addChild":
      return [`${step} "${name}"`, addChild(value, nodeId, name)];
    case "rename":
      return [`${step} "${name}"`, rename(value, nodeId, name)];
    case "setField": {
      const [field, input] = randomInput(random, value);
      return [`${step}.${field} ${String(input)}`, setField(value, nodeId, field, input)];
    }
    case "remove":
      return [step, remove(value, nodeId)];
    case "moveUp":
      return [step, moveUp(value, nodeId)];
    case "moveDown":
      return [step, moveDown(value, nodeId)];
    case "indent":
      return [step, indent(value, nodeId)];
    case "outdent":
      return [step, outdent(value, nodeId)];
  }
};
