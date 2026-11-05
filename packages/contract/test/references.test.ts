import { describe, expect, test } from "bun:test";
import { hasReference, REFERENCE_PATTERNS, WITH_REFERENCES_DESCRIPTION } from "../src/index.ts";

// What counts as a reference for the asking rule `with-references` (settings-languages design
// decision 12, open question A5; hooks spec, "The with-references predicate"): an http: or https:
// URL, or a project-file pointer, a relative path ending in a file extension that holds a `/` or is
// followed by `#` and an anchor or by `:` and a line.

describe("a reference", () => {
  test.each([
    "src/retry.ts",
    "src/retry.ts#L40-L62",
    "README.md#Install",
    "app.py:12",
    "docs/prd.md#Billing",
    "https://example.com/a",
    "http://localhost:3000/x",
    "./src/retry.ts",
    "../shared/a.ts",
    "config/.gitignore",
    "app.py:12:5",
  ])("%p is one", (text) => {
    expect(hasReference(text)).toBe(true);
  });

  test.each([
    "Keep the retry in `src/retry.ts#L40-L62`?",
    "See README.md#Install first?",
    "The ADR is at https://example.com/adr/12.",
    "Is the bug in app.py:12, or later?",
    "(docs/prd.md)",
    "Compare src/a.ts and src/b.ts.",
  ])("a sentence holding one: %p", (text) => {
    expect(hasReference(text)).toBe(true);
  });
});

describe("not a reference", () => {
  test.each([
    "Node.js",
    "e.g.",
    "v1.2",
    "1.234,5",
    "file.",
    "ftp://x/y",
    "",
    "Use Node.js or e.g. Bun?",
    "and/or",
    "3.5/4.0",
    "v1.2/v1.3",
    "/etc/hosts",
    "~/notes.md",
    "http:",
    "https://",
    "Ratio 1.5:2",
    "src/",
    "README.md",
    "README.md#",
    "app.py:",
  ])("%p is none", (text) => {
    expect(hasReference(text)).toBe(false);
  });
});

describe("the patterns", () => {
  test("are two, a URL and a pointer, and hold no state between calls", () => {
    expect(Object.keys(REFERENCE_PATTERNS)).toEqual(["url", "pointer"]);
    for (const pattern of Object.values(REFERENCE_PATTERNS)) {
      expect(pattern.global || pattern.sticky).toBe(false);
    }
    expect([hasReference("src/a.ts"), hasReference("src/a.ts")]).toEqual([true, true]);
  });

  test("take time linear in a long input", () => {
    const inputs = [
      "a/".repeat(50_000),
      "a.".repeat(50_000),
      `${"a".repeat(100_000)}/`,
      `x/${"a.".repeat(50_000)}`,
      `https://${"a".repeat(100_000)}`,
      "/".repeat(100_000),
      `${"1.".repeat(50_000)}#`,
    ];
    const started = performance.now();
    for (const text of inputs) hasReference(text);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  test("the skills' description names both kinds, with examples", () => {
    expect(WITH_REFERENCES_DESCRIPTION).not.toContain("\n");
    for (const words of ["https:", "src/retry.ts", "README.md#Install", "app.py:12"]) {
      expect(WITH_REFERENCES_DESCRIPTION).toContain(words);
    }
  });
});
