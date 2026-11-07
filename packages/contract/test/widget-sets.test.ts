import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_IDS,
  SCHEMA_SETS,
  TOOL_ENVELOPES_VERSION,
} from "../src/index.ts";
import { validateMoleculeProps } from "../src/molecules/validate.ts";
import { pushBoardProtocolSchemas } from "../src/push/messages.ts";
import {
  schemaSetProblems,
  validateAgainst,
  validateGanttProps,
  validateTreeProps,
} from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

const idsOf = (name: string) =>
  setOf(name).schemas.map((schema) => (schema as { $id: string }).$id);

describe("the widening as the next minor (widget-answers, design decision 1)", () => {
  test("the five versions", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
      protocol: BOARD_PROTOCOL_VERSION,
    }).toEqual({ input: "1.6", output: "1.6", envelopes: "1.6", document: "1.5", protocol: "1.6" });
  });

  test("each set holds its constant, with the owner AD-7 gives it", () => {
    expect(setOf("input")).toMatchObject({ version: "1.6", owner: "contract" });
    expect(setOf("output")).toMatchObject({ version: "1.6", owner: "contract" });
    expect(setOf("tool-envelopes")).toMatchObject({ version: "1.6", owner: "mcp-tools" });
    expect(setOf("board-document")).toMatchObject({ version: "1.5", owner: "ask-core" });
    expect(setOf("board-protocol")).toMatchObject({ version: "1.6", owner: "board-host" });
  });

  test("an earlier minor's version string is still accepted by major", () => {
    for (const [name, earlier] of [
      ["input", "1.4"],
      ["output", "1.3"],
      ["tool-envelopes", "1.3"],
      ["board-document", "1.3"],
      ["board-protocol", "1.4"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), earlier)).toBeUndefined();
    }
  });
});

describe("widget schemas in the schema sets", () => {
  test("the schema checks report nothing over the sets", () => {
    // With push delivery's standalone origin schema, as test/schemas.test.ts does.
    expect(schemaSetProblems([...SCHEMA_SETS, pushBoardProtocolSchemas])).toEqual([]);
  });

  test("the input format lists the four props and definition schemas", () => {
    expect(idsOf("input")).toEqual(
      expect.arrayContaining([
        "urn:askboard:input:tree-props",
        "urn:askboard:input:gantt-props",
        "urn:askboard:input:molecule-props",
        "urn:askboard:input:molecule-definition",
      ]),
    );
  });

  test("the output format lists the two changes schemas", () => {
    expect(idsOf("output")).toEqual(
      expect.arrayContaining([
        "urn:askboard:output:tree-changes",
        "urn:askboard:output:gantt-changes",
      ]),
    );
  });

  test("SCHEMA_IDS names the six", () => {
    expect({
      treeProps: SCHEMA_IDS.treeProps,
      treeChanges: SCHEMA_IDS.treeChanges,
      ganttProps: SCHEMA_IDS.ganttProps,
      ganttChanges: SCHEMA_IDS.ganttChanges,
      moleculeProps: SCHEMA_IDS.moleculeProps,
      moleculeDefinition: SCHEMA_IDS.moleculeDefinition,
    }).toEqual({
      treeProps: "urn:askboard:input:tree-props",
      treeChanges: "urn:askboard:output:tree-changes",
      ganttProps: "urn:askboard:input:gantt-props",
      ganttChanges: "urn:askboard:output:gantt-changes",
      moleculeProps: "urn:askboard:input:molecule-props",
      moleculeDefinition: "urn:askboard:input:molecule-definition",
    });
  });

  test("validateAgainst knows the six by their IDs", () => {
    for (const id of [
      SCHEMA_IDS.treeProps,
      SCHEMA_IDS.treeChanges,
      SCHEMA_IDS.ganttProps,
      SCHEMA_IDS.ganttChanges,
      SCHEMA_IDS.moleculeProps,
      SCHEMA_IDS.moleculeDefinition,
    ]) {
      expect(() => validateAgainst(id, {})).not.toThrow();
    }
  });

  test("the widget validators read as the shared validator does", () => {
    const refused = validateMoleculeProps({ molecule: "wbs", data: {}, extra: 1 });
    expect(refused.ok).toBe(false);
    expect(validateTreeProps({}, "agent").ok).toBe(false);
    expect(validateGanttProps({}, "agent").ok).toBe(false);
  });

  test("no schema set lists a molecule parameters schema", () => {
    for (const set of SCHEMA_SETS) {
      for (const schema of set.schemas) {
        expect((schema as { $id: string }).$id.startsWith("urn:askboard:molecule:")).toBe(false);
      }
    }
  });
});
