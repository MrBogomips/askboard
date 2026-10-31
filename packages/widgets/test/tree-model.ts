// Trees and checks for the Tree model's tests (packages/widgets/src/tree/model/).

import type { TreeNode } from "@askboard/contract";

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
