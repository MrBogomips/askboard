// What a result requires of its answer (approval-scale-ranking, task 1.2; contract spec, "What a
// result requires of its answer"): `answerProblems` on a type's `result`, `widgetAnswerProblems`
// prefixing each problem with its item, and `withWidgetTypes`, which tests use to register an
// entry through the registry parameter. Proven with a test-made entry.

import { describe, expect, test } from "bun:test";
import { PROBE_WIDGET, withWidgetTypes } from "../src/fixtures/index.ts";
import {
  WIDGET_TYPES,
  type WidgetType,
  widgetAnswerProblems,
  widgetRegistryProblems,
} from "../src/index.ts";

const { result } = PROBE_WIDGET;
if (result === undefined) throw new Error("the probe gives a result");

// A test-made entry: it wants a note, and refuses a changed answer.
const CAREFUL: WidgetType = {
  ...PROBE_WIDGET,
  result: {
    ...result,
    answerProblems: (_, answer) => [
      ...(answer.note === undefined ? ["the answer needs a note"] : []),
      ...(answer.changed ? ["the answer may not change anything"] : []),
    ],
  },
};
const TYPES = withWidgetTypes(CAREFUL);
const ITEM = { type: "probe", id: "pick" } as const;
const PICK = { pick: "a" };

describe("widgetAnswerProblems", () => {
  test("prefixes each problem of the entry with the item", () => {
    const problems = widgetAnswerProblems(ITEM, PICK, { note: undefined, changed: true }, TYPES);
    expect(problems).toEqual([
      "item pick: the answer needs a note",
      "item pick: the answer may not change anything",
    ]);
  });

  test("gives the entry the result and the answer's note and change flag", () => {
    const seen: unknown[] = [];
    const spy: WidgetType = {
      ...PROBE_WIDGET,
      result: { ...result, answerProblems: (...args) => (seen.push(args), []) },
    };
    widgetAnswerProblems(ITEM, PICK, { note: "why", changed: false }, withWidgetTypes(spy));
    expect(seen).toEqual([[PICK, { note: "why", changed: false }]]);
  });

  test("gives none for an answer the entry accepts", () => {
    expect(widgetAnswerProblems(ITEM, PICK, { note: "ok", changed: false }, TYPES)).toEqual([]);
  });

  test("gives none for a type whose result has no answer checks", () => {
    expect(
      widgetAnswerProblems(ITEM, PICK, { note: undefined, changed: true }, [PROBE_WIDGET]),
    ).toEqual([]);
  });

  test("gives none for a type that declares no result", () => {
    const { result: _, ...bare } = PROBE_WIDGET;
    expect(
      widgetAnswerProblems(ITEM, PICK, { note: undefined, changed: true }, [bare as WidgetType]),
    ).toEqual([]);
  });

  test("gives none for a type the registry does not hold: the result check refuses it", () => {
    const stranger = { type: "spreadsheet", id: "board" };
    expect(widgetAnswerProblems(stranger, PICK, { note: undefined, changed: true }, TYPES)).toEqual(
      [],
    );
  });

  test("reads the shipped registry by default, whose types ask nothing of an answer", () => {
    for (const { type } of WIDGET_TYPES) {
      expect(
        widgetAnswerProblems({ type, id: "x" }, { any: 1 }, { note: undefined, changed: true }),
      ).toEqual([]);
    }
  });
});

describe("withWidgetTypes", () => {
  test("gives the shipped registry then the entries it does not hold", () => {
    expect(withWidgetTypes(CAREFUL)).toEqual([...WIDGET_TYPES, CAREFUL]);
    expect(withWidgetTypes()).toEqual([...WIDGET_TYPES]);
  });

  test("appends an entry once, however many times it is given", () => {
    expect(withWidgetTypes(CAREFUL, CAREFUL)).toEqual([...WIDGET_TYPES, CAREFUL]);
  });

  test("never adds a type the registry already holds", () => {
    const [first] = WIDGET_TYPES;
    if (first === undefined) throw new Error("the registry holds types");
    expect(withWidgetTypes(first, { ...first })).toEqual([...WIDGET_TYPES]);
    expect(withWidgetTypes(CAREFUL, first)).toEqual([...WIDGET_TYPES, CAREFUL]);
  });

  test("leaves the shipped registry as it is", () => {
    const before = [...WIDGET_TYPES];
    withWidgetTypes(CAREFUL);
    expect(WIDGET_TYPES).toEqual(before);
  });

  test("passes the registry's own check with the test-made entry", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });
});
