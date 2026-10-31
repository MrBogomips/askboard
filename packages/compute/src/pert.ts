// PERT (FR-15, AD-13): a WBS-with-PERT item becomes a `fields` item whose derived fields are
// formulas over the whitelist. A leaf's three-point estimates are inputs; its expected effort is
// (optimistic + 4 × most likely + pessimistic) / 6 and its spread (pessimistic − optimistic) / 6.
// A parent and the item sum their children's expected efforts and take the square root of the sum
// of their squared spreads. The tree decides: a parent's own estimates are ignored.

import {
  type FieldInput,
  type Fields,
  type FieldsItem,
  type GraphChild,
  isRecord,
  listOf,
  refuse,
  type WbsPertItem,
} from "./source.ts";

const ESTIMATES = ["optimistic", "mostLikely", "pessimistic"] as const;

const formula = (text: string): FieldInput => ({ type: "number", formula: text });

/** Expected effort and spread over the children of `at`: the item's ID alone, or `item.node`. */
const rollUp = (at: string): Fields => ({
  expected: formula(`SUM([${at}.*.expected])`),
  spread: formula(`SQRT(SUMSQ([${at}.*.spread]))`),
});

const leaf = (item: string, node: Record<string, unknown>): Fields => {
  const r = (field: string): string => `[${item}.${String(node.id)}.${field}]`;
  const fields: Record<string, FieldInput> = {};
  for (const estimate of ESTIMATES) {
    fields[estimate] = {
      type: "number",
      value: (node[estimate] as number | null | undefined) ?? null,
    };
  }
  fields.expected = formula(`(${r("optimistic")}+4*${r("mostLikely")}+${r("pessimistic")})/6`);
  fields.spread = formula(`(${r("pessimistic")}-${r("optimistic")})/6`);
  return fields;
};

type Walk = { readonly node: unknown; readonly into: GraphChild[] };

/** The WBS as a `fields` item: the tree kept, each node's fields derived as above. */
export const expandWbsPert = (item: WbsPertItem): FieldsItem => {
  const where = `item ${item.id}`;
  const top: GraphChild[] = [];
  const stack: Walk[] = listOf<unknown>(
    item.nodes ?? refuse(`${where}: nodes is not a list`),
    "nodes",
    where,
  )
    .map((node) => ({ node, into: top }))
    .reverse();
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const { node, into } = next;
    if (!isRecord(node)) return refuse(`${where}: a node is not an object`);
    const children = listOf<unknown>(
      node.children,
      "children",
      `${where}, node ${String(node.id)}`,
    );
    const below: GraphChild[] = [];
    const parent = children.length > 0;
    into.push({
      id: node.id as string,
      fields: parent ? rollUp(`${item.id}.${String(node.id)}`) : leaf(item.id, node),
      children: below,
    });
    for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], into: below });
  }
  return { kind: "fields", id: item.id, fields: rollUp(item.id), children: top };
};

/** The IDs of the WBS's leaves, in document order: the tasks of a plan over it. */
export const wbsLeaves = (item: FieldsItem): readonly string[] => {
  const leaves: string[] = [];
  const stack = [...(item.children ?? [])].reverse();
  for (let child = stack.pop(); child !== undefined; child = stack.pop()) {
    const below = child.children ?? [];
    if (below.length === 0) leaves.push(child.id);
    for (let i = below.length - 1; i >= 0; i--) stack.push(below[i] as GraphChild);
  }
  return leaves;
};
