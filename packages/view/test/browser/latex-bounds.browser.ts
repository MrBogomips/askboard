// The LaTeX bounds, in each engine (latex-kanban-timeline, tasks 4.11 and 4.16; view-and-widgets spec:
// LaTeX bounded work, scenarios "Nests at and past the limit" and "Nests the scan once missed", and
// LaTeX output bounded, scenario "Too complex to preview"; design decision 7, Bounded work and
// Bounded output): every fixture of the depth probe at `LATEX_NESTING_MAX_DEPTH`, alone, side by
// side to 2,000 code points and as a branching nest, goes through the board's `renderInto` with
// KaTeX's fonts, is drawn in under 2 seconds with no crash, and the parent page answers after each;
// the two forms the scan once missed give the depth's refusal; and an output past bounds lowered
// from the test inserts no node. A bare render in a sandboxed frame: no server, no board. Since
// task 6.8 the same bounds are also met through a board on the widget host (the second half of the
// file), where the LaTeX item, its field, its queue and KaTeX's stylesheet and fonts as the `latex`
// chunk carries them are the ones a user types into.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/latex-bounds.browser.ts

import { afterAll, describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS, LATEX_NESTING_MAX_DEPTH, scanLatex } from "@askboard/contract";
import type { ViewDocument } from "../../src/view-document.ts";
import { latexDocument, latexItem, latexItemsDocument } from "./fixtures/latex-documents.ts";
import { eventually } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  cleared,
  type DrawLog,
  drawLog,
  keyAnswered,
  lagOf,
  resetLag,
  type Settled,
  SHOW_BOUND_MS,
  shownAt,
  sourceAt,
  typeAndSettle,
  watching,
} from "./harness/latex-board.ts";
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
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
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
        { depth: 22, limit: LIMIT },
      ],
      [
        "a character code and a blank before an opener, 130 times (refused by name since task 4.21)",
        `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`,
        { command: "\\char`" },
      ],
      [
        "\\show taking a \\verb token whole, in fractions (the 4.19 re-review's X-1)",
        `${"\\frac{\\show\\verb|}|".repeat(18)}x${"}{x}".repeat(18)}`,
        { command: "\\show" },
      ],
      [
        "\\show taking a \\verb token whole, in batches of \\sqrt{ (the 4.19 re-review's X-1)",
        `${`${"\\sqrt{".repeat(11)}\\show\\verb|${"}".repeat(11)}|`.repeat(12)}x${"}".repeat(132)}`,
        { command: "\\show" },
      ],
    ] as const;

    test.each(FORMS_MISSED)(
      "%s: the field error names the refusal within 2 seconds, KaTeX does not run, the renderer does not crash",
      async (_name, expression, refused) => {
        const kept = await frame.rendering("x^2");
        if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
        const result = await frame.rendering(expression);
        if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
        expect(result.rendered).toEqual({ refused });
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

  // Task 4.22 (4.19 re-review S-1; view-and-widgets spec: LaTeX output bounded, scenario "Too
  // complex to preview"): combining marks after a character, which the contract's scan passes with
  // no level, at the board's default bounds. Drawn with no bound, 130 marks crash Chromium.
  describe(`${engine}: combining marks at the default bounds`, () => {
    const frame = new LatexFrame(engine);
    afterAll(() => frame.close());
    const MARK = String.fromCodePoint(0x301);
    const marks = (count: number, base = "a", close = "") => `${base}${MARK.repeat(count)}${close}`;

    test(
      "a and 47 marks is drawn within the render bound and the page answers",
      async () => {
        const kept = await frame.rendering("x^2");
        if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
        const result = await frame.rendering(marks(47));
        if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
        expect(result.rendered).toEqual({});
        expect(result.ms).toBeLessThan(RENDER_BOUND_MS);
        expect(result.nodes).toBeGreaterThan(kept.nodes);
        expect(result.parentMs).toBeLessThan(PARENT_ANSWER_MS);
      },
      TEST_TIMEOUT_MS,
    );

    test.each([
      ["a and 48 marks", marks(48)],
      ["a and 130 marks", marks(130)],
      ["\\text{a and 130 marks}", marks(130, "\\text{a", "}")],
    ] as const)(
      "%s: the contract passes it, the output is too complex, no node is inserted, the renderer does not crash and the page answers",
      async (_name, expression) => {
        expect(scanLatex(expression).refused).toBeUndefined();
        expect(scanLatex(expression).depth).toBeLessThanOrEqual(LIMIT);
        expect([...expression].length).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
        const kept = await frame.rendering("x^2");
        if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
        const result = await frame.rendering(expression);
        if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
        expect(Object.keys(result.rendered)).toEqual(["tooComplex"]);
        expect(result.rendered.tooComplex?.depth).toBeGreaterThan(245);
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

// The scenarios of the board's own half. Each expression is typed into the source field, timed
// from the input to the preview or the field error it gives, and a key press in the field is timed
// to its answer afterwards. "KaTeX does not run" is read as the page creating no MathML element
// (only KaTeX's output makes one), the preview's markup staying as it was and the field error being
// the board's own words, which only the scan writes before KaTeX is asked.
const nestedPast = (depth: number) => `${"\\frac{".repeat(depth)}x${"}{x}".repeat(depth)}`;
const REFUSED_BY_NAME =
  (name: string, rest = "") =>
  (error: string | null) =>
    error?.startsWith(`This expression ${rest}${name}`) === true;
const DEFINITION = "\\def\\b{" + "x".repeat(900) + "}\\def\\a{";
const XS = (count: number) => "x".repeat(count);
const FORMS_REFUSED = [
  ["\\def\\a{\\a}\\a", "defines a macro with \\def,"],
  [`${DEFINITION}${"\\b".repeat(40)}}\\a`, "defines a macro with \\def,"],
  [`${DEFINITION}${"\\b".repeat(540)}}\\a`, "defines a macro with \\def,"],
  [
    `\\def\\b{${XS(900)}}\\def\\c{${"\\b".repeat(40)}}\\def\\d{${"\\c".repeat(13)}}\\d`,
    "defines a macro with \\def,",
  ],
  [
    `\\color{${XS(900)}}${"\\current@color".repeat(78)}`,
    "uses \\current@color, one of KaTeX's internal",
  ],
  [`\\tag{$${XS(900)}$}${"\\df@tag".repeat(156)}`, "uses \\df@tag, one of KaTeX's internal"],
  [
    `\\tag{$\\color{${XS(1_200)}}${"\\current@color".repeat(20)}$}${"\\df@tag".repeat(20)}`,
    "uses \\current@color, one of KaTeX's internal",
  ],
] as const;

const expectSettled = (where: string, settled: Settled) => {
  expect(settled.ms, where).toBeLessThan(SHOW_BOUND_MS);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the LaTeX bounds on a board`, () => {
    const { host } = useWidgetHost(engine);
    const boardWith = async () => {
      const run = await host(dist, latexDocument("x^2"), { prepare: watching });
      await readyIn(run);
      return run;
    };
    // Types an expression and gives what the item shows, after the checks every case shares. An
    // item showing a field error first takes a valid expression, so that the next error is a change.
    let flip = false;
    const typed = async (run: Awaited<ReturnType<typeof boardWith>>, expression: string) => {
      flip = !flip;
      const base = await cleared(run.board, 0, flip ? "y^3" : "z^3");
      const settled = await typeAndSettle(run.board, 0, expression, base);
      expectSettled(expression.slice(0, 40), settled);
      return { settled, before: base.markup };
    };

    test(
      "a macro definition, an internal command and the review's nested forms give their field error within 2 seconds, create no node, keep the preview, and a key press is answered afterwards",
      async () => {
        const run = await boardWith();
        const times: number[] = [];
        for (const [expression, words] of FORMS_REFUSED) {
          const where = `${expression.slice(0, 30)}… (${[...expression].length} code points)`;
          expect([...expression].length, where).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
          const { settled, before } = await typed(run, expression);
          expect(REFUSED_BY_NAME(words)(settled.error), `${where}: ${settled.error}`).toBe(true);
          expect(settled.created, where).toBe(0);
          expect((await shownAt(run.board, 0)).markup, where).toBe(before);
          expect(await keyAnswered(run.board, 0, "z"), where).toBeLessThan(SHOW_BOUND_MS);
          times.push(Math.round(settled.ms));
        }
        console.log(`[6.8 ${engine}] refused forms, ms to the field error: ${times.join(", ")}`);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a nest one level past the limit gives the depth's field error naming the depth and the limit, creates no node and keeps the preview, in each shape",
      async () => {
        const run = await boardWith();
        for (const construct of LATEX_CONSTRUCTS) {
          for (const shape of SHAPES) {
            const where = `${construct.name}, ${shape}`;
            const { settled, before } = await typed(run, fixtureFor(construct, shape, LIMIT + 1));
            expect(settled.error, where).toStartWith(
              `This expression nests ${LIMIT + 1} levels deep, more than the limit of ${LIMIT}.`,
            );
            expect(settled.created, where).toBe(0);
            expect((await shownAt(run.board, 0)).markup, where).toBe(before);
          }
          expect(await keyAnswered(run.board, 0, "z")).toBeLessThan(SHOW_BOUND_MS);
        }
      },
      3 * TEST_TIMEOUT_MS,
    );

    test(
      "the two forms the scan once missed give their field error, the depth and the limit for the infix form and the command \\char` for the other, the renderer surviving",
      async () => {
        const run = await boardWith();
        const infix = `${"\\frac{".repeat(11)}x${"\\over y}{x}".repeat(11)}`;
        const char = `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`;
        for (const [expression, error] of [
          [infix, `This expression nests 22 levels deep, more than the limit of ${LIMIT}.`],
          [char, "This expression uses \\char`, which a LaTeX item does not allow."],
        ] as const) {
          const { settled, before } = await typed(run, expression);
          expect(settled.error).toStartWith(error);
          expect(settled.created).toBe(0);
          expect((await shownAt(run.board, 0)).markup).toBe(before);
          expect(await keyAnswered(run.board, 0, "z")).toBeLessThan(SHOW_BOUND_MS);
        }
        // The same renderer draws again.
        const { settled } = await typed(run, "\\frac{a}{b}");
        expect(settled.error).toBeNull();
        expect(settled.drawn).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    // Each family of task 4.15 at the limit, alone, side by side and branching, through the field.
    test(
      "every family at the nesting limit, alone, side by side to 2,000 code points and branching, is drawn within 2 seconds and the board answers after each family",
      async () => {
        const run = await boardWith();
        const slowest: { where: string; ms: number }[] = [];
        for (const family of FAMILIES) {
          for (const shape of SHAPES) {
            const expression = fixtureFor(family, shape, LIMIT);
            if (!measure(expression).parses) continue;
            const where = `${family.name}, ${shape}`;
            const { settled, before } = await typed(run, expression);
            slowest.push({ where, ms: settled.ms });
            const refused = scanLatex(expression).refused;
            if (refused !== undefined) {
              expect(settled.error, where).toContain(refused);
              expect((await shownAt(run.board, 0)).markup, where).toBe(before);
              continue;
            }
            expect(settled.error, where).toBeNull();
            expect(settled.drawn, where).toBe(true);
          }
          expect(await keyAnswered(run.board, 0, "z"), family.name).toBeLessThan(SHOW_BOUND_MS);
        }
        slowest.sort((a, b) => b.ms - a.ms);
        console.log(
          `[6.8 ${engine}] ${slowest.length} expressions; slowest: ${slowest
            .slice(0, 3)
            .map((one) => `${one.where} ${Math.round(one.ms)} ms`)
            .join("; ")}`,
        );
      },
      5 * TEST_TIMEOUT_MS,
    );

    test(
      "flat expressions of 2,000 code points draw: 2,000 plain glyphs, 666 \\le and a matrix of 400 cells; 666 \\ne gives KaTeX's Too many expansions",
      async () => {
        const run = await boardWith();
        const rows = Array.from({ length: 20 }, () => Array(20).fill("a").join("&")).join("\\\\");
        const times: string[] = [];
        for (const [name, expression] of [
          ["2,000 plain glyphs", "a".repeat(2_000)],
          ["666 \\le", "\\le".repeat(666)],
          ["a matrix of 400 cells", `\\begin{matrix}${rows}\\end{matrix}`],
        ] as const) {
          expect([...expression].length, name).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
          const { settled } = await typed(run, expression);
          expect(settled.error, name).toBeNull();
          expect(settled.drawn, name).toBe(true);
          expect(await keyAnswered(run.board, 0, "z"), name).toBeLessThan(SHOW_BOUND_MS);
          times.push(`${name} ${Math.round(settled.ms)}`);
        }
        const { settled, before } = await typed(run, "\\ne".repeat(666));
        times.push(`666 \\ne ${Math.round(settled.ms)}`);
        console.log(`[6.8 ${engine}] flat expressions, ms: ${times.join("; ")}`);
        expect(settled.error).toContain("Too many expansions");
        expect(settled.error?.startsWith("This expression does not render")).toBe(true);
        expect((await shownAt(run.board, 0)).markup).toBe(before);
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// Task 6.8, "LaTeX previews one at a time": a question of ten LaTeX items, each the slowest
// expression within the scan's limit that task 4.15's measurement found in WebKit (`\\tfrac`'s first
// argument nested to the limit, side by side; `\\dfrac` and `\\frac` follow within 5%), draws every
// preview while keys and an edit in the last item's field are answered.
const SLOWEST = FORMS.find((form) => form.name === "\\tfrac arg 1 of 2");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: ten LaTeX items`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "ten of the slowest expression draw every preview while a key press in the last field is answered within 2 seconds, and an expression typed in it shows within 2 seconds of the input",
      async () => {
        if (SLOWEST === undefined) throw new Error("task 4.15's \\tfrac form is not measured");
        const expression = fixtureFor(SLOWEST, "side by side", LIMIT);
        expect(scanLatex(expression).refused).toBeUndefined();
        expect([...expression].length).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
        const named = (text: string) =>
          Array.from({ length: 10 }, (_, at) => latexItem(text, `item${at}`));
        // The board opens with ten short expressions, drawn; the agent then changes every one to
        // the slow expression, so that ten draws are asked for at once, and the user types at once.
        const run = await host(dist, latexItemsDocument(named("x")), { prepare: watching });
        const { board } = run;
        await readyIn(run);
        const drawn = () => board.view.locator("[data-latex-preview] .katex").count();
        await eventually(async () => (await drawn()) === 10, "ten short previews");
        await resetLag(board);
        const changed = latexItemsDocument(named(expression));
        const [question] = (changed as unknown as { items: { rev: number }[] }).items;
        if (question === undefined) throw new Error("no question");
        const next = { ...changed, items: [{ ...question, rev: question.rev + 1 }] };
        // The field is taken before the draws start: while they run WebKit answers the test's
        // calls into the page only between draws, but a key or text from the browser's input
        // reaches the page as a user's would. The wall clock times each from the test to the page.
        await sourceAt(board, 9).focus();
        const started = Date.now();
        await run.update({
          type: "state",
          state: openStateOf(next as unknown as ViewDocument),
          document: next as unknown as ViewDocument,
        });
        // A key press in the last field, while the previews draw, then an edit: its preview or
        // field error within 2 seconds of the input.
        await board.page.keyboard.press("ControlOrMeta+a");
        const pressedAt = Date.now();
        await board.page.keyboard.press("z");
        const editedAt = Date.now();
        await board.page.keyboard.insertText("a^2+b^2");

        // Every preview draws: the nine untouched items, with the slow expression, and the last
        // one's new expression. The page's own log says what was drawn when.
        const slowDraws = (log: DrawLog) =>
          log.events.filter((one) => one.tex.includes("tfrac") && one.at < 9);
        await eventually(
          async () => {
            const log = await drawLog(board);
            return (
              new Set(slowDraws(log).map((one) => one.at)).size === 9 &&
              log.events.some((one) => one.tex.startsWith("za^2+b^2"))
            );
          },
          "the nine slow previews and the edit's",
          30_000,
        );
        const lag = await lagOf(board);
        const log = await drawLog(board);
        const key = log.inputs.find((one) => one.value === "z");
        const typed = log.events.find((one) => one.tex.startsWith("za^2+b^2"));
        const edit = log.inputs.find((one) => one.value.startsWith("za^2+b^2"));
        if (key === undefined || typed === undefined || edit === undefined) {
          throw new Error(`the page logged no key or edit: ${JSON.stringify(log.inputs)}`);
        }
        const keyMs = key.t - pressedAt;
        const typedMs = typed.t - editedAt;
        const lastSlow = Math.max(...slowDraws(log).map((one) => one.t));
        expect(keyMs, "the key press's answer").toBeLessThan(SHOW_BOUND_MS);
        expect(typedMs, "the edit's preview").toBeLessThan(SHOW_BOUND_MS);
        expect((await shownAt(board, 9)).error).toBeNull();
        // The premise: draws were still pending when the first key came.
        const after = (time: number) => slowDraws(log).filter((one) => one.t >= time).length;
        const pending = after(key.t);
        expect(pending, "slow previews pending at the first key").toBeGreaterThan(0);
        // A draw asked for after the user's edit goes before the draws still pending: with two or
        // more pending as the edit came, some are drawn only after its preview.
        const waiting = after(edit.t);
        const behind = after(typed.t);
        if (waiting >= 2) expect(behind, `${waiting} pending at the edit`).toBeGreaterThan(0);
        for (let at = 0; at < 9; at += 1) {
          expect((await shownAt(board, at)).error, `item ${at}`).toBeNull();
        }
        console.log(
          `[6.8 ${engine}] ten items: ${pending} slow previews pending at the first key, ${waiting} at the edit, key answered ${key.t - pressedAt} ms after it, preview ${Math.round(typedMs)} ms after the edit, last slow preview ${lastSlow - started} ms after the update, longest task about ${Math.round(lag)} ms`,
        );
        expect(run.browser.violations).toEqual([]);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
