import { describe, expect, test } from "bun:test";
import type { ErrorObject } from "ajv/dist/2020";
import { compiled, schemaErrors } from "../src/compiled.ts";
import { SCHEMA_IDS } from "../src/index.ts";

// The contract's schema errors (AD-7): an `if` error is left out beside the errors of the branch
// it chose, but an invalid value never comes back with no error at all (fail closed, AD-10).

// A schema, in the shared instance under a test-only ID, whose one keyword fails a value with only
// an `if` error, as Ajv reports a failed `then` branch.
const IF_ONLY = "urn:askboard:test:if-only";
const ifError: ErrorObject = {
  keyword: "if",
  instancePath: "",
  schemaPath: "#/if",
  params: { failingKeyword: "then" },
  message: 'must match "then" schema',
};
const failsWithIfOnly = Object.assign(
  (): boolean => {
    failsWithIfOnly.errors = [ifError];
    return false;
  },
  { errors: [] as ErrorObject[] },
);
const ajv = compiled();
if (ajv.getSchema(IF_ONLY) === undefined) {
  ajv.addKeyword({ keyword: "testIfOnly", validate: failsWithIfOnly, errors: true });
  ajv.addSchema({ $id: IF_ONLY, testIfOnly: true });
}

describe("schemaErrors", () => {
  test("a valid value has no errors", () => {
    expect(schemaErrors(SCHEMA_IDS.cursor, "k3x9.1")).toEqual([]);
  });

  test("an invalid value whose only error is an if error keeps it, rather than none", () => {
    const errors = schemaErrors(IF_ONLY, {});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.keyword)).toEqual(["if"]);
  });

  test("beside the chosen branch's errors, the if error is left out", () => {
    // An edit choice that says ignore must keep a revision: the schema's then branch says so.
    const errors = schemaErrors(SCHEMA_IDS.editChoiceEvent, {
      cursor: "k3x9.1",
      type: "edit-choice",
      itemId: "q1",
      rev: 2,
      edit: "ignore",
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.keyword === "if")).toBe(false);
  });
});
