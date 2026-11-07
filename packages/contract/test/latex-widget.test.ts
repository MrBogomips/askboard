// The LaTeX's entry (latex-kanban-timeline, task 1.3; contract spec: LaTeX items, LaTeX changes,
// Teaching text of LaTeX, Kanban and Timeline), composed over the shipped registry with
// `withWidgetTypes` while the type is not yet registered (design decision 12), in a fresh Ajv.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  EDIT_WIDGETS_SESSION,
  LATEX_CHANGES,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
  latexAct,
  latexAnswerEvent,
  latexFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  applyElementChanges,
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  cutLatexExpression,
  elementChanges,
  LATEX_EXPRESSION_MAX_CHARS,
  LATEX_SCHEMA_IDS,
  LATEX_SHAPE,
  LATEX_WIDGET,
  latexPropsProblems,
  widgetChangesProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { elementShapeOf, validateBoardMessage } from "../src/validate.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(LATEX_WIDGET);
const ITEM = LATEX_FIXTURE_ITEM;
const latex = (props: unknown, id = "formula") => ({ type: "latex", id, props });
const withExpression = (expression: unknown) => latex({ expression });
const problems = (item: unknown) => askProblems(TYPES, item as ReturnType<typeof latex>);

describe("LaTeX items", () => {
  test("a LaTeX item in a question passes, and the board document built from it validates", () => {
    const item = latex({ expression: "\\frac{a}{b}" });
    expect(problems(item)).toEqual([]);
    expect(askAccepted(TYPES, item)).toBe(true);
    const document = {
      version: BOARD_DOCUMENT_VERSION,
      askId: "latex-check-a1b2",
      title: "Is the formula right?",
      items: [{ type: "question", id: "q", rev: 1, props: { text: "Right?", items: [item] } }],
    };
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.boardDocument, document)).toEqual([]);
    const long = withExpression("x".repeat(2_001));
    const refused = {
      ...document,
      items: [{ ...document.items[0], props: { text: "Q", items: [long] } }],
    };
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.boardDocument, refused)).not.toEqual([]);
  });

  test("an empty expression passes", () => {
    expect(problems(withExpression(""))).toEqual([]);
    expect(askAccepted(TYPES, withExpression(""))).toBe(true);
  });

  test("2,000 characters pass and 2,001 fail, naming the item and expression", () => {
    expect(LATEX_EXPRESSION_MAX_CHARS).toBe(2_000);
    expect(problems(withExpression("x".repeat(2_000)))).toEqual([]);
    expect(askAccepted(TYPES, withExpression("x".repeat(2_000)))).toBe(true);
    const [problem, ...rest] = problems(withExpression("x".repeat(2_001)));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.field).toBe("props.expression");
    expect(problem?.message).toContain('item "formula"');
    expect(problem?.message).toContain("expression");
    expect(askAccepted(TYPES, withExpression("x".repeat(2_001)))).toBe(false);
  });

  test("the limit counts code points: 2,000 astral characters pass, 2,001 fail with the count", () => {
    const astral = (n: number) => "\u{1D465}".repeat(n);
    expect(problems(withExpression(astral(2_000)))).toEqual([]);
    expect(askAccepted(TYPES, withExpression(astral(2_000)))).toBe(true);
    expect(latexPropsProblems({ expression: astral(2_000) })).toEqual([]);
    expect(askAccepted(TYPES, withExpression(astral(2_001)))).toBe(false);
    // The schema refuses first, naming the item and the field; the check words the count.
    const [schemaProblem, ...others] = problems(withExpression(astral(2_001)));
    expect(others).toEqual([]);
    expect(schemaProblem?.itemId).toBe("formula");
    expect(schemaProblem?.field).toBe("props.expression");
    const refused = latexPropsProblems({ expression: astral(2_001) });
    expect(refused.map(({ path }) => path)).toEqual(["/expression"]);
    expect(refused[0]?.message).toContain("2001 characters");
    const check = (value: string) =>
      widgetChangesProblems(
        { type: "latex", id: "formula" },
        [{ op: "set", target: "formula.expression", value }],
        TYPES,
      );
    expect(check(astral(2_000))).toEqual([]);
    expect(check(astral(2_001))).not.toEqual([]);
  });

  test("cutLatexExpression keeps the first 2,000 code points and never splits a pair", () => {
    const astral = (n: number) => "\u{1D465}".repeat(n);
    expect(cutLatexExpression(astral(1_999))).toBe(astral(1_999));
    expect(cutLatexExpression(astral(2_000))).toBe(astral(2_000));
    expect(cutLatexExpression(astral(2_001))).toBe(astral(2_000));
    expect(cutLatexExpression("")).toBe("");
    const mixed = `${"a".repeat(1_999)}\u{1D465}tail`;
    expect(cutLatexExpression(mixed)).toBe(`${"a".repeat(1_999)}\u{1D465}`);
    expect(cutLatexExpression("a".repeat(2_005))).toBe("a".repeat(2_000));
  });

  test("a field the props do not define fails, naming it", () => {
    const [problem, ...rest] = problems(latex({ expression: "x", displayMode: true }));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.field).toBe("props.displayMode");
    expect(problem?.message).toContain("displayMode");
    expect(askAccepted(TYPES, latex({ expression: "x", displayMode: true }))).toBe(false);
  });

  test("props without an expression, or with one that is no text, fail", () => {
    expect(problems(latex({}))[0]?.field).toBe("props.expression");
    expect(problems(withExpression(3))[0]?.field).toBe("props.expression");
    expect(problems(withExpression(null))[0]?.field).toBe("props.expression");
    expect(askAccepted(TYPES, latex({}))).toBe(false);
    expect(askAccepted(TYPES, latex("x"))).toBe(false);
  });

  test("the plain check restates the limits and never throws on props it cannot read", () => {
    expect(latexPropsProblems({ expression: "" })).toEqual([]);
    expect(latexPropsProblems({ expression: "x".repeat(2_000) })).toEqual([]);
    const long = latexPropsProblems({ expression: "x".repeat(2_001) });
    expect(long.map(({ path }) => path)).toEqual(["/expression"]);
    expect(long[0]?.message).toContain("2000");
    expect(latexPropsProblems({ expression: "x", display: 1 }).map(({ path }) => path)).toEqual([
      "/display",
    ]);
    expect(latexPropsProblems({}).map(({ path }) => path)).toEqual(["/expression"]);
    for (const props of [null, 3, "x", [], { expression: null }, { expression: 4 }]) {
      expect(() => latexPropsProblems(props)).not.toThrow();
      expect(latexPropsProblems(props)).not.toEqual([]);
    }
    // The entry runs the same check after the schema, so a schema-valid value gives none.
    expect(LATEX_WIDGET.propsProblems({ expression: "ok" }, "agent")).toEqual([]);
  });
});

describe("LaTeX changes", () => {
  const CHANGES = LATEX_WIDGET.edits?.changes;

  test("the shape names expression alone, and the item's shape is that one", () => {
    expect(LATEX_SHAPE).toEqual({ fields: ["expression"] });
    expect(Object.isFrozen(LATEX_SHAPE)).toBe(true);
    expect(Object.isFrozen(LATEX_SHAPE.fields)).toBe(true);
    expect(elementShapeOf(ITEM, TYPES)).toEqual(LATEX_SHAPE);
    expect(CHANGES?.$id).toBe(LATEX_SCHEMA_IDS.changes);
  });

  test("one set of expression passes, an add and a null set fail, naming the operation", () => {
    const check = (changes: unknown) =>
      widgetChangesProblems({ type: "latex", id: "formula" }, changes, TYPES);
    expect(check([{ op: "set", target: "formula.expression", value: "a" }])).toEqual([]);
    expect(check([{ op: "set", target: "formula.expression", value: "" }])).toEqual([]);
    expect(check([])).toEqual([]);
    const add = check([{ op: "add", target: "formula.e", value: { expression: "a" } }]);
    expect(add[0]?.message).toContain("add");
    expect(add[0]?.message).toContain("item formula");
    const cleared = check([{ op: "set", target: "formula.expression", value: null }]);
    expect(cleared[0]?.message).toContain("operation 0");
    expect(cleared[0]?.message).toContain("set");
  });

  test("a move, a remove, another field, a deeper target and a long value fail", () => {
    const check = (change: unknown) =>
      widgetChangesProblems({ type: "latex", id: "formula" }, [change], TYPES);
    expect(check({ op: "move", target: "formula.expression" })).not.toEqual([]);
    expect(check({ op: "remove", target: "formula.expression" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.display", value: "a" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.x.expression", value: "a" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula", value: "a" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.expression", value: 3 })).not.toEqual([]);
    const value = "x".repeat(2_000);
    expect(check({ op: "set", target: "formula.expression", value })).toEqual([]);
    expect(check({ op: "set", target: "formula.expression", value: `${value}x` })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.expression", value: "a", extra: 1 })).not.toEqual(
      [],
    );
  });

  test("a corrected expression is one set of the whole field, which applies back", () => {
    const changes = elementChanges("formula", ITEM.props, LATEX_EDITED_PROPS, LATEX_SHAPE);
    expect(changes).toEqual([{ op: "set", target: "formula.expression", value: "a^2+b^2=c^2" }]);
    expect(changes).toEqual(LATEX_CHANGES);
    expect(widgetChangesProblems(ITEM, changes, TYPES)).toEqual([]);
    expect(applyElementChanges("formula", ITEM.props, changes, LATEX_SHAPE)).toEqual(
      LATEX_EDITED_PROPS,
    );
  });

  test("an edit of any other key, a display mode say, is refused by the diff", () => {
    expect(() =>
      elementChanges("formula", ITEM.props, { ...LATEX_EDITED_PROPS, display: true }, LATEX_SHAPE),
    ).toThrow("display");
  });
});

describe("the LaTeX's fixtures", () => {
  test("take their version from the constants and hold the edit as the diff gives it", () => {
    expect(latexAct.version).toBe(BOARD_PROTOCOL_VERSION);
    const [act] = latexAct.acts;
    expect(act).toMatchObject({ type: "answer", itemId: EDIT_WIDGETS_SESSION.question });
    expect((act as { values?: unknown }).values).toEqual({ formula: LATEX_EDITED_PROPS });
    expect(latexAnswerEvent.changes).toEqual(LATEX_CHANGES);
    expect(ITEM.props).not.toEqual(LATEX_EDITED_PROPS);
  });

  test("the answer event and the fetch of the item validate", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.answerEvent, latexAnswerEvent)).toEqual([]);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, latexFetchItemResult)).toEqual([]);
    expect(validateBoardMessage("toHost", latexAct).ok).toBe(true);
  });
});

describe("the LaTeX's entry in the registry's own check", () => {
  test("passes over the registry holding it, edits declared and no result or derived", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(LATEX_WIDGET.props.$id).toBe(LATEX_SCHEMA_IDS.props);
    expect(LATEX_WIDGET.result).toBeUndefined();
    expect(LATEX_WIDGET.derived).toBeUndefined();
    expect(LATEX_WIDGET.noun).toBe("a LaTeX");
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = LATEX_WIDGET;
    expect(skill?.use.length).toBeGreaterThanOrEqual(1);
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    expect(skill?.use).toContain("LaTeX");
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.notes?.join(" ")).toContain("<id>.expression");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});

describe("the registry's other modules", () => {
  test("no module of src/widgets outside latex/ and registry.ts names the type", () => {
    const root = new URL("../src/widgets/", import.meta.url);
    const named: string[] = [];
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.parentPath.includes("/latex")) continue;
      if (entry.name === "registry.ts") continue;
      const text = readFileSync(`${entry.parentPath}/${entry.name}`, "utf8");
      // The change's own name is how comments cite it; the type's name is what must not appear.
      if (/latex/i.test(text.replaceAll("latex-kanban-timeline", ""))) named.push(entry.name);
    }
    expect(named).toEqual([]);
  });
});
