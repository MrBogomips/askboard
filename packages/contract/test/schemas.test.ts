import { describe, expect, test } from "bun:test";
import { SCHEMA_SET_OWNERS, SCHEMA_SETS, type SchemaSet } from "../src/index.ts";
import { schemaSetProblems } from "../src/validate.ts";

const set = (fields: Partial<SchemaSet>): SchemaSet => ({
  name: "board-protocol",
  title: "board protocol",
  owner: "board-host",
  version: "1.0",
  schemas: [
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:askboard:board-protocol:probe",
      type: "object",
    },
  ],
  ...fields,
});
const schema = (fields: Record<string, unknown>) => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:board-protocol:probe",
  ...fields,
});

describe("schema checks (Consistency Conventions, Tests; AD-7)", () => {
  test("every schema of every set compiles as 2020-12 in strict mode, with no root combinator", () => {
    expect(schemaSetProblems(SCHEMA_SETS)).toEqual([]);
  });

  test("every set names its version and the owner AD-7's table gives it", () => {
    for (const { name, owner, version } of SCHEMA_SETS) {
      expect({ name, owner }).toEqual({ name, owner: SCHEMA_SET_OWNERS[name] as never });
      expect(version).toMatch(/^\d+\.\d+$/);
    }
    expect(SCHEMA_SET_OWNERS["view-manifest"]).toBe("view");
  });

  test.each(["oneOf", "anyOf", "allOf"])("a schema given a root %s fails the check", (keyword) => {
    const combined = schema({ [keyword]: [{ type: "object" }, { type: "string" }] });
    expect(schemaSetProblems([set({ schemas: [combined] })])).toEqual([
      `board protocol, urn:askboard:board-protocol:probe: root ${keyword}`,
    ]);
  });

  test("a set with the wrong owner, a bad version or a schema outside its namespace fails", () => {
    expect(schemaSetProblems([set({ owner: "view" })])).toEqual([
      'board protocol: owner view, but AD-7\'s table gives "board-protocol" to board-host',
    ]);
    expect(schemaSetProblems([set({ version: "1" })])).toEqual([
      'board protocol: version "1" is not major.minor',
    ]);
    expect(schemaSetProblems([set({ name: "drafts" })])).toEqual([
      'board protocol: owner board-host, but AD-7\'s table has no set "drafts"',
      "board protocol, urn:askboard:board-protocol:probe: $id outside urn:askboard:drafts:",
    ]);
  });

  test("a set named after an inherited property is not taken as in AD-7's table", () => {
    expect(schemaSetProblems([set({ name: "toString", schemas: [] })])).toEqual([
      'board protocol: owner board-host, but AD-7\'s table has no set "toString"',
    ]);
  });

  test("a schema of another dialect, without an $id or invalid in strict mode fails", () => {
    const problems = schemaSetProblems([
      set({
        schemas: [
          schema({ $schema: "http://json-schema.org/draft-07/schema#", type: "object" }),
          { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" },
          schema({ $id: "urn:askboard:board-protocol:loose", type: "object", colour: "red" }),
        ],
      }),
    ]);
    expect(problems[0]).toBe(
      "board protocol, urn:askboard:board-protocol:probe: $schema is not JSON Schema 2020-12",
    );
    expect(problems[1]).toBe("board protocol, (no $id): $id outside urn:askboard:board-protocol:");
    expect(problems[2]).toContain("urn:askboard:board-protocol:loose: does not compile");
    expect(problems[2]).toContain("colour");
  });

  test("two schemas with one $id fail", () => {
    const twice = schema({ type: "object" });
    expect(schemaSetProblems([set({ schemas: [twice, twice] })])).toEqual([
      expect.stringContaining("urn:askboard:board-protocol:probe: cannot be added"),
    ]);
  });
});
