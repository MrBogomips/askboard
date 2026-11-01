import { describe, expect, test } from "bun:test";
import {
  CURSOR_PATTERN,
  EPOCH_PATTERN,
  OUTPUT_FORMAT_VERSION,
  outputFormat,
  SCHEMA_IDS,
  UTC_TIME_PATTERN,
} from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// The output format (owner `contract`): the answer event of finding F4 with AD-20's generic diff,
// the discarded event, warnings and the typed outcomes. It holds no AXFX term (FR-18).
const answer = {
  cursor: "k3x9.1",
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:41:27Z",
  choice: ["PostgreSQL"],
};
const pathsOf = (id: string, value: unknown) => {
  const checked = validateAgainst(id, value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};

// AD-20: `add` and `move` name the parent and the preceding sibling, each omitted when there is
// none: the top level, the first position. No null or item ID stands in for either.
describe("an add or a move at the top level or in the first position", () => {
  const CHANGE = `${SCHEMA_IDS.answerEvent}#/$defs/change`;

  test.each([
    [
      "an add of a new top-level element",
      { op: "add", target: "tree.n-9", after: "n-1", value: {} },
    ],
    ["an add first at the top level", { op: "add", target: "tasks.t-9", value: { label: "x" } }],
    ["a move to the top level", { op: "move", target: "tree.n-4", after: "n-1" }],
    ["a move first at the top level", { op: "move", target: "tree.n-4" }],
  ])("%s, without parent, passes", (_, change) => {
    expect(validateAgainst(CHANGE, change).ok).toBe(true);
    expect(validateAgainst(SCHEMA_IDS.answerEvent, { ...answer, changes: [change] }).ok).toBe(true);
  });

  test.each([
    ["an add with a null parent", { op: "add", target: "tree.n-9", parent: null, value: {} }],
    ["a move with a null parent", { op: "move", target: "tree.n-4", parent: null }],
    ["an add with a null after", { op: "add", target: "tree.n-9", after: null, value: {} }],
    ["a move with a null after", { op: "move", target: "tree.n-4", after: null }],
  ])("%s is refused", (_, change) => {
    expect(validateAgainst(CHANGE, change).ok).toBe(false);
  });

  test.each([
    [
      "an add with its parent and after",
      { op: "add", target: "wbs.u-1", parent: "build", after: "portal", value: 1 },
    ],
    ["an add with its parent", { op: "add", target: "wbs.u-2", parent: "build", value: 1 }],
    [
      "a move with its parent and after",
      { op: "move", target: "wbs.ux", parent: "design", after: "u-1" },
    ],
    ["a move with its parent", { op: "move", target: "wbs.ux", parent: "design" }],
  ])("%s still passes", (_, change) => {
    expect(validateAgainst(CHANGE, change).ok).toBe(true);
  });
});

describe("the answer event", () => {
  test("a Choice answer validates", () => {
    expect(validateAgainst(SCHEMA_IDS.answerEvent, answer).ok).toBe(true);
  });

  test("each content field of F4 is optional and typed", () => {
    const full = {
      ...answer,
      note: "Keep the managed instance small.",
      changes: [
        { op: "set", target: "wbs.portal.label", value: "Portal" },
        { op: "add", target: "wbs.u-1", parent: "build", after: "portal", value: { label: "x" } },
        { op: "add", target: "wbs.u-2", parent: "build", value: { label: "first" } },
        { op: "move", target: "wbs.ux", parent: "design", after: "u-1" },
        { op: "remove", target: "retry-states.requeue" },
      ],
      results: { "fix-diff": { decisions: [] } },
      derived: { "wbs.expected": 42, "schedule.finish": "2026-12-02" },
    };
    expect(validateAgainst(SCHEMA_IDS.answerEvent, full).ok).toBe(true);
    const bare = { ...answer, choice: undefined };
    delete bare.choice;
    expect(validateAgainst(SCHEMA_IDS.answerEvent, bare).ok).toBe(true);
  });

  test.each([
    ["an unknown field", { ...answer, verdict: "yes" }, "/verdict"],
    ["an empty choice", { ...answer, choice: [] }, "/choice"],
    ["a repeated label", { ...answer, choice: ["A", "A"] }, "/choice"],
    ["rev 0", { ...answer, rev: 0 }, "/rev"],
    ["an hour out of range", { ...answer, when: "2026-10-29T24:00:00Z" }, "/when"],
    ["a local time", { ...answer, when: "2026-10-29T09:41:27+01:00" }, "/when"],
    ["a cursor without its epoch", { ...answer, cursor: "1" }, "/cursor"],
    ["no who", { ...answer, who: "" }, "/who"],
  ])("%s is refused", (_, value, path) => {
    expect(pathsOf(SCHEMA_IDS.answerEvent, value)).toContain(path);
  });

  test.each([
    ["a set without its value", { op: "set", target: "a.b" }],
    ["an add without its value", { op: "add", target: "a.u-1", parent: "b" }],
    ["a move without its target", { op: "move", parent: "b" }],
    ["a remove with a value", { op: "remove", target: "a.b", value: 1 }],
    ["an unknown op", { op: "replace", target: "a.b", value: 1 }],
    ["a target by array index", { op: "set", target: "a[0]", value: 1 }],
  ])("a change that is %s is refused", (_, change) => {
    expect(pathsOf(SCHEMA_IDS.answerEvent, { ...answer, changes: [change] })).not.toEqual([]);
  });

  test("results are keyed by item ID and derived values by reference", () => {
    expect(pathsOf(SCHEMA_IDS.answerEvent, { ...answer, results: { "a b": {} } })).not.toEqual([]);
    expect(pathsOf(SCHEMA_IDS.answerEvent, { ...answer, derived: { "[wbs]": 1 } })).not.toEqual([]);
  });
});

describe("the other output schemas", () => {
  test("the discarded event of a session exit validates, and no reason the format does not define", () => {
    const discarded = { cursor: "k3x9.2", type: "discarded", reason: "session-exit" };
    expect(validateAgainst(SCHEMA_IDS.discardedEvent, discarded).ok).toBe(true);
    const other = { ...discarded, reason: "timeout" };
    expect(pathsOf(SCHEMA_IDS.discardedEvent, other)).toEqual(["/reason"]);
  });

  test("the no-hooks warning validates, and an unknown code does not", () => {
    const warning = { code: "no-hooks", message: "Collect before you finish." };
    expect(validateAgainst(SCHEMA_IDS.warning, warning).ok).toBe(true);
    expect(pathsOf(SCHEMA_IDS.warning, { ...warning, code: "late" })).toEqual(["/code"]);
  });

  test("the outcomes include unavailable and open, with AD-18's four reasons", () => {
    for (const outcome of ["unavailable", "open"]) {
      expect(validateAgainst(SCHEMA_IDS.outcome, outcome).ok).toBe(true);
    }
    expect(validateAgainst(SCHEMA_IDS.outcome, "late").ok).toBe(false);
    for (const reason of ["remote-host", "container", "ci", "no-browser"]) {
      expect(validateAgainst(SCHEMA_IDS.unavailableReason, reason).ok).toBe(true);
    }
  });

  test("the schemas' time, epoch and cursor patterns are the contract's constants", () => {
    const patternOf = (name: string) =>
      (outputFormat.schemas as { $id: string; pattern?: string }[]).find(
        (schema) => schema.$id === `urn:askboard:output:${name}`,
      )?.pattern;
    expect(patternOf("time")).toBe(UTC_TIME_PATTERN);
    expect(patternOf("epoch")).toBe(EPOCH_PATTERN);
    expect(patternOf("cursor")).toBe(CURSOR_PATTERN);
  });

  test("the output format names its version and holds no AXFX term (FR-18)", () => {
    expect(OUTPUT_FORMAT_VERSION).toBe("1.1");
    const text = JSON.stringify(outputFormat.schemas);
    expect(text).not.toMatch(/\b(axfx|verdict|gate|validator)\b/i);
  });
});
