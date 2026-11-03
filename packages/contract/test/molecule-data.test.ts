import { describe, expect, test } from "bun:test";
import { compiled } from "../src/compiled.ts";
import type { MoleculeDefinition } from "../src/index.ts";
import { moleculeDataValidator, validateAgainst } from "../src/validate.ts";
import { copyOf, probeDated, probeWbs } from "./molecule-probes.ts";

// A reference's data against its definition's parameters (contract spec, "Molecule data
// validation"), in the shared widget validator beside the widget props schemas. The test-only
// `probe-wbs` parameters reference the Tree's node and E1's ID schema, and `probe-dated`'s the
// Gantt's `fullDate` and `predecessors`, as the shipped `gantt-plan`'s do.

const moleculeIdsOfE1 = () =>
  Object.keys(compiled().schemas).filter((id) => id.startsWith("urn:askboard:molecule:"));

const nodes = [
  {
    id: "design",
    label: "Design",
    children: [{ id: "ux", label: "UX design", optimistic: 3, excerpt: "docs/prd.md#UX" }],
  },
];

describe("moleculeDataValidator", () => {
  test("compiles on its first call, not when it is made", () => {
    const broken = copyOf(probeWbs) as unknown as { parameters: Record<string, unknown> };
    broken.parameters.$id = "urn:askboard:molecule:probe-broken:1";
    broken.parameters.wobble = 1;
    const validate = moleculeDataValidator(broken as unknown as MoleculeDefinition);
    expect(typeof validate).toBe("function");
    expect(() => validate({ nodes: [] })).toThrow("strict mode");
  });

  test("passes data the parameters accept, through their $refs into the Tree's props", () => {
    const validate = moleculeDataValidator(probeWbs);
    const data = { nodes, owner: "ada-1", depth: 2 };
    expect(validate(data)).toEqual({ ok: true, value: data });
    expect(validate({ nodes: [] })).toEqual({ ok: true, value: { nodes: [] } });
  });

  test("refuses data the referenced schemas refuse, naming the path in the data", () => {
    const validate = moleculeDataValidator(probeWbs);
    expect(validate({ nodes, owner: "a b" })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/owner", message: expect.stringContaining("pattern") }],
    });
    expect(validate({ nodes: [{ id: "ux" }] })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/nodes/0/label", message: 'missing field "label"' }],
    });
    expect(validate({ nodes: [{ id: "ux", label: "UX", Owner: "Ada" }] })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/nodes/0/Owner", message: 'unknown field "Owner"' }],
    });
  });

  test("refuses an unknown key or a value out of range, naming its path", () => {
    const validate = moleculeDataValidator(probeWbs);
    expect(validate({ nodes, calendar: "work-week" })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/calendar", message: 'unknown field "calendar"' }],
    });
    expect(validate({ nodes, depth: 9 })).toMatchObject({
      ok: false,
      problems: [{ path: "/depth" }],
    });
    expect(validate({ depth: 2 })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/nodes", message: 'missing field "nodes"' }],
    });
  });

  test("takes the Gantt's definitions: a full date passes, another form is refused at its path", () => {
    const validate = moleculeDataValidator(probeDated);
    expect(validate({ start: "2026-11-02" })).toEqual({ ok: true, value: { start: "2026-11-02" } });
    expect(validate({ start: "11/02/2026" })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/start", message: expect.stringContaining("pattern") }],
    });
    expect(validate({ start: "2026-11-02", predecessors: ["ux", "ux"] })).toMatchObject({
      ok: false,
      problems: [{ path: "/predecessors" }],
    });
  });

  test("leaves the data and the definition unchanged", () => {
    const data = copyOf({ nodes, owner: "ada-1" });
    const before = JSON.stringify(data);
    moleculeDataValidator(probeWbs)(data);
    expect(JSON.stringify(data)).toBe(before);
    expect(Object.isFrozen(probeWbs.parameters)).toBe(true);
  });

  test("after it runs, E1's shared validator holds no molecule schema", () => {
    moleculeDataValidator(probeWbs)({ nodes });
    expect(moleculeIdsOfE1()).toEqual([]);
    const id = String(probeWbs.parameters.$id);
    expect(() => validateAgainst(id, { nodes })).toThrow(`the contract has no schema ${id}`);
  });
});
