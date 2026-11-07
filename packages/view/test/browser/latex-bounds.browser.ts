// The LaTeX bounds, in each engine (latex-kanban-timeline, task 4.11; view-and-widgets spec: LaTeX
// bounded work, scenario "Nests at and past the limit"; design decision 7, Bounded work): every
// fixture of the depth probe at `LATEX_NESTING_MAX_DEPTH`, alone, side by side to 2,000 code points
// and as a branching nest, renders with KaTeX's fonts in under 2 seconds with no crash, and the
// parent page answers after each. A bare render in a sandboxed frame: no server, no board. The
// engine's time budget is the contract's limit, which task 4.10 measured with this same helper.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/latex-bounds.browser.ts

import { afterAll, describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS, LATEX_NESTING_MAX_DEPTH } from "@askboard/contract";
import { enginesFrom } from "./harness/engines.ts";
import { depthOfFixture, fixtureFor, LATEX_CONSTRUCTS, SHAPES } from "./harness/latex-fixtures.ts";
import { LatexFrame, PARENT_ANSWER_MS } from "./harness/latex-frame.ts";

const RENDER_BOUND_MS = 2_000;
const TEST_TIMEOUT_MS = 60_000;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a LaTeX nest at the limit`, () => {
    const frame = new LatexFrame(engine);
    afterAll(() => frame.close());

    for (const construct of LATEX_CONSTRUCTS) {
      for (const shape of SHAPES) {
        test(
          `${construct.name}, ${shape}, renders within ${RENDER_BOUND_MS} ms and the page answers`,
          async () => {
            const expression = fixtureFor(construct, shape, LATEX_NESTING_MAX_DEPTH);
            expect(depthOfFixture(expression)).toBe(LATEX_NESTING_MAX_DEPTH);
            expect([...expression].length).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
            const result = await frame.render(expression);
            if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
            expect(result.nodes).toBeGreaterThan(1);
            expect(result.ms).toBeLessThan(RENDER_BOUND_MS);
            expect(result.parentMs).toBeLessThan(PARENT_ANSWER_MS);
          },
          TEST_TIMEOUT_MS,
        );
      }
    }
  });
}
