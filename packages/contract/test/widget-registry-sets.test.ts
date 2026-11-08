// The four sets this change widens (widget-registry, tasks 2.2 and 2.3; contract spec, "This
// change's sets at their next minor"): each one minor past the minor before, every other set
// unchanged. The numbers are those bound while the change is built; the rebase task rebinds them.
// approval-scale-ranking later moved the output format and the envelopes one minor more and, with
// them, the input format and the board document, so the pins follow it.

import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_VERSION,
  INPUT_FORMAT_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
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

// A later change takes the next minor again (atoms', after chart-widget's): these hold the minors
// bound so far or a later one, and the atoms' version test pins the numbers of the latest.
const minor = (version: string): number => Number(version.split(".")[1]);

describe("the versions of the sets", () => {
  test("the four widened sets hold the minors bound so far", () => {
    expect({
      output: minor(OUTPUT_FORMAT_VERSION) >= 8,
      envelopes: minor(TOOL_ENVELOPES_VERSION) >= 8,
      protocol: minor(BOARD_PROTOCOL_VERSION) >= 6,
      snapshot: minor(SNAPSHOT_DATA_VERSION) >= 1,
    }).toEqual({ output: true, envelopes: true, protocol: true, snapshot: true });
  });

  test("the sets hold those constants", () => {
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-protocol").version).toBe(BOARD_PROTOCOL_VERSION);
    expect(setOf("snapshot-data").version).toBe(SNAPSHOT_DATA_VERSION);
  });

  test("the sets this change does not widen hold the minors bound so far", () => {
    expect({
      input: minor(INPUT_FORMAT_VERSION) >= 8,
      document: minor(BOARD_DOCUMENT_VERSION) >= 7,
      manifest: VIEW_MANIFEST_VERSION,
    }).toEqual({ input: true, document: true, manifest: "1.1" });
    expect(setOf("configuration").version).toBe(CONFIGURATION_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["output", "1.4"],
      ["tool-envelopes", "1.4"],
      ["board-protocol", "1.5"],
      ["snapshot-data", "1.0"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous)).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0")).toBeDefined();
    }
  });
});
