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

describe("the versions of the sets", () => {
  test("the four widened sets hold the minors bound so far", () => {
    expect({
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      protocol: BOARD_PROTOCOL_VERSION,
      snapshot: SNAPSHOT_DATA_VERSION,
    }).toEqual({ output: "1.6", envelopes: "1.6", protocol: "1.6", snapshot: "1.1" });
  });

  test("the sets hold those constants", () => {
    expect(setOf("output").version).toBe("1.6");
    expect(setOf("tool-envelopes").version).toBe("1.6");
    expect(setOf("board-protocol").version).toBe("1.6");
    expect(setOf("snapshot-data").version).toBe("1.1");
  });

  test("the sets this change does not widen hold the minors bound so far", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      document: BOARD_DOCUMENT_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
    }).toEqual({ input: "1.6", document: "1.5", manifest: "1.1" });
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
