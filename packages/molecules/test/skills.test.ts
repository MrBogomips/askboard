// The teaching data of the ready molecules (askboard-skills, task 1.3; molecules spec, "Teaching
// data for each ready molecule"): when to use each, 1 to 200 characters, and an example of the data
// an agent sends, which passes the molecule's parameters and the reference's own checks.

import { describe, expect, test } from "bun:test";
import { moleculeDataValidator, validateMoleculeProps } from "@askboard/contract/validate";
import { MOLECULE_SKILLS, READY_MOLECULES } from "../src/index.ts";

const names = READY_MOLECULES.map(({ molecule }) => molecule);

/** The keys of a teaching table that are no ready molecule, and the ready molecules it lacks. */
const keyProblems = (skills: Readonly<Record<string, unknown>>): string[] => [
  ...Object.keys(skills)
    .filter((key) => !names.includes(key))
    .map((key) => `"${key}" is no ready molecule`),
  ...names.filter((name) => !(name in skills)).map((name) => `"${name}" has no teaching data`),
];

/** The example data of a molecule, which the key check shows is there. */
const exampleOf = <T>(name: string): T => {
  const skill = MOLECULE_SKILLS[name];
  if (skill === undefined) throw new Error(`no teaching data for ${name}`);
  return skill.example as T;
};

const isDeepFrozen = (value: unknown): boolean =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

describe("MOLECULE_SKILLS", () => {
  test("has exactly the ready molecules' names as keys", () => {
    expect(Object.keys(MOLECULE_SKILLS).sort()).toEqual([...names].sort());
    expect(keyProblems(MOLECULE_SKILLS)).toEqual([]);
  });

  test("fails the key check for a molecule that is not ready, and for one left out", () => {
    expect(keyProblems({ ...MOLECULE_SKILLS, kanban: { use: "x", example: {} } })).toEqual([
      '"kanban" is no ready molecule',
    ]);
    const { "wbs-pert": _left, ...rest } = MOLECULE_SKILLS;
    expect(keyProblems(rest)).toEqual(['"wbs-pert" has no teaching data']);
  });

  test("is frozen, each entry to its last value", () => {
    expect(isDeepFrozen(MOLECULE_SKILLS)).toBe(true);
  });

  test.each(names)("%s: its use has 1 to 200 characters", (name) => {
    const use = MOLECULE_SKILLS[name]?.use ?? "";
    expect(use.length).toBeGreaterThanOrEqual(1);
    expect(use.length).toBeLessThanOrEqual(200);
  });

  test.each(names)("%s: its example passes the parameters and the reference check", (name) => {
    const definition = READY_MOLECULES.find(({ molecule }) => molecule === name);
    if (definition === undefined) throw new Error(`no ${name}`);
    const data = exampleOf<Record<string, unknown>>(name);
    expect(moleculeDataValidator(definition)(data).ok).toBe(true);
    const reference = { molecule: name, data };
    expect(validateMoleculeProps(reference)).toEqual({ ok: true, value: reference });
  });

  test("the WBS example has two levels of nodes with three-point estimates", () => {
    const { nodes } = exampleOf<{ nodes: { children?: Record<string, unknown>[] }[] }>("wbs-pert");
    const leaves = nodes.flatMap(({ children }) => children ?? []);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf).toMatchObject({
        optimistic: expect.any(Number),
        mostLikely: expect.any(Number),
        pessimistic: expect.any(Number),
      });
    }
  });

  test("the plan example has one dependency, between tasks of the work breakdown", () => {
    const { dependencies } = exampleOf<{ dependencies: Record<string, string[]> }>("gantt-plan");
    expect(Object.values(dependencies).flat()).toHaveLength(1);
  });

  test("an example with a field outside the parameters is refused", () => {
    const definition = READY_MOLECULES.find(({ molecule }) => molecule === "wbs-pert");
    if (definition === undefined) throw new Error("no wbs-pert");
    const example = exampleOf<Record<string, unknown>>("wbs-pert");
    expect(moleculeDataValidator(definition)({ ...example, colour: "red" }).ok).toBe(false);
  });
});
