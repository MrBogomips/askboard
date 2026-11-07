import { describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS } from "@askboard/contract";
import { depthOfFixture, fixtureFor, SHAPES } from "./latex-fixtures.ts";
import {
  ENVIRONMENT_CONSTRUCTS,
  EXTRA_CONSTRUCTS,
  HIDDEN_CONSTRUCTS,
  INFIX_CONSTRUCTS,
  STYLE_CONSTRUCTS,
} from "./latex-forms.ts";

const DEPTHS = [4, 5, 9, 14, 23];

describe("the fixed families of the bounds scenarios", () => {
  test("nine infix forms, three hidden-opener forms, five environments and one style form", () => {
    expect(INFIX_CONSTRUCTS).toHaveLength(9);
    expect(HIDDEN_CONSTRUCTS).toHaveLength(3);
    expect(ENVIRONMENT_CONSTRUCTS).toHaveLength(5);
    expect(STYLE_CONSTRUCTS).toHaveLength(1);
    expect(EXTRA_CONSTRUCTS).toHaveLength(18);
    expect(new Set(EXTRA_CONSTRUCTS.map(({ name }) => name)).size).toBe(EXTRA_CONSTRUCTS.length);
  });

  for (const c of EXTRA_CONSTRUCTS) {
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
});
