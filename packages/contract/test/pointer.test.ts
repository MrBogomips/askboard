import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  POINTER_MAX_CHARS,
  type PointerProblem,
  type PointerReading,
  readPointer,
} from "../src/index.ts";

// Contract spec, The pointer grammar (excerpts, task 1.1; proposal A6): the text up to the first
// `#` is a root-relative path, the rest an anchor, a line range only as `L<start>-L<end>` with
// 1 <= start <= end. A path that could leave the root by its text alone is invalid, with its
// reason, and reading a pointer touches no file.

const lines = (start: number, end: number) => ({ kind: "lines", start, end }) as const;
const name = (text: string) => ({ kind: "name", text }) as const;

const VALID: readonly (readonly [string, PointerReading])[] = [
  // Line ranges.
  ["src/retry.ts#L40-L62", { path: "src/retry.ts", anchor: lines(40, 62) }],
  ["a.md#L1-L1", { path: "a.md", anchor: lines(1, 1) }],
  ["a.md#L9-L3", { path: "a.md", anchor: name("L9-L3") }],
  ["a.md#L0-L2", { path: "a.md", anchor: name("L0-L2") }],
  ["a.md#L40", { path: "a.md", anchor: name("L40") }],
  ["a.md#L01-L02", { path: "a.md", anchor: name("L01-L02") }],
  ["a.md#l1-l2", { path: "a.md", anchor: name("l1-l2") }],
  ["a.md# L1-L2", { path: "a.md", anchor: name(" L1-L2") }],
  ["a.md#L1-L2 ", { path: "a.md", anchor: name("L1-L2 ") }],
  ["a.md#L1-L99999999999999999999", { path: "a.md", anchor: name("L1-L99999999999999999999") }],
  // Headings and IDs, with spaces and punctuation.
  ["docs/prd.md#Billing", { path: "docs/prd.md", anchor: name("Billing") }],
  ["docs/prd.md#FR-8", { path: "docs/prd.md", anchor: name("FR-8") }],
  [
    "docs/adr/0012-payment-retries.md#Decision and consequences: v2 (draft)!",
    {
      path: "docs/adr/0012-payment-retries.md",
      anchor: name("Decision and consequences: v2 (draft)!"),
    },
  ],
  [
    "docs/a.md#AD-12 — “Excerpts”, ‹media›",
    { path: "docs/a.md", anchor: name("AD-12 — “Excerpts”, ‹media›") },
  ],
  // The first `#` ends the path; the anchor keeps every later one.
  ["a.md#C#", { path: "a.md", anchor: name("C#") }],
  ["a.md##Intro", { path: "a.md", anchor: name("#Intro") }],
  ["docs/c#.md#Intro", { path: "docs/c", anchor: name(".md#Intro") }],
  // No anchor: a reference opens the file at its top, and an image has none.
  ["src/retry.ts", { path: "src/retry.ts" }],
  [".askboard/media/shot.png", { path: ".askboard/media/shot.png" }],
  // Names that only look like the refused segments, and nothing is decoded.
  ["%2e%2e/x.md#A", { path: "%2e%2e/x.md", anchor: name("A") }],
  ["docs/%2e%2e/%2E%2E/x.md#A", { path: "docs/%2e%2e/%2E%2E/x.md", anchor: name("A") }],
  ["docs/.../a..b/.hidden#A", { path: "docs/.../a..b/.hidden", anchor: name("A") }],
  ["docs/café.md#Intro", { path: "docs/café.md", anchor: name("Intro") }],
  ["docs/a‮b.md#A", { path: "docs/a‮b.md", anchor: name("A") }],
];

const INVALID: readonly (readonly [string, PointerProblem])[] = [
  // The contract spec's "Paths that leave the root by their text".
  ["../secret.md#A", "dot-segment"],
  ["docs/../../x.md#A", "dot-segment"],
  ["/etc/passwd#L1-L2", "absolute-path"],
  ["docs//x.md#A", "empty-segment"],
  ["./docs/x.md#A", "dot-segment"],
  ["docs\\x.md#A", "backslash"],
  // More of the same.
  ["", "empty-path"],
  ["#Intro", "empty-path"],
  ["..", "dot-segment"],
  ["docs/.", "dot-segment"],
  ["docs/./x.md", "dot-segment"],
  ["docs/", "empty-segment"],
  ["//server/x.md", "absolute-path"],
  ["docs\\..\\x.md", "backslash"],
  ["a.md#", "empty-anchor"],
  // Control characters, in the path or the anchor.
  ["docs/a\u0000.md#A", "control-character"],
  ["docs/a\t.md#A", "control-character"],
  ["docs/a\u007F.md#A", "control-character"],
  ["docs/a\u0085.md#A", "control-character"],
  ["a.md#A\nB", "control-character"],
  ["a.md\r#A", "control-character"],
];

describe("readPointer (contract spec, The pointer grammar)", () => {
  test.each(VALID)("reads %p", (text, expected) => {
    expect(readPointer(text)).toEqual(expected);
  });

  test.each(INVALID)("refuses %p as %p", (text, reason) => {
    expect(readPointer(text)).toEqual({ invalid: reason });
  });

  test("takes a pointer of the longest length, counted in characters, and refuses one more", () => {
    const longest = `${"x".repeat(POINTER_MAX_CHARS - 5)}.md#A`;
    expect(readPointer(longest)).toEqual({ path: longest.slice(0, -2), anchor: name("A") });
    expect(readPointer(`x${longest}`)).toEqual({ invalid: "too-long" });
    // Characters outside the Basic Multilingual Plane count once, as JSON Schema counts them.
    const astral = `${"😀".repeat(POINTER_MAX_CHARS - 2)}#A`;
    expect(readPointer(astral)).toEqual({
      path: "😀".repeat(POINTER_MAX_CHARS - 2),
      anchor: name("A"),
    });
    expect(readPointer(`😀${astral}`)).toEqual({ invalid: "too-long" });
    expect(readPointer("x".repeat(10 * POINTER_MAX_CHARS))).toEqual({ invalid: "too-long" });
  });

  test("touches no file: its module imports only the contract's limits", () => {
    const source = readFileSync(join(import.meta.dir, "../src/context/pointer.ts"), "utf8");
    const specifiers = [...source.matchAll(/\bfrom\s+"([^"]+)"|\bimport\s*\(\s*"([^"]+)"/g)].map(
      (match) => match[1] ?? match[2],
    );
    expect(specifiers).toEqual(["../limits.ts"]);
  });
});
