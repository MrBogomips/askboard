// The output format's next minor (kanban-order, task 1.3; contract spec, "Kanban order in the
// output format's next minor"; design decision 8): the output format takes one minor past `main`'s
// (1.11, at the base ac9f891f) for the Kanban's `move`, every other set keeps `main`'s. The number
// is bound here and in the constant only (askboard-contract-versioning, Rule 1); the rebase task
// moves both, and the next change that widens the output format moves the pin in this file.

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

describe("the output format's minor for the Kanban's order", () => {
  test("is one minor past main's, and the set carries the constant", () => {
    // `main` held output format 1.11 at the base.
    expect(OUTPUT_FORMAT_VERSION).toBe("1.12");
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
  });

  test("every other set equals main's", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
      protocol: BOARD_PROTOCOL_VERSION,
      snapshot: SNAPSHOT_DATA_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
      configuration: CONFIGURATION_VERSION,
      localApi: LOCAL_API_VERSION,
      sessionFile: SESSION_FILE_FORMAT,
    }).toEqual({
      input: "1.12",
      envelopes: "1.12",
      document: "1.11",
      protocol: "1.8",
      snapshot: "1.2",
      manifest: "1.1",
      configuration: "1.0",
      localApi: "1.0",
      sessionFile: "1.0",
    });
  });

  test("a receiver at the new minor accepts the previous minor and refuses major 2", () => {
    expect(unsupportedVersion(setOf("output"), "1.11")).toBeUndefined();
    expect(unsupportedVersion(setOf("output"), OUTPUT_FORMAT_VERSION)).toBeUndefined();
    expect(unsupportedVersion(setOf("output"), "2.0")).toBeDefined();
  });

  test("the output module's header names this change (schemas.test.ts runs the sets' own check)", async () => {
    const text = await Bun.file(new URL("../src/schemas/output/index.ts", import.meta.url)).text();
    expect(text.split("\nimport ")[0]).toContain("kanban-order");
  });
});
