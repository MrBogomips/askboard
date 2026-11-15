// The LaTeX bounds, in each engine (latex-kanban-timeline, tasks 4.11 and 6.8; latex-public-api, task
// 3.1; view-and-widgets spec: LaTeX bounded work, scenarios "Nests at and past the limit", "Nests the
// scan once missed" and "Stacked combining marks", and LaTeX previews one at a time): every fixed
// family of nests (the 17 constructs and the infix, hidden-opener, environment and style forms) at
// `LATEX_NESTING_MAX_DEPTH`, alone, side by side to 2,000 code points and as a branching nest, goes
// through the board's `renderInto` with KaTeX's fonts, is drawn in under 2 seconds with no crash,
// and the parent page answers after each; the forms the scan once missed and stacked combining
// marks give the depth's refusal. A bare render in a sandboxed frame: no server, no board. The same
// bounds are also met through a board on the widget host (the second half of the file), where the
// LaTeX item, its field, its queue and KaTeX's stylesheet and fonts as the `latex` chunk carries
// them are the ones a user types into. No test here reads KaTeX's script or names its internals.
//
// Every bound is judged in the perf pass (e2e-cadence decision 6): each test takes three runs inside
// itself, each in a page of its own, asserts every functional outcome on every run, and judges each
// bound once, on the median of the three. A bound is recorded with `gate`, never asserted.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/latex-bounds.browser.ts

import { afterAll, describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS, LATEX_NESTING_MAX_DEPTH, scanLatex } from "@askboard/contract";
import type { ViewDocument } from "../../src/view-document.ts";
import {
  draftExpression,
  latexDocument,
  latexItem,
  latexItemsDocument,
} from "./fixtures/latex-documents.ts";
import { eventually, STEP_TIMEOUT_MS } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { type Engine, enginesFrom } from "./harness/engines.ts";
import {
  cleared,
  type DrawLog,
  drawLog,
  keyAnswered,
  lagOf,
  resetLag,
  SHOW_BOUND_MS,
  shownAt,
  sourceAt,
  typeAndSettle,
  watching,
} from "./harness/latex-board.ts";
import {
  construct,
  depthOfFixture,
  fixtureFor,
  LATEX_CONSTRUCTS,
  SHAPES,
} from "./harness/latex-fixtures.ts";
import { EXTRA_CONSTRUCTS } from "./harness/latex-forms.ts";
import { LatexFrame, PARENT_ANSWER_MS } from "./harness/latex-frame.ts";
import { unparsed } from "./harness/latex-parse.ts";
import { type Gate, PERF_RUNS, perfRuns, perfScaled } from "./harness/perf.ts";
import { viewSettled } from "./harness/probes.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
const RENDER_BOUND_MS = 2_000;
const TEST_TIMEOUT_MS = 60_000;
const LIMIT = LATEX_NESTING_MAX_DEPTH;

// Every fixed family: the 17 constructs, and the infix, hidden-opener, environment and style forms.
const FAMILIES = [...LATEX_CONSTRUCTS, ...EXTRA_CONSTRUCTS];

// The start of the board's own field error for an expression KaTeX does not parse.
const NOT_RENDERED = "This expression does not render";

// One page for each run, so that each bound's three samples come from three fresh pages.
const latexFrames = (engine: Engine): LatexFrame[] => {
  const frames = Array.from({ length: PERF_RUNS }, () => new LatexFrame(engine));
  afterAll(() => Promise.all(frames.map((one) => one.close())));
  return frames;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a LaTeX nest at the limit`, () => {
    const frames = latexFrames(engine);

    for (const construct of FAMILIES) {
      test(
        `${construct.name}: alone, side by side and branching, is drawn within ${RENDER_BOUND_MS} ms and the page answers`,
        async () => {
          await perfRuns(`latex-bounds ${engine} ${construct.name}`, async (run, gate) => {
            const frame = frames[run] as LatexFrame;
            for (const shape of SHAPES) {
              const expression = fixtureFor(construct, shape, LIMIT);
              const where = `${construct.name}, ${shape}`;
              expect(depthOfFixture(expression), where).toBeLessThanOrEqual(LIMIT);
              if (LATEX_CONSTRUCTS.includes(construct)) {
                expect(depthOfFixture(expression), where).toBe(LIMIT);
              }
              expect([...expression].length, where).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
              const result = await frame.rendering(expression);
              if (!result.ok) throw new Error(`${where}: ${result.reason}: ${result.message}`);
              gate(`${shape} render`, result.ms, RENDER_BOUND_MS, true);
              gate(`${shape} parent`, result.parentMs, PARENT_ANSWER_MS, true);
              // A macro definition is refused by the scan whatever its depth, KaTeX does not run.
              const refused = scanLatex(expression).refused;
              if (refused !== undefined) {
                expect(result.rendered, where).toEqual({ refused: { command: refused } });
                continue;
              }
              // A form of the extra families that KaTeX does not parse at this depth has nothing to
              // draw (decided in Bun, before drawing); the 17 constructs always draw, and any other
              // error is a failure.
              if (!LATEX_CONSTRUCTS.includes(construct) && unparsed(expression)) {
                expect(result.rendered.error, where).toBeDefined();
                continue;
              }
              // Drawn: no refusal, no error, and the elements are in the page.
              expect(result.rendered, where).toEqual({});
              expect(result.nodes, where).toBeGreaterThan(1);
            }
          });
        },
        PERF_RUNS * TEST_TIMEOUT_MS,
      );
    }

    test(
      `one level past the limit is refused naming the depth and the limit, and KaTeX does not draw`,
      async () => {
        await perfRuns(`latex-bounds ${engine} past the limit`, async (run, gate) => {
          const frame = frames[run] as LatexFrame;
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
              gate(`${construct.name} ${shape} parent`, result.parentMs, PARENT_ANSWER_MS, true);
            }
          }
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the nests the scan once missed`, () => {
    const frames = latexFrames(engine);
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
      async (name, expression, refused) => {
        await perfRuns(`latex-bounds ${engine} ${name}`, async (run, gate) => {
          const frame = frames[run] as LatexFrame;
          const kept = await frame.rendering("x^2");
          if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
          const result = await frame.rendering(expression);
          if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
          expect(result.rendered).toEqual({ refused });
          expect(result.nodes).toBe(kept.nodes);
          gate("render", result.ms, RENDER_BOUND_MS, true);
          gate("parent", result.parentMs, PARENT_ANSWER_MS, true);
          // The engine is still the same one: a draw after the refusal works.
          const after = await frame.rendering("\\frac{a}{b}");
          expect(after.ok && after.rendered).toEqual({});
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );
  });

  // latex-public-api (view-and-widgets spec: LaTeX bounded work, scenario "Stacked combining
  // marks"): the contract's scan counts a run of combining marks as nesting, so the forms that
  // crashed Chromium's renderer when drawn are refused before KaTeX runs.
  describe(`${engine}: stacked combining marks`, () => {
    const frames = latexFrames(engine);
    const stacked = (count: number, mark = "\u0302", base = "x", close = "") =>
      `${base}${mark.repeat(count)}${close}`;

    test(
      "x and 10 marks is drawn within the render bound and the page answers",
      async () => {
        const expression = stacked(LIMIT - 1);
        expect(depthOfFixture(expression)).toBe(LIMIT);
        await perfRuns(`latex-bounds ${engine} x and 10 marks`, async (run, gate) => {
          const frame = frames[run] as LatexFrame;
          const kept = await frame.rendering("x^2");
          if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
          const result = await frame.rendering(expression);
          if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
          expect(result.rendered).toEqual({});
          expect(result.nodes).toBeGreaterThan(kept.nodes);
          gate("render", result.ms, RENDER_BOUND_MS, true);
          gate("parent", result.parentMs, PARENT_ANSWER_MS, true);
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );

    test.each([
      ["x and 11 marks", stacked(LIMIT), LIMIT + 1],
      ["x and 130 marks", stacked(130), 131],
      ["a and 130 acute accents", stacked(130, "\u0301", "a"), 131],
      ["\\text{a and 130 marks}", stacked(130, "\u0301", "\\text{a", "}"), 132],
    ] as const)(
      "%s: refused naming the depth and the limit, KaTeX does not run, the preview keeps its last render, the renderer does not crash and the page answers",
      async (name, expression, depth) => {
        expect(scanLatex(expression).refused).toBeUndefined();
        expect([...expression].length).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
        await perfRuns(`latex-bounds ${engine} ${name}`, async (run, gate) => {
          const frame = frames[run] as LatexFrame;
          const kept = await frame.rendering("x^2");
          if (!kept.ok) throw new Error(`${kept.reason}: ${kept.message}`);
          const result = await frame.rendering(expression);
          if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
          expect(result.rendered).toEqual({ refused: { depth, limit: LIMIT } });
          expect(result.nodes).toBe(kept.nodes);
          gate("render", result.ms, RENDER_BOUND_MS, true);
          gate("parent", result.parentMs, PARENT_ANSWER_MS, true);
          // The engine is still the same one: a draw after the refusal works.
          const after = await frame.rendering("\\frac{a}{b}");
          expect(after.ok && after.rendered).toEqual({});
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );

    test(
      "accented text is drawn: \\text{cafe} with a combining acute accent",
      async () => {
        const result = await (frames[0] as LatexFrame).rendering("\\text{cafe\u0301}");
        if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
        expect(result.rendered).toEqual({});
        expect(result.nodes).toBeGreaterThan(1);
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

// Helpers of the moved test below ("the cost of a refused expression typed after a rendered one").
const hasError = (board: Board, start: string) =>
  eventually(
    async () => ((await shownAt(board, 0)).error ?? "").startsWith(start),
    `the field error ${start}`,
    perfScaled(STEP_TIMEOUT_MS),
  );

const draftHolds = (run: WidgetHostRun, expression: string) =>
  eventually(
    () => Bun.deepEquals(draftExpression(run), { expression }, true),
    "the draft to hold the text as typed",
  );

// A preview untouched: no node of it changes while `action` runs and the board settles.
const unchangedBy = async (board: Board, action: () => Promise<void>): Promise<void> => {
  const before = (await shownAt(board, 0)).markup;
  const frame = await board.viewFrame();
  await frame.evaluate(() => {
    const watched = document.querySelector("[data-latex-preview]") as Element;
    const log: MutationRecord[] = [];
    new MutationObserver((records) => log.push(...records)).observe(watched, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    (globalThis as unknown as { __mutations: MutationRecord[] }).__mutations = log;
  });
  await action();
  await viewSettled(board);
  expect(
    await frame.evaluate(
      () => (globalThis as never as { __mutations: unknown[] }).__mutations.length,
    ),
  ).toBe(0);
  expect((await shownAt(board, 0)).markup).toBe(before);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the LaTeX bounds on a board`, () => {
    const { host } = useWidgetHost(engine);
    const boardWith = async () => {
      const run = await host(dist, latexDocument("x^2"), { prepare: watching });
      await readyIn(run);
      return run;
    };
    // A fresh board for one run, with what every case shares. `typed` types an expression and gives
    // what the item shows, recording the time to show it; an item showing a field error first takes
    // a valid expression, so that the next error is a change. `keyed` records a key press's answer.
    // Each record has a label of its own, by its place in the run.
    const board = async (gate: Gate) => {
      const run = await boardWith();
      let flip = false;
      let typings = 0;
      let keys = 0;
      const typed = async (expression: string) => {
        flip = !flip;
        typings += 1;
        const base = await cleared(run.board, 0, flip ? "y^3" : "z^3");
        const settled = await typeAndSettle(run.board, 0, expression, base);
        gate(`typing ${typings} shown`, settled.ms, SHOW_BOUND_MS, true);
        return { settled, before: base.markup };
      };
      const keyed = async (at: number) => {
        keys += 1;
        gate(`key ${keys} answered`, await keyAnswered(run.board, at, "z"), SHOW_BOUND_MS, true);
      };
      return { run, typed, keyed };
    };
    const perfBoard = (
      what: string,
      body: (page: Awaited<ReturnType<typeof board>>) => Promise<void>,
    ) => perfRuns(`latex-bounds ${engine} ${what}`, async (_run, gate) => body(await board(gate)));

    test(
      "a macro definition, an internal command and the review's nested forms give their field error within 2 seconds, create no node, keep the preview, and a key press is answered afterwards",
      async () => {
        await perfBoard("refused forms", async ({ run, typed, keyed }) => {
          const times: number[] = [];
          for (const [expression, words] of FORMS_REFUSED) {
            const where = `${expression.slice(0, 30)}… (${[...expression].length} code points)`;
            expect([...expression].length, where).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
            const { settled, before } = await typed(expression);
            expect(REFUSED_BY_NAME(words)(settled.error), `${where}: ${settled.error}`).toBe(true);
            expect(settled.created, where).toBe(0);
            expect((await shownAt(run.board, 0)).markup, where).toBe(before);
            await keyed(0);
            times.push(Math.round(settled.ms));
          }
          console.log(`[6.8 ${engine}] refused forms, ms to the field error: ${times.join(", ")}`);
          expect(run.browser.violations).toEqual([]);
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );

    test(
      "a nest one level past the limit gives the depth's field error naming the depth and the limit, creates no node and keeps the preview, in each shape",
      async () => {
        await perfBoard("past the limit", async ({ run, typed, keyed }) => {
          for (const construct of LATEX_CONSTRUCTS) {
            for (const shape of SHAPES) {
              const where = `${construct.name}, ${shape}`;
              const { settled, before } = await typed(fixtureFor(construct, shape, LIMIT + 1));
              expect(settled.error, where).toStartWith(
                `This expression nests ${LIMIT + 1} levels deep, more than the limit of ${LIMIT}.`,
              );
              expect(settled.created, where).toBe(0);
              expect((await shownAt(run.board, 0)).markup, where).toBe(before);
            }
            await keyed(0);
          }
        });
      },
      3 * PERF_RUNS * TEST_TIMEOUT_MS,
    );

    test(
      "the two forms the scan once missed give their field error, the depth and the limit for the infix form and the command \\char` for the other, the renderer surviving",
      async () => {
        await perfBoard("forms the scan once missed", async ({ run, typed, keyed }) => {
          const infix = `${"\\frac{".repeat(11)}x${"\\over y}{x}".repeat(11)}`;
          const char = `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`;
          for (const [expression, error] of [
            [infix, `This expression nests 22 levels deep, more than the limit of ${LIMIT}.`],
            [char, "This expression uses \\char`, which a LaTeX item does not allow."],
          ] as const) {
            const { settled, before } = await typed(expression);
            expect(settled.error).toStartWith(error);
            expect(settled.created).toBe(0);
            expect((await shownAt(run.board, 0)).markup).toBe(before);
            await keyed(0);
          }
          // The same renderer draws again.
          const { settled } = await typed("\\frac{a}{b}");
          expect(settled.error).toBeNull();
          expect(settled.drawn).toBe(true);
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );

    // latex-public-api (spec: LaTeX bounded work, scenario "Stacked combining marks typed"): `x` and
    // 130 U+0302 typed gives the depth's refusal, KaTeX does not run. The agent's half is the
    // contract's: `ask` and `update` refuse it (latex-widget.test.ts), so it never reaches a board.
    const STACKED = `x${"\u0302".repeat(130)}`;
    const STACKED_ERROR = `This expression nests 131 levels deep, more than the limit of ${LIMIT}.`;

    test(
      "x and 130 stacked U+0302 typed gives the depth's field error, creates no node, keeps the preview and the renderer survives",
      async () => {
        await perfBoard("stacked marks typed", async ({ run, typed, keyed }) => {
          const { settled, before } = await typed(STACKED);
          expect(settled.error).toStartWith(STACKED_ERROR);
          expect(settled.created).toBe(0);
          expect((await shownAt(run.board, 0)).markup).toBe(before);
          await keyed(0);
          // The same renderer draws again.
          const after = await typed("\\frac{a}{b}");
          expect(after.settled.error).toBeNull();
          expect(after.settled.drawn).toBe(true);
          expect(run.browser.errors).toEqual([]);
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );

    // Each family of task 4.15 at the limit, alone, side by side and branching, through the field.
    test(
      "every family at the nesting limit, alone, side by side to 2,000 code points and branching, is drawn within 2 seconds and the board answers after each family",
      async () => {
        await perfBoard("every family", async ({ run, typed, keyed }) => {
          const slowest: { where: string; ms: number }[] = [];
          for (const family of FAMILIES) {
            for (const shape of SHAPES) {
              const expression = fixtureFor(family, shape, LIMIT);
              const where = `${family.name}, ${shape}`;
              const { settled, before } = await typed(expression);
              slowest.push({ where, ms: settled.ms });
              // A form of the extra families that KaTeX does not parse at this depth has nothing to
              // draw (decided in Bun, before drawing); any other error is a failure.
              if (!LATEX_CONSTRUCTS.includes(family) && unparsed(expression)) {
                expect(settled.error, where).toStartWith(NOT_RENDERED);
                continue;
              }
              const refused = scanLatex(expression).refused;
              if (refused !== undefined) {
                expect(settled.error, where).toContain(refused);
                expect((await shownAt(run.board, 0)).markup, where).toBe(before);
                continue;
              }
              expect(settled.error, where).toBeNull();
              expect(settled.drawn, where).toBe(true);
            }
            await keyed(0);
          }
          slowest.sort((a, b) => b.ms - a.ms);
          console.log(
            `[6.8 ${engine}] ${slowest.length} expressions; slowest: ${slowest
              .slice(0, 3)
              .map((one) => `${one.where} ${Math.round(one.ms)} ms`)
              .join("; ")}`,
          );
        });
      },
      5 * PERF_RUNS * TEST_TIMEOUT_MS,
    );

    test(
      "flat expressions of 2,000 code points draw: 2,000 plain glyphs, 666 \\le, a matrix of 400 cells and the widest matrix; 666 \\ne gives the field error",
      async () => {
        await perfBoard("flat expressions", async ({ run, typed, keyed }) => {
          const rows = Array.from({ length: 20 }, () => Array(20).fill("a").join("&")).join("\\\\");
          const times: string[] = [];
          for (const [name, expression] of [
            ["2,000 plain glyphs", "a".repeat(2_000)],
            ["666 \\le", "\\le".repeat(666)],
            ["a matrix of 400 cells", `\\begin{matrix}${rows}\\end{matrix}`],
            ["a matrix of 1,975 empty cells", `\\begin{matrix}${"&".repeat(1_974)}\\end{matrix}`],
          ] as const) {
            expect([...expression].length, name).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
            const { settled } = await typed(expression);
            expect(settled.error, name).toBeNull();
            expect(settled.drawn, name).toBe(true);
            await keyed(0);
            times.push(`${name} ${Math.round(settled.ms)}`);
          }
          const { settled, before } = await typed("\\ne".repeat(666));
          times.push(`666 \\ne ${Math.round(settled.ms)}`);
          console.log(`[6.8 ${engine}] flat expressions, ms: ${times.join("; ")}`);
          expect(unparsed("\\ne".repeat(666))).toBe(true);
          expect(settled.error).toStartWith(NOT_RENDERED);
          expect((await shownAt(run.board, 0)).markup).toBe(before);
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );

    // Moved from latex.browser.ts (task 3.3): a refused expression typed after a rendered one shows
    // its field error within the 2-second bound, the time from the fill to the error, with no
    // allowance for the wait that checks the preview stayed untouched.
    test(
      "\\def\\a{x}\\a, then \\color{x}\\current@color, then a nest one level past the limit, each typed after a rendered expression, give their field error, leave the preview untouched and hold the text",
      async () => {
        await perfRuns(`latex-bounds ${engine} refused after rendered`, async (_run, gate) => {
          const run = await boardWith();
          const { board } = run;
          const past = LATEX_NESTING_MAX_DEPTH + 1;
          const nest = `${"\\frac{".repeat(past)}x${"}{x}".repeat(past)}`;
          let typings = 0;
          for (const [expression, words] of [
            ["\\def\\a{x}\\a", "This expression defines a macro with \\def,"],
            [
              "\\color{x}\\current@color",
              "This expression uses \\current@color, one of KaTeX's internal",
            ],
            [
              nest,
              `This expression nests ${past} levels deep, more than the limit of ${LATEX_NESTING_MAX_DEPTH}.`,
            ],
          ] as const) {
            typings += 1;
            let elapsed = 0;
            await unchangedBy(board, async () => {
              const started = Date.now();
              await sourceAt(board, 0).fill(expression);
              await hasError(board, words);
              elapsed = Date.now() - started;
            });
            gate(`typing ${typings} field error`, elapsed, SHOW_BOUND_MS, true);
            await draftHolds(run, expression);
            expect(await board.answer.isEnabled()).toBe(true);
          }
          // A board that answers: the field takes a valid expression and draws it again.
          await sourceAt(board, 0).fill("y^3");
          await eventually(async () => (await shownAt(board, 0)).error === null, "the error to go");
          expect(run.browser.violations).toEqual([]);
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );
  });
}

// Task 6.8, "LaTeX previews one at a time": a question of ten LaTeX items, each the slowest
// expression within the scan's limit that task 4.15's measurement found in WebKit (`\\tfrac`'s first
// argument nested to the limit, side by side; `\\dfrac` and `\\frac` follow within 5%), draws every
// preview while keys and an edit in the last item's field are answered.
const SLOWEST = construct("\\tfrac{ }{x}", "\\tfrac{", "}{x}");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: ten LaTeX items`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "ten of the slowest expression draw every preview while a key press in the last field is answered within 2 seconds, and an expression typed in it shows within 2 seconds of the input",
      async () => {
        await perfRuns(`latex-bounds ${engine} ten items`, async (_run, gate) => {
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
            perfScaled(30_000),
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
          gate("key press answered", keyMs, SHOW_BOUND_MS, true);
          gate("edit preview shown", typedMs, SHOW_BOUND_MS, true);
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
        });
      },
      PERF_RUNS * TEST_TIMEOUT_MS,
    );
  });
}
