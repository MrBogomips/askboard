import { describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS } from "@askboard/contract";
import {
  depthOfFixture,
  fixtureFor,
  LATEX_CONSTRUCTS,
  nestBranching,
  SHAPES,
} from "./latex-fixtures.ts";

const DEPTHS = [4, 5, 8, 11, 12, 16, 23, 24];

describe("the LaTeX fixtures of the bounds scenarios", () => {
  test("the constructs are the seventeen of task 4.10, each named once", () => {
    expect(LATEX_CONSTRUCTS).toHaveLength(17);
    expect(new Set(LATEX_CONSTRUCTS.map(({ name }) => name)).size).toBe(17);
  });

  for (const c of LATEX_CONSTRUCTS) {
    test(`${c.name}: every shape at every depth reads as that depth and fits the limit`, () => {
      for (const shape of SHAPES) {
        for (const depth of DEPTHS) {
          const expression = fixtureFor(c, shape, depth);
          expect([...expression].length, `${shape} ${depth}`).toBeLessThanOrEqual(
            LATEX_EXPRESSION_MAX_CHARS,
          );
          expect(depthOfFixture(expression), `${shape} ${depth}`).toBe(depth);
        }
      }
    });
  }

  test("side by side fills the limit, and a branching nest holds more than one copy", () => {
    const frac = LATEX_CONSTRUCTS[0];
    if (frac === undefined) throw new Error("no construct");
    const side = fixtureFor(frac, "side by side", 8);
    expect(side.length).toBeGreaterThan(
      LATEX_EXPRESSION_MAX_CHARS - fixtureFor(frac, "alone", 8).length,
    );
    const branching = nestBranching(frac, 12);
    expect(branching.length).toBeGreaterThan(fixtureFor(frac, "alone", 12).length);
    expect(branching.length).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
    expect(branching.length).toBeGreaterThan(LATEX_EXPRESSION_MAX_CHARS / 2);
  });
});
