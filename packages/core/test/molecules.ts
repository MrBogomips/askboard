// Molecule fixtures for ask-core's tests (molecules design decisions 3 and 4): the approved UJ-2
// ask, read from the contract's copy of the examples, and a test copy of the `wbs-pert` definition,
// which `packages/molecules` ships; ask-core imports no molecule. Every object here is frozen, so a
// test that changes one copies it first.

import { join } from "node:path";
import type { MoleculeDefinition } from "@askboard/contract";
import type { MoleculeSource } from "../src/index.ts";

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

/**
 * A test-only plan-like definition: one Gantt plan filled from `workPackages` (`item`), `start`
 * (copy) and `dependencies` (`entries`), with parameters that reference only E1's ID schema. The
 * shipped `gantt-plan`, whose parameters reference the Gantt's props schema, is `molecules`'.
 */
export const probeSchedule: MoleculeDefinition = deepFreeze({
  format: "1.0.0",
  molecule: "probe-schedule",
  version: "1.2.0",
  parameters: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:askboard:molecule:probe-schedule:1",
    type: "object",
    properties: {
      workPackages: { $ref: "urn:askboard:input:id" },
      start: { type: "string" },
      dependencies: {
        type: "object",
        additionalProperties: { type: "array", items: { $ref: "urn:askboard:input:id" } },
      },
    },
    required: ["workPackages", "start"],
    additionalProperties: false,
  },
  items: [{ type: "gantt", id: "plan", props: { tasks: {} } }],
  fills: {
    workPackages: [{ pointer: "/0/props/workPackages", as: "item" }],
    start: [{ pointer: "/0/props/start" }],
    dependencies: [{ pointer: "/0/props/tasks", as: { entries: "dependencies" } }],
  },
});

const versionParts = (version: string): number[] => version.split(".").map(Number);
const compareVersions = (a: string, b: string): number => {
  const [x, y] = [versionParts(a), versionParts(b)];
  return (x[0] ?? 0) - (y[0] ?? 0) || (x[1] ?? 0) - (y[1] ?? 0) || (x[2] ?? 0) - (y[2] ?? 0);
};

/**
 * A fake `MoleculeSource` over `definitions`, with the version rule of design decision 5, and the
 * molecules named in `broken` reported broken with their detail. It records each lookup.
 */
export const fakeMoleculeSource = (
  definitions: readonly MoleculeDefinition[],
  broken: Readonly<Record<string, string>> = {},
) => {
  const lookups: string[] = [];
  const source: MoleculeSource = {
    lookup: (molecule, version) => {
      lookups.push(version === undefined ? molecule : `${molecule} ${version}`);
      const shipped = definitions.filter((definition) => definition.molecule === molecule);
      if (shipped.length === 0) {
        const names = [...new Set(definitions.map((definition) => definition.molecule))].sort();
        return { found: false, reason: "unknown-molecule", shipped: names };
      }
      const versions = shipped.map((definition) => definition.version);
      if (Object.hasOwn(broken, molecule)) {
        return { found: false, reason: "broken", shipped: versions, detail: broken[molecule] };
      }
      const usable = shipped
        .filter(
          (definition) =>
            version === undefined ||
            (versionParts(definition.version)[0] === versionParts(version)[0] &&
              compareVersions(definition.version, version) >= 0),
        )
        .sort((a, b) => compareVersions(b.version, a.version));
      const [best] = usable;
      if (best === undefined) return { found: false, reason: "unknown-version", shipped: versions };
      return { found: true, definition: best };
    },
  };
  return { source, lookups };
};
