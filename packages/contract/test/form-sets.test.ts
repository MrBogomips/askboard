// The sets form-widget widens in task 1.2 (contract spec: Form fields in the schema sets; design
// decision 9): the input format, the board document and the tool envelopes each take one minor past
// layouts' for the field checks' props, and each module's header names this change. The output
// format moves with the PickField's registration (task 3.3, below). The numbers are bound here and in the
// constants only (askboard-contract-versioning, Rule 1), and the rebase task binds them again; the
// next change that widens a set moves the pins below.

import { describe, expect, test } from "bun:test";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  TOOL_ENVELOPES_VERSION,
} from "../src/index.ts";
import { unsupportedVersion } from "../src/versions.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

describe("the minors form-widget binds in group 1", () => {
  test("the three widened sets are one minor past layouts', and the sets carry the constants", () => {
    // Layouts' were input 1.10, tool envelopes 1.10 and board document 1.9.
    expect({
      input: INPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
    }).toEqual({ input: "1.11", envelopes: "1.11", document: "1.10" });
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
  });

  test("the board protocol keeps its minor", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.7");
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.10"],
      ["board-document", "1.9"],
      ["tool-envelopes", "1.10"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous), name).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0"), name).toBeDefined();
    }
  });

  test("each set module's header names this change", async () => {
    for (const module of ["input", "board-document", "tool-envelopes"]) {
      const text = await Bun.file(
        new URL(`../src/schemas/${module}/index.ts`, import.meta.url),
      ).text();
      const header = text.split("\nimport ")[0] as string;
      expect(header, module).toContain("form-widget");
    }
  });
});

describe("the output format's minor, with the PickField's registration (task 3.3)", () => {
  test("it is at form-widget's minor, 1.10, or a later one, and the set carries the constant", () => {
    // document-review's annotation body moved the output format one minor past this change's.
    expect(Number(OUTPUT_FORMAT_VERSION.split(".")[1])).toBeGreaterThanOrEqual(10);
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    expect(unsupportedVersion(setOf("output"), "1.9")).toBeUndefined();
    expect(unsupportedVersion(setOf("output"), "2.0")).toBeDefined();
  });

  test("the module's header names this change", async () => {
    const text = await Bun.file(new URL("../src/schemas/output/index.ts", import.meta.url)).text();
    expect(text.split("\nimport ")[0] as string).toContain("form-widget");
  });
});
