// Molecule fixtures for ask-core's tests (molecules design decisions 3 and 4): the approved UJ-2
// ask, read from the contract's copy of the examples, and a test copy of the `wbs-pert` definition,
// which `packages/molecules` ships; ask-core imports no molecule. Every object here is frozen, so a
// test that changes one copies it first.

import { join } from "node:path";
import type { MoleculeDefinition } from "@askboard/contract";

type Json = Record<string, unknown>;

export const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

/** A copy that a test may change. */
export const copyOf = <T>(value: T): T => structuredClone(value) as T;

const EXAMPLES = join(import.meta.dir, "../../contract/test/fixtures");

/** The approved `uj2-wbs-gantt` ask, as E1's task 3.1 copied it into the contract's tests. */
export const uj2Ask = deepFreeze(
  (await Bun.file(join(EXAMPLES, "asks/uj2-wbs-gantt.json")).json()) as {
    readonly askId: string;
    readonly items: readonly {
      readonly type: string;
      readonly id: string;
      readonly props: Json & { readonly items?: readonly Json[] };
    }[];
  },
);

const referenceOf = (id: string) => {
  const reference = uj2Ask.items[0]?.props.items?.find((item) => item.id === id);
  if (reference === undefined) throw new Error(`the UJ-2 ask has no reference ${id}`);
  return reference as { readonly id: string; readonly props: { readonly data: Json } };
};

/** The data of the UJ-2 references `wbs` and `schedule`. */
export const wbsData = referenceOf("wbs").props.data;
export const scheduleData = referenceOf("schedule").props.data;

/** The three estimates, as `wbs-pert` declares them. */
const ESTIMATE_COLUMNS = [
  { field: "optimistic", label: "Optimistic", type: "number" },
  { field: "mostLikely", label: "Most likely", type: "number" },
  { field: "pessimistic", label: "Pessimistic", type: "number" },
];

/**
 * A test copy of the `wbs-pert` definition 1.0.0 (molecules spec, "The WBS with PERT's parameters
 * are data", "The WBS with PERT's expansion"): one Tree with the three estimate columns, `pert` and
 * an opening depth of 2, filled from `nodes` without their `excerpt` pointers and from `depth`.
 */
export const wbsPert: MoleculeDefinition = deepFreeze({
  format: "1.0.0",
  molecule: "wbs-pert",
  version: "1.0.0",
  parameters: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:askboard:molecule:wbs-pert:1",
    title: "WBS with PERT parameters",
    description:
      "The data an agent sends for a work breakdown with PERT (FR-15): its work packages, nested, each with three-point estimates in working days, and how many levels open at first. AskBoard derives each package's expected effort and spread, and their roll-ups.",
    type: "object",
    properties: {
      nodes: {
        description: "The top-level work packages, in order.",
        type: "array",
        items: { $ref: "#/$defs/node" },
      },
      depth: {
        description:
          "How many levels open when the board first shows the work breakdown: 2 when left out.",
        type: "integer",
        minimum: 1,
        maximum: 8,
      },
    },
    required: ["nodes"],
    additionalProperties: false,
    $defs: {
      node: {
        description:
          "A work package: its ID, unique in the work breakdown, its name, its sub-packages and its estimates.",
        type: "object",
        properties: {
          id: { $ref: "urn:askboard:input:id" },
          label: { $ref: "urn:askboard:input:tree-props#/$defs/node/properties/label" },
          children: { type: "array", minItems: 1, items: { $ref: "#/$defs/node" } },
          optimistic: { $ref: "#/$defs/estimate" },
          mostLikely: { $ref: "#/$defs/estimate" },
          pessimistic: { $ref: "#/$defs/estimate" },
          excerpt: {
            description:
              "Where in the project the package comes from, as path#Heading or path#L10-L40.",
            type: "string",
            minLength: 1,
            maxLength: 1000,
          },
        },
        required: ["id", "label"],
        additionalProperties: false,
      },
      estimate: {
        description: "Working days, from 0 to 100,000.",
        type: "number",
        minimum: 0,
        maximum: 100000,
      },
    },
  },
  items: [
    {
      type: "tree",
      id: "tree",
      props: { columns: ESTIMATE_COLUMNS, nodes: [], pert: true, openDepth: 2 },
    },
  ],
  fills: {
    nodes: [{ pointer: "/0/props/nodes", as: { omit: ["excerpt"] } }],
    depth: [{ pointer: "/0/props/openDepth" }],
  },
});
