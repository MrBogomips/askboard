// A widget type's help text (keyboard-shortcuts-help, task 1.4; contract spec: Help text of a widget
// type): `help` on a registry entry, its bounds in the registry's own check, and the shipped types'
// texts, which the generated help skill reads.

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
const helped = (help: unknown): WidgetType => ({ ...PROBE_WIDGET, help }) as unknown as WidgetType;
const ok = { mouse: "m", answer: "a" };

describe("the shipped types' help text", () => {
  test("all 24 types carry a mouse text and an answer text of 1 to 300 characters", () => {
    expect(WIDGET_TYPES).toHaveLength(24);
    for (const { type, help } of WIDGET_TYPES) {
      expect({ type, has: help !== undefined }).toEqual({ type, has: true });
      for (const text of [help?.mouse, help?.answer]) {
        const length = text?.length ?? 0;
        expect({ type, inBounds: length >= 1 && length <= 300 }).toEqual({ type, inBounds: true });
      }
    }
  });

  test("the Table and the Document review are among them", () => {
    for (const name of ["table", "document-review", "pick-field", "ranking"]) {
      expect(WIDGET_TYPES.find(({ type }) => type === name)?.help).toBeDefined();
    }
  });

  test("are plain text for the user: no Markdown mark, no JSON, no tool name, no AXFX term", () => {
    for (const { type, help } of WIDGET_TYPES) {
      const text = `${help?.mouse} ${help?.answer}`;
      expect({ type, text }).toEqual({ type, text: expect.not.stringMatching(TERMS) });
      expect({ type, text }).toEqual({ type, text: expect.not.stringMatching(/[`{}]/) });
      expect({ type, text }).toEqual({
        type,
        text: expect.not.stringMatching(/\b(ask|update|collect|fetch|snapshot)\(/),
      });
    }
  });

  test("differ from each other and from the teaching text, which is for the agent", () => {
    const mice = WIDGET_TYPES.map(({ help }) => help?.mouse);
    expect(new Set(mice).size).toBe(mice.length);
    for (const { type, help, skill } of WIDGET_TYPES) {
      expect({ type, same: help?.mouse === skill?.use }).toEqual({ type, same: false });
    }
  });

  test("pass the registry's check", () => {
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
  });
});

describe("the registry's help rule", () => {
  test("passes the probe type, which has no help text", () => {
    expect(PROBE_WIDGET.help).toBeUndefined();
    expect(widgetRegistryProblems(PROBE_TYPES)).toEqual([]);
  });

  test("passes the bounds: 1 and 300 characters, each", () => {
    expect(widgetRegistryProblems([helped(ok)])).toEqual([]);
    expect(
      widgetRegistryProblems([helped({ mouse: "a".repeat(300), answer: "b".repeat(300) })]),
    ).toEqual([]);
  });

  test("refuses a mouse text of 301 characters, naming the type and the field", () => {
    const problems = widgetRegistryProblems([helped({ mouse: "a".repeat(301), answer: "ok" })]);
    expect(rulesOf(problems)).toEqual(["probe:help"]);
    expect(problems[0]?.message).toContain('"probe"');
    expect(problems[0]?.message).toContain("mouse");
  });

  test("refuses an answer text of 301 characters and an empty one", () => {
    const long = widgetRegistryProblems([helped({ mouse: "ok", answer: "a".repeat(301) })]);
    expect(rulesOf(long)).toEqual(["probe:help"]);
    expect(long[0]?.message).toContain("answer");
    expect(rulesOf(widgetRegistryProblems([helped({ mouse: "ok", answer: "" })]))).toEqual([
      "probe:help",
    ]);
    expect(rulesOf(widgetRegistryProblems([helped({ mouse: "", answer: "ok" })]))).toEqual([
      "probe:help",
    ]);
  });

  test("both texts out of bounds are two problems", () => {
    expect(rulesOf(widgetRegistryProblems([helped({ mouse: "", answer: "" })]))).toEqual([
      "probe:help",
      "probe:help",
    ]);
  });

  const shapes: readonly [string, unknown][] = [
    ["null", null],
    ["a string", "help"],
    ["a list", ["a", "b"]],
    ["no answer", { mouse: "ok" }],
    ["no mouse", { answer: "ok" }],
    ["numbers", { mouse: 1, answer: 2 }],
  ];
  const checks = [
    ["registryShapeProblems", registryShapeProblems],
    ["widgetRegistryProblems", widgetRegistryProblems],
  ] as const;
  for (const [name, check] of checks) {
    for (const [label, help] of shapes) {
      test(`${name}: help of ${label} is refused, naming the type, with no throw, and the others are still checked`, () => {
        const [tree] = WIDGET_TYPES;
        if (tree === undefined) throw new Error("no tree");
        const long = { ...tree, help: { mouse: "a".repeat(301), answer: "ok" } };
        const problems = check([helped(help), long]).filter(({ rule }) => rule === "help");
        expect(problems.length).toBeGreaterThanOrEqual(2);
        expect(problems[0]?.type).toBe("probe");
        expect(problems.at(-1)?.type).toBe(tree.type);
      });
    }
  }
});
