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
import { valueFor } from "./model.ts";

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
