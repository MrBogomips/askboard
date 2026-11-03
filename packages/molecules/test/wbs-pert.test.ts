// The WBS with PERT molecule (molecules spec, "The WBS with PERT's parameters are data"; contract
// spec, "Molecules carry no code"): its definition as data in the format 1.0.0, its parameters
// checked against the approved UJ-2 data, and its one Tree item with the fills that fill it.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { MoleculeDefinition } from "@askboard/contract";
import { moleculeDataValidator, validateMoleculeDefinition } from "@askboard/contract/validate";
import { READY_MOLECULES } from "../src/index.ts";

const FILE = join(import.meta.dir, "../src/wbs-pert/wbs-pert.json");

// The approved examples, as E1's task 3.1 copied them into the contract's tests.
const ask = await Bun.file(
  join(import.meta.dir, "../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
).json();
const { data } = ask.items[0].props.items[0].props as { data: { nodes: unknown[] } };

const definition = JSON.parse(await Bun.file(FILE).text()) as MoleculeDefinition;

/** Every string in a JSON value, keys included. */
const strings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...strings(inner)]);
};

const validate = moleculeDataValidator(definition);

/** The approved nodes with `change` applied to the first leaf, `ux`. */
const withUx = (change: Record<string, unknown>) => {
  const nodes = structuredClone(data.nodes) as { children: Record<string, unknown>[] }[];
  const [design] = nodes;
  if (design === undefined || design.children[0] === undefined) throw new Error("no ux");
  design.children[0] = { ...design.children[0], ...change };
  return { nodes };
};

describe("the WBS with PERT's definition", () => {
  test("passes the definition format's checks, with its parameters' $id", () => {
    expect(validateMoleculeDefinition(definition)).toEqual({ ok: true, value: definition });
    expect(definition).toMatchObject({ format: "1.0.0", molecule: "wbs-pert", version: "1.0.0" });
    expect(definition.parameters.$id).toBe("urn:askboard:molecule:wbs-pert:1");
  });

  test("is only data: no string holds markup or a javascript: URL", () => {
    for (const text of strings(definition)) {
      expect({ text, markup: text.includes("<") }).toEqual({ text, markup: false });
      expect({ text, script: /javascript:/i.test(text) }).toEqual({ text, script: false });
    }
  });

  test("describes the estimates as working days (F8)", () => {
    const estimate = (definition.parameters.$defs as Record<string, { description?: string }>)
      .estimate;
    expect(estimate?.description).toContain("Working days");
  });

  test("its item is one Tree with the three estimate columns, pert and two levels open", () => {
    expect(definition.items).toEqual([
      {
        type: "tree",
        id: "tree",
        props: {
          columns: [
            { field: "optimistic", label: "Optimistic", type: "number" },
            { field: "mostLikely", label: "Most likely", type: "number" },
            { field: "pessimistic", label: "Pessimistic", type: "number" },
          ],
          nodes: [],
          pert: true,
          openDepth: 2,
        },
      },
    ]);
  });

  test("fills the nodes without their excerpt, and the opening depth from depth", () => {
    expect(definition.fills).toEqual({
      nodes: [{ pointer: "/0/props/nodes", as: { omit: ["excerpt"] } }],
      depth: [{ pointer: "/0/props/openDepth" }],
    });
  });

  test("is ready-made", () => {
    expect(READY_MOLECULES).toContainEqual(definition);
  });
});

describe("the WBS with PERT's parameters", () => {
  test("accept the approved wbs data unchanged", () => {
    const before = structuredClone(data);
    expect(validate(data)).toEqual({ ok: true, value: data });
    expect(data).toEqual(before);
    expect(validate({ ...data, depth: 3 }).ok).toBe(true);
  });

  test.each([
    ["a node holding owner", withUx({ owner: "ada" }), "/nodes/0/children/0/owner"],
    ["an estimate of -1", withUx({ optimistic: -1 }), "/nodes/0/children/0/optimistic"],
    ["a depth of 9", { ...data, depth: 9 }, "/depth"],
  ])("refuse %s, naming its path", (_, value, path) => {
    const checked = validate(value);
    expect(checked.ok).toBe(false);
    expect(checked.ok ? [] : checked.problems.map((problem) => problem.path)).toContain(path);
  });
});
