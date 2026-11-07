// A widget type's teaching text (askboard-skills, task 1.2; contract spec, "A widget type's
// teaching text"): `skill` on a registry entry, its bounds in the registry's own check, and the
// shipped types' texts, which the generated skill reads.

import { describe, expect, test } from "bun:test";
import { PROBE_TYPES, PROBE_WIDGET } from "../src/fixtures/index.ts";
import {
  type RegistryProblem,
  WIDGET_TYPES,
  type WidgetType,
  widgetRegistryProblems,
} from "../src/index.ts";
import { registryShapeProblems } from "../src/widgets/registry.ts";

// The terms `output-format.test.ts` refuses in the output set.
const TERMS = /\b(axfx|verdict|gate|validator)\b/i;

const rulesOf = (problems: readonly RegistryProblem[]) =>
  problems.map(({ type, rule }) => `${type}:${rule}`);

const taught = (skill: NonNullable<WidgetType["skill"]>): WidgetType => ({
  ...PROBE_WIDGET,
  skill,
});

describe("the shipped types' teaching text", () => {
  test("every entry has a use of 1 to 200 characters", () => {
    expect(WIDGET_TYPES.length).toBeGreaterThan(0);
    for (const { type, skill } of WIDGET_TYPES) {
      expect({ type, has: skill !== undefined }).toEqual({ type, has: true });
      expect(skill?.use.length).toBeGreaterThanOrEqual(1);
      expect(skill?.use.length).toBeLessThanOrEqual(200);
      for (const note of skill?.notes ?? []) {
        expect(note.length).toBeGreaterThanOrEqual(1);
        expect(note.length).toBeLessThanOrEqual(300);
      }
    }
  });

  test("hold no AXFX term, as the output format's term test reads them (FR-18)", () => {
    for (const { type, skill } of WIDGET_TYPES) {
      const text = JSON.stringify([skill?.use, skill?.notes]);
      expect({ type, text }).toEqual({ type, text: expect.not.stringMatching(TERMS) });
    }
  });

  test("say what the Tree and the Gantt are for", () => {
    const [tree, gantt] = WIDGET_TYPES;
    expect(tree?.skill?.use).toContain("hierarchy");
    expect(gantt?.skill?.use).toContain("schedule");
  });

  test("the Gantt says when `tasks` is a list and when a map", () => {
    const gantt = WIDGET_TYPES.find(({ type }) => type === "gantt");
    const notes = gantt?.skill?.notes ?? [];
    const named = notes.filter((note) => note.includes("workPackages") && note.includes("tasks"));
    expect(named).toHaveLength(1);
    expect(named[0]?.length).toBeLessThanOrEqual(300);
  });

  test("pass the registry's check", () => {
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
  });
});

describe("the registry's skill rule", () => {
  test("passes the probe type, which has no teaching text", () => {
    expect(PROBE_WIDGET.skill).toBeUndefined();
    expect(widgetRegistryProblems(PROBE_TYPES)).toEqual([]);
  });

  test("passes the bounds: a use of 1 and of 200 characters, a note of 1 and of 300", () => {
    expect(widgetRegistryProblems([taught({ use: "a".repeat(200) })])).toEqual([]);
    expect(widgetRegistryProblems([taught({ use: "a", notes: ["b", "c".repeat(300)] })])).toEqual(
      [],
    );
  });

  test("refuses a use of 201 characters, naming the type", () => {
    const problems = widgetRegistryProblems([taught({ use: "a".repeat(201) })]);
    expect(rulesOf(problems)).toEqual(["probe:skill"]);
    expect(problems[0]?.message).toContain("probe");
    expect(problems[0]?.message).toContain("use");
  });

  test("refuses an empty use", () => {
    expect(rulesOf(widgetRegistryProblems([taught({ use: "" })]))).toEqual(["probe:skill"]);
  });

  test("refuses an empty note and a note of 301 characters, one problem each", () => {
    const empty = widgetRegistryProblems([taught({ use: "ok", notes: [""] })]);
    expect(rulesOf(empty)).toEqual(["probe:skill"]);
    expect(empty[0]?.message).toContain("note");
    const long = widgetRegistryProblems([taught({ use: "ok", notes: ["a", "b".repeat(301)] })]);
    expect(rulesOf(long)).toEqual(["probe:skill"]);
    expect(long[0]?.message).toContain("note 2");
  });
});

// The rule sits in the shape check (widget-registry split the registry's check in two), so that a
// type refused there is refused whoever calls the shape alone.
describe("the skill rule in the registry's shape check", () => {
  test("refuses an out-of-bounds teaching text, naming the type", () => {
    expect(rulesOf(registryShapeProblems([taught({ use: "a".repeat(201) })]))).toEqual([
      "probe:skill",
    ]);
    expect(rulesOf(registryShapeProblems([taught({ use: "ok", notes: [""] })]))).toEqual([
      "probe:skill",
    ]);
  });

  test("passes the shipped types and a type without a teaching text", () => {
    expect(registryShapeProblems(WIDGET_TYPES)).toEqual([]);
    expect(registryShapeProblems(PROBE_TYPES)).toEqual([]);
  });

  test("a use that is not a string is refused rather than thrown at", () => {
    const malformed = { ...PROBE_WIDGET, skill: { use: 3 } } as unknown as WidgetType;
    expect(rulesOf(registryShapeProblems([malformed]))).toEqual(["probe:skill"]);
  });

  // A teaching text of another shape is one problem naming the type, and the other entries of the
  // list are still checked (security review U-1).
  const shapes: readonly [string, unknown][] = [
    ["null", null],
    ["a notes string", { use: "ok", notes: "a note" }],
    ["a notes object", { use: "ok", notes: { a: "b" } }],
    ["a notes number", { use: "ok", notes: 3 }],
  ];
  const checks = [
    ["registryShapeProblems", registryShapeProblems],
    ["widgetRegistryProblems", widgetRegistryProblems],
  ] as const;

  for (const [name, check] of checks) {
    for (const [label, skill] of shapes) {
      test(`${name}: a skill of ${label} is one problem naming the type, with no throw`, () => {
        const malformed = { ...PROBE_WIDGET, skill } as unknown as WidgetType;
        const [tree] = WIDGET_TYPES;
        if (tree === undefined) throw new Error("no tree");
        const long = { ...tree, skill: { use: "a".repeat(201) } };
        const problems = check([malformed, long]).filter(({ rule }) => rule === "skill");
        expect(rulesOf(problems)).toEqual(["probe:skill", `${tree.type}:skill`]);
      });
    }
  }

  test("a notes of null is treated as absent", () => {
    const entry = { ...PROBE_WIDGET, skill: { use: "ok", notes: null } } as unknown as WidgetType;
    expect(registryShapeProblems([entry])).toEqual([]);
  });
});
