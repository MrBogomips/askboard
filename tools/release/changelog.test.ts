import { describe, expect, test } from "bun:test";
import { changelogSection } from "./changelog.ts";

const LOG = `# Changelog

All notable changes.

## Unreleased

- nothing yet

## 0.2.0 - 2026-12-01

- second

## 0.1.0 - 2026-11-07

First release.

- asking
- answers

### Notes

Heading levels below the section's stay inside it.

## 0.0.1
- before
`;

describe("changelogSection", () => {
  test("is the body of the version's section, without its heading or the blank lines around it", () => {
    expect(changelogSection(LOG, "0.1.0")).toBe(
      "First release.\n\n- asking\n- answers\n\n### Notes\n\nHeading levels below the section's stay inside it.",
    );
  });

  test("ends at the next second-level heading, and at the end of the file", () => {
    expect(changelogSection(LOG, "0.2.0")).toBe("- second");
    expect(changelogSection(LOG, "0.0.1")).toBe("- before");
  });

  test("accepts a heading with no date", () => {
    expect(changelogSection("## 0.1.0\n\nbody\n", "0.1.0")).toBe("body");
  });

  test.each([
    ["a version that has no section", "0.3.0"],
    ["a version that is a prefix of a heading's", "0.1"],
    ["a version that a heading extends", "0.2.0-beta"],
    ["a dot that matches any character", "0x1x0"],
  ])("is undefined for %s", (_name, version) => {
    expect(changelogSection(LOG, version)).toBeUndefined();
  });

  test("is undefined when the heading is a longer number", () => {
    expect(changelogSection("## 0.1.01 - x\n\nbody\n", "0.1.0")).toBeUndefined();
    expect(changelogSection("## 10.1.0 - x\n\nbody\n", "0.1.0")).toBeUndefined();
  });

  test("does not take a heading inside a longer line or at another level", () => {
    expect(changelogSection("### 0.1.0\n\nbody\n", "0.1.0")).toBeUndefined();
    expect(changelogSection("text ## 0.1.0\n\nbody\n", "0.1.0")).toBeUndefined();
  });

  test("reads Windows line endings", () => {
    expect(changelogSection("## 0.1.0 - d\r\n\r\nbody\r\n\r\n## 0.0.1\r\n", "0.1.0")).toBe("body");
  });
});
