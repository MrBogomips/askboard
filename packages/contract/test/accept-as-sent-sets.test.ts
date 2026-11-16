// The four sets accept-as-sent widens (contract spec: An answer accepted as sent in the answer act,
// the output format, the board state, fetch and Snapshots; design decision 8): the output format,
// the board protocol, the tool envelopes and the Snapshot data each take one minor past main's,
// and every other set keeps main's. The numbers are bound here and in the constants only
// (askboard-contract-versioning, Rule 1); the next change that widens one moves its pin below.

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
import { pushBoardProtocolSchemas } from "../src/push/messages.ts";
import { schemaSetProblems } from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

describe("the sets accept-as-sent widens", () => {
  test("each stands at the minor bound for this change, and its set carries the constant", () => {
    expect({
      output: OUTPUT_FORMAT_VERSION,
      protocol: BOARD_PROTOCOL_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      snapshot: SNAPSHOT_DATA_VERSION,
    }).toEqual({ output: "1.14", protocol: "1.15", envelopes: "1.15", snapshot: "1.5" });
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("board-protocol").version).toBe(BOARD_PROTOCOL_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("snapshot-data").version).toBe(SNAPSHOT_DATA_VERSION);
  });

  test("every other set equals main's, and the set registry stays sound", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      document: BOARD_DOCUMENT_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
      configuration: CONFIGURATION_VERSION,
      localApi: LOCAL_API_VERSION,
      sessionFile: SESSION_FILE_FORMAT,
    }).toEqual({
      input: "1.13",
      document: "1.12",
      manifest: "1.1",
      configuration: "1.3",
      localApi: "1.0",
      sessionFile: "1.0",
    });
    expect(schemaSetProblems([...SCHEMA_SETS, pushBoardProtocolSchemas])).toEqual([]);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["output", "1.13"],
      ["board-protocol", "1.14"],
      ["tool-envelopes", "1.14"],
      ["snapshot-data", "1.4"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous), name).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0"), name).toBeDefined();
    }
  });
});
