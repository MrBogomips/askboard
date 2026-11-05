// The ready-made molecules (molecules spec, "Ready-made molecules"): exactly the Gantt plan and the
// WBS with PERT, each in the definition format 1.0.0, frozen, and one version per major of each,
// since a definition's parameters carry only the major in their `$id` (design decision 2).

import { describe, expect, test } from "bun:test";
import { validateMoleculeDefinition } from "@askboard/contract/validate";
import { READY_MOLECULES } from "../src/index.ts";

const isDeepFrozen = (value: unknown): boolean =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

describe("READY_MOLECULES", () => {
  test("is exactly gantt-plan 1.0.0 and wbs-pert 1.0.0", () => {
    expect(READY_MOLECULES.map(({ molecule, version }) => `${molecule} ${version}`)).toEqual([
      "gantt-plan 1.0.0",
      "wbs-pert 1.0.0",
    ]);
  });

  test("is frozen, each definition to its last value", () => {
    expect(isDeepFrozen(READY_MOLECULES)).toBe(true);
  });

  test("holds one version per major of each molecule", () => {
    const majors = READY_MOLECULES.map(
      ({ molecule, version }) => `${molecule}:${version.split(".")[0]}`,
    );
    expect(new Set(majors).size).toBe(majors.length);
    for (const { molecule, version, parameters } of READY_MOLECULES) {
      expect(parameters.$id).toBe(`urn:askboard:molecule:${molecule}:${version.split(".")[0]}`);
    }
  });

  test("every definition passes the definition format's checks", () => {
    for (const definition of READY_MOLECULES) {
      expect(validateMoleculeDefinition(definition)).toEqual({ ok: true, value: definition });
      expect(definition.format).toBe("1.0.0");
    }
  });
});
