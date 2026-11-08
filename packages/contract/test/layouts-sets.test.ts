// The three sets layouts widens (contract spec, "Layout types in the registry", "Layouts in the
// board document and fetch"; design decision 8): the input format, the board document and the tool
// envelopes each take one minor past atoms' when the Stack, the Row, the Group and the Tabs layout
// join the registry; every other set keeps atoms'. The numbers are bound here and in the constants
// only (askboard-contract-versioning, Rule 1); earlier changes' version tests hold them as lower
// bounds, and the next change that widens a set moves the pins below.

import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_VERSION,
  INPUT_FORMAT_VERSION,
  LOCAL_API_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  SESSION_FILE_FORMAT,
  SNAPSHOT_DATA_VERSION,
  TOOL_ENVELOPES_VERSION,
  VIEW_MANIFEST_VERSION,
} from "../src/index.ts";
import { unsupportedVersion } from "../src/versions.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

describe("the minors layouts binds", () => {
  test("the three widened sets are at layouts' minor or a later one, and the sets carry the constants", () => {
    // Layouts took input 1.10, tool envelopes 1.10 and board document 1.9, one past atoms' 1.9, 1.9
    // and 1.8; a later change takes the next minor again (the latest change's version test holds the
    // exact numbers).
    const minorOf = (version: string) => Number(version.split(".")[1]);
    expect(minorOf(INPUT_FORMAT_VERSION)).toBeGreaterThanOrEqual(10);
    expect(minorOf(TOOL_ENVELOPES_VERSION)).toBeGreaterThanOrEqual(10);
    expect(minorOf(BOARD_DOCUMENT_VERSION)).toBeGreaterThanOrEqual(9);
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
  });

  test("the Snapshot data, the view manifest and the standalone sets keep their minor; the output format and the board protocol stand at atoms' minor or a later one", () => {
    // Form-widget's output minor moved with the PickField's registration (task 3.3).
    expect(Number(OUTPUT_FORMAT_VERSION.split(".")[1])).toBeGreaterThanOrEqual(9);
    // The board protocol took 1.7 with atoms and moves on with the Table's cell entries.
    expect(Number(BOARD_PROTOCOL_VERSION.split(".")[1])).toBeGreaterThanOrEqual(7);
    expect({
      snapshot: SNAPSHOT_DATA_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
      configuration: CONFIGURATION_VERSION,
      localApi: LOCAL_API_VERSION,
      sessionFile: SESSION_FILE_FORMAT,
    }).toEqual({
      snapshot: "1.1",
      manifest: "1.1",
      configuration: "1.0",
      localApi: "1.0",
      sessionFile: "1.0",
    });
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("board-protocol").version).toBe(BOARD_PROTOCOL_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor, and a two-digit minor, and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.9"],
      ["board-document", "1.8"],
      ["tool-envelopes", "1.9"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous), name).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0"), name).toBeDefined();
    }
    expect(unsupportedVersion(setOf("input"), INPUT_FORMAT_VERSION)).toBeUndefined();
    expect(unsupportedVersion(setOf("tool-envelopes"), TOOL_ENVELOPES_VERSION)).toBeUndefined();
  });

  test("each set module's header names this change", async () => {
    for (const module of ["input", "board-document", "tool-envelopes"]) {
      const text = await Bun.file(
        new URL(`../src/schemas/${module}/index.ts`, import.meta.url),
      ).text();
      const header = text.split("\nimport ")[0] as string;
      expect(header, module).toContain("layouts");
    }
  });
});
