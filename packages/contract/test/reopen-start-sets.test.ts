// The two sets reopen-start-from-answer widens (contract spec: Unchanged items in the board state's
// answers, The prefill mark in the draft record; design decision 7): the board protocol and the
// Snapshot data each take one minor past main's, and every other set keeps main's. The numbers are
// bound here and in the constants only (askboard-contract-versioning, Rule 1); the next change that
// widens either set moves the two pins below.

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

describe("the sets reopen-start-from-answer widens", () => {
  test("the board protocol and the Snapshot data hold the minors bound for this change", () => {
    expect({ protocol: BOARD_PROTOCOL_VERSION, snapshot: SNAPSHOT_DATA_VERSION }).toEqual({
      protocol: "1.9",
      snapshot: "1.2",
    });
    expect(setOf("board-protocol").version).toBe(BOARD_PROTOCOL_VERSION);
    expect(setOf("snapshot-data").version).toBe(SNAPSHOT_DATA_VERSION);
  });

  test("every other set keeps main's minor, and the set registry stays sound", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
      configuration: CONFIGURATION_VERSION,
      localApi: LOCAL_API_VERSION,
      sessionFile: SESSION_FILE_FORMAT,
    }).toEqual({
      input: "1.12",
      output: "1.11",
      envelopes: "1.12",
      document: "1.11",
      manifest: "1.1",
      configuration: "1.0",
      localApi: "1.0",
      sessionFile: "1.0",
    });
    expect(schemaSetProblems([...SCHEMA_SETS, pushBoardProtocolSchemas])).toEqual([]);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["board-protocol", "1.8"],
      ["snapshot-data", "1.1"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous), name).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0"), name).toBeDefined();
    }
  });
});
