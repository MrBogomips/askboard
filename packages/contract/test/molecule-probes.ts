// Test-only molecule definitions for the contract's molecule tests (design decisions 2 and 3):
// `probe-wbs` composes a Tree as `wbs-pert` will, with parameters that reference the Tree's own
// props schema; the shipped definitions are `molecules`' and its tests'. A test that changes a
// definition copies it: these objects are frozen.

import type { MoleculeDefinition } from "../src/molecules/index.ts";

const DIALECT = "https://json-schema.org/draft/2020-12/schema";

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

/** A copy that a test may change. */
export const copyOf = <T>(value: T): T => structuredClone(value) as T;

/** A definition in format 1.0.0: one Tree, filled from `nodes`, without their `excerpt`, and `depth`. */
export const probeWbs: MoleculeDefinition = deepFreeze({
  format: "1.0.0",
  molecule: "probe-wbs",
  version: "1.2.0",
  parameters: {
    $schema: DIALECT,
    $id: "urn:askboard:molecule:probe-wbs:1",
    title: "Probe work breakdown",
    description: "A work breakdown for the contract's tests: its nodes and its opening depth.",
    type: "object",
    properties: {
      nodes: {
        type: "array",
        items: { $ref: "urn:askboard:input:tree-props#/$defs/node" },
      },
      owner: { $ref: "urn:askboard:input:id" },
      depth: { type: "integer", minimum: 1, maximum: 8 },
    },
    required: ["nodes"],
    additionalProperties: false,
  },
  items: [
    {
      type: "tree",
      id: "tree",
      props: {
        columns: [{ field: "optimistic", label: "Optimistic", type: "number" }],
        nodes: [],
        openDepth: 2,
      },
    },
  ],
  fills: {
    nodes: [{ pointer: "/0/props/nodes", as: { omit: ["excerpt"] } }],
    depth: [{ pointer: "/0/props/openDepth" }],
  },
});

/** A definition with one slot of each kind: a plan-like item filled by every form. */
export const probePlan: MoleculeDefinition = deepFreeze({
  format: "1.0.0",
  molecule: "probe-plan",
  version: "1.0.0",
  parameters: {
    $schema: DIALECT,
    $id: "urn:askboard:molecule:probe-plan:1",
    type: "object",
    properties: {
      workPackages: { $ref: "urn:askboard:input:id" },
      start: { type: "string" },
      dependencies: {
        type: "object",
        additionalProperties: { type: "array", items: { $ref: "urn:askboard:input:id" } },
      },
    },
    required: ["workPackages"],
    additionalProperties: false,
  },
  items: [{ type: "gantt", id: "plan", props: { start: "2026-01-05", tasks: {} } }],
  fills: {
    workPackages: [{ pointer: "/0/props/workPackages", as: "item" }],
    start: [{ pointer: "/0/props/start" }],
    dependencies: [{ pointer: "/0/props/tasks", as: { entries: "dependencies" } }],
  },
});

/** A definition whose parameters reference the Gantt's props schema, as `gantt-plan`'s do. */
export const probeDated: MoleculeDefinition = deepFreeze({
  format: "1.0.0",
  molecule: "probe-dated",
  version: "1.0.0",
  parameters: {
    $schema: DIALECT,
    $id: "urn:askboard:molecule:probe-dated:1",
    type: "object",
    properties: {
      start: { $ref: "urn:askboard:input:gantt-props#/$defs/fullDate" },
      predecessors: { $ref: "urn:askboard:input:gantt-props#/$defs/predecessors" },
    },
    required: ["start"],
    additionalProperties: false,
  },
  items: [{ type: "gantt", id: "plan", props: { start: "2026-01-05", tasks: {} } }],
  fills: { start: [{ pointer: "/0/props/start" }] },
});
