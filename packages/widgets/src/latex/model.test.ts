// The LaTeX's model (latex-kanban-timeline, task 4.1; view-and-widgets spec: LaTeX source and
// preview; design decisions 3 and 7): the value an edited source gives, as the draft holds it.

import { describe, expect, test } from "bun:test";
import {
  elementChanges,
  LATEX_SHAPE,
  LATEX_WIDGET,
  type LatexProps,
  latexPropsProblems,
  widgetChangesProblems,
} from "@askboard/contract";
import { LATEX_FIXTURE_ITEM, withWidgetTypes } from "@askboard/contract/fixtures";
import { fieldErrorOf, valueFor } from "./model.ts";
import { parseProblem } from "./render.ts";

const SENT: LatexProps = LATEX_FIXTURE_ITEM.props;
const TYPES = withWidgetTypes(LATEX_WIDGET);

describe("the LaTeX's value", () => {
  test("is the props with the typed text as the expression", () => {
    expect(valueFor(SENT, "a^2+b^2=c^2")).toEqual({ expression: "a^2+b^2=c^2" });
  });

  test("is nothing at the agent's expression, so the draft holds no value for the item", () => {
    expect(valueFor(SENT, SENT.expression)).toBeUndefined();
    expect(valueFor({ expression: "" }, "")).toBeUndefined();
  });

  test("is a value again once a text differs by one character, even in case or space", () => {
    expect(valueFor(SENT, `${SENT.expression} `)).toEqual({ expression: `${SENT.expression} ` });
    expect(valueFor(SENT, SENT.expression.toUpperCase())).toBeDefined();
  });

  test("leaves the props it was given untouched", () => {
    const props = Object.freeze({ expression: "x" });
    const value = valueFor(props, "y");
    expect(props).toEqual({ expression: "x" });
    expect(value).not.toBe(props);
  });

  test("keeps an expression that does not parse: the answer carries what was written", () => {
    expect(valueFor(SENT, "\\frac{1}{")).toEqual({ expression: "\\frac{1}{" });
  });

  test.each(["", "x", "\\frac{1}{", "\u{1F600}".repeat(2_000), "a\u202Eb"])(
    "gives, for %p, a value the contract checks pass and one set of the expression",
    (text) => {
      const value = valueFor(SENT, text);
      expect(value).toBeDefined();
      expect(latexPropsProblems(value)).toEqual([]);
      const changes = elementChanges("formula", SENT, value as LatexProps, LATEX_SHAPE);
      expect(changes).toEqual([{ op: "set", target: "formula.expression", value: text }]);
      expect(widgetChangesProblems({ type: "latex", id: "formula" }, changes, TYPES)).toEqual([]);
    },
  );
});

// The field error of each kind of `renderInto`'s result (design decision 7; view-and-widgets spec:
// LaTeX parse errors, LaTeX bounded work, LaTeX output bounded): the string key and its values.
describe("the LaTeX's field error", () => {
  test("is none for a drawn expression", () => {
    expect(fieldErrorOf({})).toBeUndefined();
  });

  test("is KaTeX's own message for an expression that does not parse", () => {
    const problem = parseProblem("\\frac{1}{");
    expect(typeof problem).toBe("string");
    expect(fieldErrorOf({ error: problem as string })).toEqual({
      key: "latex.parseError",
      values: { message: problem as string },
    });
  });

  test("is the fixed text for a failure that carries no message", () => {
    expect(fieldErrorOf({ error: "" })).toEqual({ key: "latex.drawFailed", values: {} });
  });

  test.each(["\\def", "\\gdef", "\\newcommand", "\\let", "\\global"])(
    "names %s, a macro definition",
    (command) => {
      expect(fieldErrorOf({ refused: { command } })).toEqual({
        key: "latex.macroDefinition",
        values: { command },
      });
    },
  );

  test.each(["\\current@color", "\\df@tag", "\\@ifnextchar"])(
    "names %s, an internal command",
    (command) => {
      expect(fieldErrorOf({ refused: { command } })).toEqual({
        key: "latex.internalCommand",
        values: { command },
      });
    },
  );

  test.each(["\\show", "\\char`"])("names %s, a command the item does not allow", (command) => {
    expect(fieldErrorOf({ refused: { command } })).toEqual({
      key: "latex.refusedCommand",
      values: { command },
    });
  });

  test("names the depth and the limit of a nest past it", () => {
    expect(fieldErrorOf({ refused: { depth: 12, limit: 11 } })).toEqual({
      key: "latex.tooDeep",
      values: { depth: 12, limit: 11 },
    });
  });

  test("says an output past the bounds is too complex to preview", () => {
    expect(fieldErrorOf({ tooComplex: { depth: 300, nodes: 1, fractions: 0 } })).toEqual({
      key: "latex.tooComplex",
      values: {},
    });
  });

  test("agrees with what the scan and the bounds give for real expressions", () => {
    const keyOf = (expression: string) => {
      const problem = parseProblem(expression);
      if (problem === undefined) return undefined;
      return fieldErrorOf(typeof problem === "string" ? { error: problem } : problem)?.key;
    };
    expect(keyOf("a^2")).toBeUndefined();
    expect(keyOf("\\def\\a{x}\\a")).toBe("latex.macroDefinition");
    expect(keyOf("\\color{x}\\current@color")).toBe("latex.internalCommand");
    expect(keyOf("\\show\\a")).toBe("latex.refusedCommand");
    expect(keyOf(`${"\\frac{".repeat(12)}x${"}{x}".repeat(12)}`)).toBe("latex.tooDeep");
    expect(keyOf("\\frac{1}{")).toBe("latex.parseError");
    expect(keyOf(`a${"\u0301".repeat(48)}`)).toBe("latex.tooComplex");
  });
});
