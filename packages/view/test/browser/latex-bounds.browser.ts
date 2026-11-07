// The LaTeX bounds, in each engine (latex-kanban-timeline, tasks 4.11 and 4.16; view-and-widgets spec:
// LaTeX bounded work, scenarios "Nests at and past the limit" and "Nests the scan once missed", and
// LaTeX output bounded, scenario "Too complex to preview"; design decision 7, Bounded work and
// Bounded output): every fixture of the depth probe at `LATEX_NESTING_MAX_DEPTH`, alone, side by
// side to 2,000 code points and as a branching nest, goes through the board's `renderInto` with
// KaTeX's fonts, is drawn in under 2 seconds with no crash, and the parent page answers after each;
// the two forms the scan once missed give the depth's refusal; and an output past bounds lowered
// from the test inserts no node. A bare render in a sandboxed frame: no server, no board.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/latex-bounds.browser.ts

import { afterAll, describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS, LATEX_NESTING_MAX_DEPTH, scanLatex } from "@askboard/contract";
import { enginesFrom } from "./harness/engines.ts";
import {
  depthOfFixture,
  fixtureFor,
  katexControlWords,
  LATEX_CONSTRUCTS,
  SHAPES,
} from "./harness/latex-fixtures.ts";
import {
  controlWordConstructs,
  EXTRA_CONSTRUCTS,
  optionalArgumentWords,
} from "./harness/latex-forms.ts";
import { LatexFrame, PARENT_ANSWER_MS } from "./harness/latex-frame.ts";
import { LATEX_SOURCES, loadMeasurer } from "./harness/latex-measure.ts";

const RENDER_BOUND_MS = 2_000;
const TEST_TIMEOUT_MS = 60_000;
const LIMIT = LATEX_NESTING_MAX_DEPTH;

// Every family task 4.15 measured: its 17 constructs, the infix, hidden-opener, environment and
// style forms, and every control word with arguments in each argument position that KaTeX parses.
const measure = await loadMeasurer();
const FORMS = controlWordConstructs(
  katexControlWords(LATEX_SOURCES.katex),
  measure,
  optionalArgumentWords(LATEX_SOURCES.katex),
).forms;
const FAMILIES = [...LATEX_CONSTRUCTS, ...EXTRA_CONSTRUCTS, ...FORMS];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a LaTeX nest at the limit`, () => {
    const frame = new LatexFrame(engine);
    afterAll(() => frame.close());

    for (const construct of FAMILIES) {
      test(
        `${construct.name}: alone, side by side and branching, is drawn within ${RENDER_BOUND_MS} ms and the page answers`,
        async () => {
          for (const shape of SHAPES) {
            const expression = fixtureFor(construct, shape, LIMIT);
            // A nest KaTeX does not parse at this depth has nothing to draw.
            if (!measure(expression).parses) continue;
            const where = `${construct.name}, ${shape}`;
            expect(depthOfFixture(expression), where).toBeLessThanOrEqual(LIMIT);
            if (LATEX_CONSTRUCTS.includes(construct)) {
              expect(depthOfFixture(expression), where).toBe(LIMIT);
            }
            expect([...expression].length, where).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
            const result = await frame.rendering(expression);
            if (!result.ok) throw new Error(`${where}: ${result.reason}: ${result.message}`);
            expect(result.ms, where).toBeLessThan(RENDER_BOUND_MS);
            expect(result.parentMs, where).toBeLessThan(PARENT_ANSWER_MS);
            // A macro definition is refused by the scan whatever its depth, KaTeX does not run.
            const refused = scanLatex(expression).refused;
            if (refused !== undefined) {
              expect(result.rendered, where).toEqual({ refused: { command: refused } });
              continue;
            }
            // Drawn: no refusal, no "too complex", no error, and the elements are in the page.
            expect(result.rendered, where).toEqual({});
            expect(result.nodes, where).toBeGreaterThan(1);
            expect(result.ms, where).toBeLessThan(RENDER_BOUND_MS);
            expect(result.parentMs, where).toBeLessThan(PARENT_ANSWER_MS);
          }
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      `one level past the limit is refused naming the depth and the limit, and KaTeX does not draw`,
      async () => {
        const kept = await frame.rendering("x^2");
        if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
        for (const construct of LATEX_CONSTRUCTS) {
          for (const shape of SHAPES) {
            const expression = fixtureFor(construct, shape, LIMIT + 1);
            const result = await frame.rendering(expression);
            if (!result.ok)
              throw new Error(`${construct.name}: ${result.reason}: ${result.message}`);
            expect(result.rendered, `${construct.name}, ${shape}`).toEqual({
              refused: { depth: LIMIT + 1, limit: LIMIT },
            });
            expect(result.nodes, `${construct.name}, ${shape}`).toBe(kept.nodes);
            expect(result.parentMs).toBeLessThan(PARENT_ANSWER_MS);
          }
        }
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the nests the scan once missed`, () => {
    const frame = new LatexFrame(engine);
    afterAll(() => frame.close());
    const FORMS_MISSED = [
      [
        "an infix fraction nested 11 times",
        `${"\\frac{".repeat(11)}x${"\\over y}{x}".repeat(11)}`,
        22,
      ],
      [
        "a character code and a blank before an opener, 130 times",
        `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`,
        260,
      ],
    ] as const;

    test.each(FORMS_MISSED)(
      "%s: the field error names the depth and the limit within 2 seconds, KaTeX does not run, the renderer does not crash",
      async (_name, expression, depth) => {
        const kept = await frame.rendering("x^2");
        if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
        const result = await frame.rendering(expression);
        if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
        expect(result.rendered).toEqual({ refused: { depth, limit: LIMIT } });
        expect(result.ms).toBeLessThan(RENDER_BOUND_MS);
        expect(result.nodes).toBe(kept.nodes);
        expect(result.parentMs).toBeLessThan(PARENT_ANSWER_MS);
        // The engine is still the same one: a draw after the refusal works.
        const after = await frame.rendering("\\frac{a}{b}");
        expect(after.ok && after.rendered).toEqual({});
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: an output past bounds lowered by the test`, () => {
    const frame = new LatexFrame(engine);
    afterAll(() => frame.close());
    const LOWERED = [
      ["a depth of 5", "\\frac{a}{b}", { depth: 5, nodes: 1_000, fractions: 11 }],
      ["100 nodes", "x".repeat(2_000), { depth: 100, nodes: 100, fractions: 11 }],
      [
        "a fraction bound of 3",
        "\\frac{\\frac{\\frac{\\frac{a}{b}}{c}}{d}}{e}",
        { depth: 1_000, nodes: 100_000, fractions: 3 },
      ],
    ] as const;

    test.each(LOWERED)(
      "%s: too complex, no node inserted, the preview keeps its last render and the page answers",
      async (_name, expression, bounds) => {
        const kept = await frame.rendering("x^2");
        if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
        const result = await frame.rendering(expression, bounds);
        if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
        expect(result.rendered.tooComplex).toBeDefined();
        expect(Object.keys(result.rendered)).toEqual(["tooComplex"]);
        expect(result.nodes).toBe(kept.nodes);
        expect(result.parentMs).toBeLessThan(PARENT_ANSWER_MS);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the scenario: with a fraction bound of 3, four nested fractions are too complex, three and four side by side are drawn",
      async () => {
        const bounds = { depth: 1_000, nodes: 100_000, fractions: 3 };
        const expressions = [
          "\\frac{\\frac{\\frac{\\frac{a}{b}}{c}}{d}}{e}",
          "\\frac{\\frac{\\frac{a}{b}}{c}}{d}",
          "\\frac{a}{b}\\frac{c}{d}\\frac{e}{f}\\frac{g}{h}",
        ];
        const results = [];
        for (const expression of expressions) {
          const result = await frame.rendering(expression, bounds);
          if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
          results.push(result);
        }
        expect(results[0]?.rendered.tooComplex).toBeDefined();
        expect(results[1]?.rendered).toEqual({});
        expect(results[2]?.rendered).toEqual({});
        // The first inserted nothing: the page held the element of the draw before it.
        expect(results[1]?.nodes).toBeGreaterThan(1);
        expect(results[2]?.nodes).toBeGreaterThan(1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
