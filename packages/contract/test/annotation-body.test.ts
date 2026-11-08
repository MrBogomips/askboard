// The annotation body (document-review, task 1.1; contract spec: The annotation body, The annotation
// shape): `text`, `replacement` or both, nothing else; a suggested edit's replacement of 0 to 4,000
// code points; the output format's minor that admits it.

import { describe, expect, test } from "bun:test";
import { ANNOTATION_MAX_CHARS, ANNOTATION_REPLACEMENT_MAX_CHARS } from "../src/index.ts";
import { OUTPUT_FORMAT_VERSION } from "../src/schemas/output/index.ts";
import { SCHEMA_SETS } from "../src/sets.ts";
import { type Problem, validateAgainst } from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";

const ANNOTATION = "urn:askboard:output:annotation";

const annotation = (body: unknown) => ({
  id: "u-1",
  target: { selector: { type: "quote", exact: "drafts" } },
  body,
});

const problemsOf = (value: unknown): readonly Problem[] => {
  const checked = validateAgainst(ANNOTATION, value);
  return checked.ok ? [] : checked.problems;
};

describe("the annotation body", () => {
  test("a comment passes", () => {
    expect(problemsOf(annotation({ text: "Say how long." }))).toEqual([]);
  });

  test("a suggested edit passes, with an empty replacement, and with a note beside it", () => {
    expect(problemsOf(annotation({ replacement: "" }))).toEqual([]);
    expect(problemsOf(annotation({ replacement: "unsent answers", text: "Clearer." }))).toEqual([]);
  });

  test("an empty body fails, naming the body", () => {
    const problems = problemsOf(annotation({}));
    expect(problems).not.toEqual([]);
    expect(problems.every((problem) => problem.path === "/body")).toBe(true);
  });

  test("a body holding motivation fails, naming the body", () => {
    const problems = problemsOf(annotation({ text: "x", motivation: "editing" }));
    expect(problems.map((problem) => problem.path)).toEqual(["/body/motivation"]);
  });

  test("a replacement of 4,001 characters fails, naming the body's replacement", () => {
    const problems = problemsOf(annotation({ replacement: "x".repeat(4001) }));
    expect(problems.map((problem) => problem.path)).toEqual(["/body/replacement"]);
  });

  test("the limits count code points: 4,000 emoji pass and 4,001 fail", () => {
    expect(ANNOTATION_REPLACEMENT_MAX_CHARS).toBe(4000);
    expect(problemsOf(annotation({ replacement: "😀".repeat(4000) }))).toEqual([]);
    expect(problemsOf(annotation({ replacement: "😀".repeat(4001) }))).not.toEqual([]);
  });

  test("the comment keeps its bounds: 1 to 2,000 characters", () => {
    expect(ANNOTATION_MAX_CHARS).toBe(2000);
    expect(problemsOf(annotation({ text: "" }))).not.toEqual([]);
    expect(problemsOf(annotation({ text: "x".repeat(2001) }))).not.toEqual([]);
    expect(problemsOf(annotation({ text: "x".repeat(2000) }))).toEqual([]);
  });

  test("a replacement that is no string fails", () => {
    expect(problemsOf(annotation({ replacement: 3 }))).not.toEqual([]);
    expect(problemsOf(annotation({ replacement: null }))).not.toEqual([]);
  });
});

describe("the output format's minor", () => {
  const output = SCHEMA_SETS.find((set) => set.name === "output");

  test("the constant is the set's version, one minor past main's (a label until the rebase)", () => {
    expect(OUTPUT_FORMAT_VERSION).toBe("1.11");
    expect(output?.version).toBe(OUTPUT_FORMAT_VERSION);
  });

  test("a receiver at the new minor accepts the previous one and refuses another major", () => {
    if (output === undefined) throw new Error("no output set");
    expect(unsupportedVersion(output, "1.9")).toBeUndefined();
    expect(unsupportedVersion(output, "2.0")).toBeDefined();
  });

  test("the module's header names the change", async () => {
    const text = await Bun.file(new URL("../src/schemas/output/index.ts", import.meta.url)).text();
    expect((text.split("\nimport ")[0] as string).includes("document-review")).toBe(true);
  });
});
