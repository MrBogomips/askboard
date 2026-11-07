// The four sets approval-scale-ranking widens (contract spec, "This change's sets at their next
// minor"; design decision 11): the input format, the output format, the tool envelopes and the
// board document each take one minor past main's when the Approval joins the registry; the board
// protocol, the Snapshot data and the view manifest keep main's. The numbers are those bound while
// the change is built, here and in the constants only: the rebase task rebinds them.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  SNAPSHOT_DATA_VERSION,
  TOOL_ENVELOPES_VERSION,
  VIEW_MANIFEST_VERSION,
  WIDGET_TYPES,
} from "../src/index.ts";
import { unsupportedVersion } from "../src/versions.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

const schemaOf = (set: string, id: string): AnySchemaObject => {
  const found = (setOf(set).schemas as AnySchemaObject[]).find((schema) => schema.$id === id);
  if (found === undefined) throw new Error(`no schema ${id} in ${set}`);
  return found;
};

const refsOf = (schema: AnySchemaObject, union: string): string[] =>
  schema.$defs[union].oneOf.map(({ $ref }: { $ref: string }) => $ref.split("/").at(-1));

describe("the versions of the four widened sets", () => {
  test("each is one minor past main's, and every other set equals main's", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
    }).toEqual({ input: "1.6", output: "1.6", envelopes: "1.6", document: "1.5" });
    expect({
      protocol: BOARD_PROTOCOL_VERSION,
      snapshot: SNAPSHOT_DATA_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
    }).toEqual({ protocol: "1.6", snapshot: "1.1", manifest: "1.1" });
  });

  test("the sets hold those constants", () => {
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.5"],
      ["output", "1.5"],
      ["tool-envelopes", "1.5"],
      ["board-document", "1.4"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous)).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0")).toBeDefined();
    }
  });
});

describe("the Approval in the composed schemas", () => {
  test("the registry lists the Approval after the Tree and the Gantt", () => {
    expect(WIDGET_TYPES.map(({ type }) => type).slice(0, 3)).toEqual(["tree", "gantt", "approval"]);
  });

  test("a question's items take its item after the Gantt's and before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs).toEqual([
      "excerpt",
      "reference",
      "image",
      "tree",
      "gantt",
      "approval",
      "molecule",
    ]);
    expect(schemaOf("input", "urn:askboard:input:approval-props").additionalProperties).toBe(false);
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    expect(refsOf(document, "contextItem").at(-1)).toBe("approval");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("approval");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("approval");
  });

  test("the output set lists its result schema", () => {
    const ids = (setOf("output").schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids).toContain("urn:askboard:output:approval-result");
  });
});
