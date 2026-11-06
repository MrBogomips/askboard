import { describe, expect, test } from "bun:test";
import { MIDDLE_HEAD, MIDDLE_TAIL, projectRelative, shownPath } from "./snapshot-path.ts";

// Review F-06: a saved Snapshot's path shows project-relative, cut in the middle when it is long;
// its tooltip and its copy keep the full path.
const SAVED = "/Users/dev/work/acme/.askboard/snapshots/2026-11-06T10-31-22Z-ask-7f3a9c.html";

describe("a Snapshot's displayed path", () => {
  test("is project-relative from the .askboard folder", () => {
    expect(projectRelative(SAVED)).toBe(".askboard/snapshots/2026-11-06T10-31-22Z-ask-7f3a9c.html");
  });

  test("a path outside an .askboard folder stays as it is", () => {
    expect(projectRelative("/tmp/snaps/a.html")).toBe("/tmp/snaps/a.html");
  });

  test("a short path is shown whole", () => {
    expect(shownPath(".askboard/snapshots/a.html")).toBe(".askboard/snapshots/a.html");
  });

  test("a long path is cut in the middle and keeps its start and its end", () => {
    const shown = shownPath(SAVED);
    expect(shown).toHaveLength(MIDDLE_HEAD + 1 + MIDDLE_TAIL);
    expect(shown.startsWith(".askboard/snapshots/")).toBe(true);
    expect(shown.includes("…")).toBe(true);
    expect(shown.endsWith("ask-7f3a9c.html")).toBe(true);
  });

  test("a long path with no .askboard folder is cut the same way", () => {
    const long = `/${"folder/".repeat(12)}file.html`;
    const shown = shownPath(long);
    expect(shown).toHaveLength(MIDDLE_HEAD + 1 + MIDDLE_TAIL);
    expect(shown.endsWith("file.html")).toBe(true);
  });
});
