import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  BOARD_PROTOCOL_VERSION,
  OUTPUT_FORMAT_VERSION,
  PUSH_SCHEMAS,
  SCHEMA_IDS,
  SCHEMA_SETS,
} from "../src/index.ts";
import { PUSH_SCHEMA_GROUPS } from "../src/push/schemas.ts";
import { schemaSetProblems, validateAgainst } from "../src/validate.ts";

// Push delivery's schemas are standalone (contract spec, New schemas are standalone; design
// decision 1): compiled only by the validators that use them, in no set and no ID table, and
// registered by no module when it loads.

type Schema = Record<string, unknown>;
const idOf = (schema: object) => (schema as Schema).$id as string;

// Every key of every `properties` object, at any depth.
const propertyNames = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(propertyNames);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) =>
    key === "properties" && typeof inner === "object" && inner !== null
      ? [...Object.keys(inner), ...Object.values(inner).flatMap(propertyNames)]
      : propertyNames(inner),
  );
};

const CLAUDE_CODE_FIELDS = [
  "agent_id",
  "agent_type",
  "tool_use_id",
  "tool_name",
  "stop_hook_active",
];

describe("push delivery's schemas", () => {
  test("each compiles in strict mode with E1's sets, has its $id in its set's namespace and no root combinator", () => {
    expect(PUSH_SCHEMAS).toEqual(PUSH_SCHEMA_GROUPS.flatMap((group) => group.schemas));
    expect(schemaSetProblems([...SCHEMA_SETS, ...PUSH_SCHEMA_GROUPS])).toEqual([]);
  });

  test("each group has the owner AD-7's table gives its set, and its schemas are in that namespace", () => {
    expect(PUSH_SCHEMA_GROUPS.map(({ name, owner, version }) => [name, owner, version])).toEqual([
      ["local-api", "board-host", "1.0"],
      ["session-file", "board-host", "1.0"],
      ["output", "contract", OUTPUT_FORMAT_VERSION],
      ["board-protocol", "board-host", BOARD_PROTOCOL_VERSION],
    ]);
    for (const group of PUSH_SCHEMA_GROUPS) {
      for (const schema of group.schemas) {
        expect(idOf(schema)).toStartWith(`urn:askboard:${group.name}:`);
      }
    }
  });

  test("the closed event is the output format's own since the ask lifecycle: in its set and the ID table", () => {
    const closed = "urn:askboard:output:closed-event";
    expect(PUSH_SCHEMAS.map(idOf)).not.toContain(closed);
    expect(SCHEMA_IDS.closedEvent).toBe(closed);
    const output = SCHEMA_SETS.find((set) => set.name === "output");
    expect(output?.schemas.map(idOf)).toContain(closed);
    const event = { cursor: "k3x9.3", type: "closed", reason: "agent-finished" };
    expect(validateAgainst(closed, event)).toEqual({ ok: true, value: event });
  });

  test("none is in a schema set or the ID table, so E1's shared validator does not know them", () => {
    const listed = new Set([
      ...SCHEMA_SETS.flatMap((set) => set.schemas.map(idOf)),
      ...Object.values(SCHEMA_IDS),
    ]);
    for (const schema of PUSH_SCHEMAS) {
      expect(listed.has(idOf(schema))).toBe(false);
      expect(() => validateAgainst(idOf(schema), {})).toThrow("the contract has no schema");
    }
  });

  test("every field is camelCase but Claude Code's own, which only the local API carries", () => {
    for (const schema of PUSH_SCHEMAS) {
      const local = idOf(schema).startsWith("urn:askboard:local-api:");
      for (const name of propertyNames(schema)) {
        const ok = /^[a-z][A-Za-z0-9]*$/.test(name) || (local && CLAUDE_CODE_FIELDS.includes(name));
        expect({ schema: idOf(schema), name, ok }).toEqual({
          schema: idOf(schema),
          name,
          ok: true,
        });
      }
    }
  });

  test("every object refuses the fields it does not define", () => {
    const objects = (value: unknown, at: string): [string, Schema][] => {
      if (Array.isArray(value)) return value.flatMap((inner, i) => objects(inner, `${at}/${i}`));
      if (typeof value !== "object" || value === null) return [];
      const own: [string, Schema][] =
        (value as Schema).type === "object" ? [[at, value as Schema]] : [];
      return [
        ...own,
        ...Object.entries(value).flatMap(([key, inner]) => objects(inner, `${at}/${key}`)),
      ];
    };
    for (const schema of PUSH_SCHEMAS) {
      for (const [at, object] of objects(schema, idOf(schema))) {
        expect({ at, closed: object.additionalProperties }).toEqual({ at, closed: false });
      }
    }
  });
});

describe("importing the contract (contract spec, Importing the contract)", () => {
  test("compiles and registers no schema, and the first validation does", () => {
    const probe = Bun.spawnSync({
      cmd: [process.execPath, join(import.meta.dir, "import-probe.ts")],
      cwd: import.meta.dir,
      stderr: "pipe",
    });
    expect(probe.stderr.toString()).toBe("");
    const counts = JSON.parse(probe.stdout.toString()) as {
      atImport: number;
      afterValidation: number;
    };
    expect(counts.atImport).toBe(0);
    expect(counts.afterValidation).toBeGreaterThan(0);
  });
});
