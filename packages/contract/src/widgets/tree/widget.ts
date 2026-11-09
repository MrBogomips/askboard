// The Tree's registry entry (widget-registry, design decision 1): its schemas, checks, shape,
// derived declarations, wording and example, each reused from the Tree's own modules. It imports no
// runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's import rule).

import { isRecord } from "../../problems.ts";
import type { WidgetType } from "../registry.ts";
import { treePropsProblems } from "./checks.ts";
import { TREE_PERT_ANSWER_DERIVED, TREE_SHAPE } from "./index.ts";
import { TREE_KEYS } from "./keys.ts";
import treeChanges from "./tree-changes.json" with { type: "json" };
import treeProps from "./tree-props.json" with { type: "json" };
import { TREE_EXPECTED, TREE_FIELDS, treeElementOf, treeRest } from "./wording.ts";

/** Whether `nodeId` is a node of the Tree props, at any depth. */
const hasNode = (props: unknown, nodeId: string): boolean => {
  const walk = (nodes: unknown): boolean =>
    Array.isArray(nodes) &&
    nodes.some((node) => isRecord(node) && (node.id === nodeId || walk(node.children)));
  return isRecord(props) && walk(props.nodes);
};

// A Tree with PERT declares its item totals and, per node, the fields of TREE_PERT_ANSWER_DERIVED
// (F7); a Tree without pert declares nothing.
const derivedProblem = (rest: readonly string[], props: unknown): string | undefined => {
  const fields: readonly string[] = TREE_PERT_ANSWER_DERIVED.fields;
  if (!(isRecord(props) && props.pert === true)) {
    return "a Tree declares derived values only with pert";
  }
  const [first, second] = rest;
  const totals = rest.length === 1 && fields.includes(first ?? "");
  const node = rest.length === 2 && fields.includes(second ?? "") && hasNode(props, first ?? "");
  return totals || node
    ? undefined
    : `a Tree with pert declares ${fields.join(" and ")} and its nodes'`;
};

export const TREE_WIDGET: WidgetType = {
  type: "tree",
  noun: "a Tree",
  props: treeProps,
  propsProblems: treePropsProblems,
  edits: { changes: treeChanges, shape: () => TREE_SHAPE },
  derived: {
    describe: `the item totals and each node's ${TREE_PERT_ANSWER_DERIVED.fields.join(" and ")}, with pert`,
    problem: derivedProblem,
  },
  wording: {
    expected: TREE_EXPECTED,
    fields: TREE_FIELDS,
    rest: treeRest,
    element: treeElementOf,
  },
  example: {
    item: {
      type: "tree",
      id: "wbs",
      props: { nodes: [{ id: "design", label: "Design", children: [{ id: "ux", label: "UX" }] }] },
    },
  },
  keys: TREE_KEYS,
  help: {
    mouse:
      "Click a name to edit it, drag a row to move it, tick the check box beside a row to select it, and use the toolbar to add, move, indent, outdent or delete nodes.",
    answer:
      "The agent receives the changes you made to the hierarchy: nodes added, renamed, moved or removed, and any estimates you changed.",
  },
  skill: {
    use: "a work breakdown or any hierarchy the user edits: add, move, rename, remove nodes, adjust estimates",
  },
};
