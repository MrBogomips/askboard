// The LaTeX, in each engine, on the widget host and, for the answer and read-only scenarios, on
// the session process (latex-kanban-timeline, task 5.1; spec view-and-widgets: LaTeX source and
// preview, LaTeX source limit, LaTeX parse errors, LaTeX untrusted commands, LaTeX bounded work,
// LaTeX output bounded, LaTeX, Kanban and Timeline read-only, LaTeX, Kanban and Timeline strings):
// typing gives a preview and a draft holding the whole props, an edit back to the agent's
// expression clears it; a paste over the limit is cut; a parse error, a refused command, a nest
// past the limit and an output too complex to preview each show their field error, keep the last
// preview and leave "Answer" enabled; KaTeX's message shows its controls as escapes; a draw that
// throws fails the item; an answered LaTeX is read-only; an Italian board shows it in Italian. No
// font or other request is made and no Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import { LATEX_NESTING_MAX_DEPTH } from "@askboard/contract";
import type { BrowserContext } from "playwright";
import {
  draftExpression,
  latexAsk,
  latexDocument,
  latexItem,
  latexItemsDocument,
  SENT_EXPRESSION,
} from "./fixtures/latex-documents.ts";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const source = (board: Board, at = 0) => board.view.locator("[data-latex-source]").nth(at);
const preview = (board: Board, at = 0) => board.view.locator("[data-latex-preview]").nth(at);
const fieldError = (board: Board, at = 0) =>
  board.view.locator("[data-latex]").nth(at).locator("[data-latex-error]");
const counter = (board: Board) => board.view.locator("[data-latex-counter]");

const drawn = (board: Board, at = 0) => preview(board, at).locator(".katex").count();
const markup = (board: Board, at = 0) => preview(board, at).innerHTML();
const fieldValue = (board: Board, at = 0) => source(board, at).inputValue();
const errorText = async (board: Board, at = 0): Promise<string> =>
  ((await fieldError(board, at).textContent()) ?? "").trim();

// Types `text` after what the field holds, key by key, with the caret at its end.
const typeAfter = async (board: Board, text: string, at = 0): Promise<void> => {
  const field = source(board, at);
  await field.focus();
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(element.value.length, element.value.length);
  });
  await board.page.keyboard.type(text);
};

const draftHolds = (run: WidgetHostRun, expression: string | undefined, what: string) =>
  eventually(
    () =>
      Bun.deepEquals(
        draftExpression(run),
        expression === undefined ? undefined : { expression },
        true,
      ),
    what,
  );

// The combining marks the scan passes and the output bound refuses at 48 (task 4.22).
const combined = (count: number): string => `a${"\u0301".repeat(count)}`;

const hasError = (board: Board, start: string, at = 0) =>
  eventually(
    async () => (await errorText(board, at)).startsWith(start),
    `the field error ${start}`,
  );

// The page requests that left the tab: the host page alone (no font, no file, no other origin).
const networkRequests = (run: WidgetHostRun): readonly string[] =>
  run.requests.filter((url) => /^(https?|wss?):/.test(url)).map((url) => new URL(url).pathname);

// A preview untouched: no node of it changes while `action` runs and the board settles.
const unchangedBy = async (board: Board, action: () => Promise<void>): Promise<void> => {
  const before = await markup(board);
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
  await Bun.sleep(QUIET_MS / 3);
  expect(
    await frame.evaluate(
      () => (globalThis as never as { __mutations: unknown[] }).__mutations.length,
    ),
  ).toBe(0);
  expect(await markup(board)).toBe(before);
};

// The init script of the two scenarios that make a draw throw. Both run in every frame, the
// view's included, and act only on text no other test types:
// - `\zzthrow` makes the contract's scan throw (the scan reads each control word through a Set),
//   outside the render's own error handling: the draw throws and the item fails;
// - `ZZBOOM` makes KaTeX's MathML node creation throw a string, a thrown value with no message.
const THROWING = `
  const has = Set.prototype.has;
  Set.prototype.has = function (value) {
    if (value === "\\\\zzthrow") throw new RangeError("the scan broke");
    return has.call(this, value);
  };
  const create = Document.prototype.createElementNS;
  Document.prototype.createElementNS = function (namespace, name, options) {
    const field = this.querySelector && this.querySelector("[data-latex-source]");
    if (namespace === "http://www.w3.org/1998/Math/MathML" && field && field.value.includes("ZZBOOM")) {
      throw "no message";
    }
    return create.call(this, namespace, name, options);
  };
`;
const throwing = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(THROWING);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the LaTeX source and preview`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "untouched, it shows the agent's expression drawn, no change, no draft and Answer disabled",
      async () => {
        const run = await host(dist, latexDocument());
        await readyIn(run);
        const { board } = run;
        expect(await fieldValue(board)).toBe(SENT_EXPRESSION);
        expect(await source(board).getAttribute("readonly")).toBeNull();
        expect(await source(board).getAttribute("maxlength")).toBeNull();
        expect(await drawn(board)).toBe(1);
        expect((await preview(board).textContent()) ?? "").toContain("a");
        expect(await fieldError(board).count()).toBe(0);
        expect(await source(board).getAttribute("data-change")).toBeNull();
        expect(((await counter(board).textContent()) ?? "").trim()).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.drafts).toEqual([]);
        expect(networkRequests(run)).toEqual(["/"]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "typing =c^2 after a^2+b^2 draws the new equation and the draft holds the whole props; deleting it clears the draft and the highlight",
      async () => {
        const run = await host(dist, latexDocument());
        await readyIn(run);
        const { board } = run;
        const before = await markup(board);
        await typeAfter(board, "=c^2");
        expect(await fieldValue(board)).toBe("a^2+b^2=c^2");
        await draftHolds(run, "a^2+b^2=c^2", "the draft to hold the corrected expression");
        await eventually(async () => (await markup(board)) !== before, "the new preview");
        expect(await drawn(board)).toBe(1);
        expect(await source(board).getAttribute("data-change")).toBe("edited");
        expect(((await counter(board).textContent()) ?? "").trim()).toBe(
          "Your changes: expression edited",
        );
        expect(await board.answer.isEnabled()).toBe(true);
        for (let key = 0; key < 4; key += 1) await board.page.keyboard.press("Backspace");
        expect(await fieldValue(board)).toBe(SENT_EXPRESSION);
        await draftHolds(run, undefined, "the draft to hold no value");
        await eventually(async () => (await markup(board)) === before, "the first preview again");
        expect(await source(board).getAttribute("data-change")).toBeNull();
        expect(((await counter(board).textContent()) ?? "").trim()).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(networkRequests(run)).toEqual(["/"]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an empty expression from the agent leaves the field and the preview empty, and the item counts as ready",
      async () => {
        const run = await host(dist, latexDocument(""));
        await readyIn(run);
        const { board } = run;
        expect(await fieldValue(board)).toBe("");
        expect(((await preview(board).textContent()) ?? "").trim()).toBe("");
        expect(await fieldError(board).count()).toBe(0);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a paste that would make the expression 2,001 characters outside the Basic Multilingual Plane keeps the first 2,000, and the draft holds them",
      async () => {
        const run = await host(dist, latexDocument(""));
        await readyIn(run);
        const { board } = run;
        const pasted = "\u{1F600}".repeat(2_001);
        await source(board).fill(pasted);
        await draftHolds(run, "\u{1F600}".repeat(2_000), "the draft to hold 2,000 characters");
        const kept = await fieldValue(board);
        expect([...kept]).toHaveLength(2_000);
        expect(kept).toBe("\u{1F600}".repeat(2_000));
        expect(await source(board).getAttribute("maxlength")).toBeNull();
        expect(await board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the LaTeX's parse errors`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an unclosed brace typed after a rendered expression shows KaTeX's message, keeps the last preview and leaves Answer enabled",
      async () => {
        const run = await host(dist, latexDocument("x^2"));
        await readyIn(run);
        const { board } = run;
        const before = await markup(board);
        await source(board).fill("\\frac{1}{");
        await hasError(board, "This expression does not render: KaTeX parse error");
        expect(await markup(board)).toBe(before);
        expect(await drawn(board)).toBe(1);
        expect(await board.answer.isEnabled()).toBe(true);
        await draftHolds(run, "\\frac{1}{", "the draft to hold the text as typed");
        expect(await source(board).getAttribute("aria-invalid")).toBe("true");
        await source(board).fill("\\frac{1}{2}");
        await eventually(async () => (await fieldError(board).count()) === 0, "the error to go");
        expect(await markup(board)).not.toBe(before);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent's expression that does not parse shows the field error, an empty preview, and the item counts as ready",
      async () => {
        const run = await host(dist, latexDocument("\\frac{1}{"));
        await readyIn(run);
        const { board } = run;
        await hasError(board, "This expression does not render: KaTeX parse error");
        expect(await drawn(board)).toBe(0);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an unparsable expression holding U+202E within the part KaTeX quotes shows the control as the escape \\u202E, as text, with no request and no violation",
      async () => {
        const run = await host(dist, latexDocument("x"));
        await readyIn(run);
        const { board } = run;
        await source(board).fill("\\frac{1\u202E}{");
        await hasError(board, "This expression does not render: KaTeX parse error");
        const shown = await errorText(board);
        expect(shown).toContain("\\u202E");
        expect(shown).not.toContain("\u202E");
        expect(await fieldError(board).locator("*").count()).toBe(0);
        expect(networkRequests(run)).toEqual(["/"]);
        expect(run.browser.violations).toEqual([]);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a failure that carries no message shows the string tables' fixed text, in both locales, and the last preview stays",
      async () => {
        for (const [language, words] of [
          [undefined, "The expression could not be drawn."],
          ["it-IT", "Non è stato possibile disegnare l'espressione."],
        ] as const) {
          const run = await host(dist, latexDocument("x^2", language), { prepare: throwing });
          await readyIn(run);
          const { board } = run;
          const before = await markup(board);
          await source(board).fill("\\text{ZZBOOM}");
          await hasError(board, words);
          expect(await errorText(board)).toBe(words);
          expect(await markup(board)).toBe(before);
          await draftHolds(run, "\\text{ZZBOOM}", "the draft to hold the text as typed");
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a draw that throws fails the item through the ready tracker: an item error, an alert, no Answer",
      async () => {
        const run = await host(dist, latexDocument("x^2"), { prepare: throwing });
        await readyIn(run);
        const { board } = run;
        await source(board).fill("\\zzthrow");
        await eventually(
          () => run.messages.some((message) => message.type === "item-error"),
          "the item-error message",
          LOAD_TIMEOUT_MS,
        );
        expect(run.messages.filter((message) => message.type === "item-error")).toEqual([
          { type: "item-error", itemId: "formula", error: "the scan broke" },
        ]);
        expect(await board.question("plan").getByRole("alert").count()).toBe(1);
        expect(await board.answer.count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the LaTeX's untrusted commands and bounded work`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "\\href and \\includegraphics draw no link and no image, and the board makes no request",
      async () => {
        const run = await host(
          dist,
          latexDocument(
            "\\href{https://example.com}{x}\\includegraphics{https://example.com/a.png}",
          ),
        );
        await readyIn(run);
        const { board } = run;
        expect(await preview(board).locator("a, img, [href], [src]").count()).toBe(0);
        expect(networkRequests(run)).toEqual(["/"]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a macro defined in one item does not exist in the next: the first names \\gdef, the second shows a parse error naming \\foo",
      async () => {
        const run = await host(
          dist,
          latexItemsDocument([latexItem("x", "first"), latexItem("\\foo", "second")]),
        );
        await readyIn(run);
        const { board } = run;
        await hasError(board, "This expression does not render", 1);
        expect(await errorText(board, 1)).toContain("\\foo");
        const before = await markup(board, 0);
        await source(board, 0).fill("\\gdef\\foo{1}");
        await hasError(board, "This expression defines a macro with \\gdef", 0);
        expect(await markup(board, 0)).toBe(before);
        expect(await errorText(board, 1)).toContain("\\foo");
        expect(await drawn(board, 1)).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "\\def\\a{x}\\a, then \\color{x}\\current@color, then a nest one level past the limit, each typed after a rendered expression, give their field error, leave the preview untouched and hold the text",
      async () => {
        const run = await host(dist, latexDocument("x^2"));
        await readyIn(run);
        const { board } = run;
        const past = LATEX_NESTING_MAX_DEPTH + 1;
        const nest = `${"\\frac{".repeat(past)}x${"}{x}".repeat(past)}`;
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
          const started = Date.now();
          await unchangedBy(board, async () => {
            await source(board).fill(expression);
            await hasError(board, words);
          });
          expect(Date.now() - started).toBeLessThan(2_000 + QUIET_MS);
          await draftHolds(run, expression, "the draft to hold the text as typed");
          expect(await board.answer.isEnabled()).toBe(true);
        }
        // A board that answers: the field takes a valid expression and draws it again.
        await source(board).fill("y^3");
        await eventually(async () => (await fieldError(board).count()) === 0, "the error to go");
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "\\show and \\char` are refused naming the command, in the third field error",
      async () => {
        const run = await host(dist, latexDocument("x^2"));
        await readyIn(run);
        const { board } = run;
        await source(board).fill("\\show\\a");
        await hasError(board, "This expression uses \\show, which a LaTeX item does not allow.");
        await source(board).fill("\\char`\\a");
        await hasError(board, "This expression uses \\char`, which a LaTeX item does not allow.");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the LaTeX's output bound`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a plus 48 U+0301 typed is too complex to preview: the last render stays, Answer is enabled and the draft holds the text; 47 draws",
      async () => {
        const run = await host(dist, latexDocument("x^2"));
        await readyIn(run);
        const { board } = run;
        const before = await markup(board);
        await source(board).fill(combined(48));
        await hasError(board, "This expression is too complex to preview.");
        expect(await errorText(board)).toBe(
          "This expression is too complex to preview. Simplify it to see it drawn.",
        );
        expect(await markup(board)).toBe(before);
        expect(await board.answer.isEnabled()).toBe(true);
        await draftHolds(run, combined(48), "the draft to hold the text as typed");
        await source(board).fill(combined(47));
        await eventually(async () => (await fieldError(board).count()) === 0, "47 to be drawn");
        expect(await drawn(board)).toBe(1);
        expect(await markup(board)).not.toBe(before);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent's a plus 48 U+0301 shows the same field error on load, with no node inserted and no crash",
      async () => {
        const run = await host(dist, latexDocument(combined(48)));
        await readyIn(run);
        const { board } = run;
        await hasError(board, "This expression is too complex to preview.");
        expect(await drawn(board)).toBe(0);
        expect(await preview(board).locator("*").count()).toBe(0);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the LaTeX in Italian`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "shows its labels, counter and field errors in Italian",
      async () => {
        const run = await host(dist, latexDocument("x^2", "it-IT"));
        await readyIn(run);
        const { board } = run;
        expect(await board.view.getByRole("textbox", { name: "Sorgente LaTeX" }).count()).toBe(1);
        expect(await board.view.getByRole("group", { name: "Anteprima" }).count()).toBe(1);
        expect(((await counter(board).textContent()) ?? "").trim()).toBe("Nessuna modifica");
        await typeAfter(board, "+1");
        await eventually(
          async () =>
            ((await counter(board).textContent()) ?? "").trim() ===
            "Le tue modifiche: espressione modificata",
          "the counter in Italian",
        );
        await source(board).fill("\\frac{1}{");
        await hasError(board, "Questa espressione non si visualizza: KaTeX parse error");
        await source(board).fill("\\def\\a{x}");
        await hasError(
          board,
          "Questa espressione definisce una macro con \\def, che un elemento LaTeX non ammette.",
        );
        await source(board).fill("\\color{x}\\current@color");
        await hasError(
          board,
          "Questa espressione usa \\current@color, uno dei comandi interni di KaTeX",
        );
        await source(board).fill("\\show\\a");
        await hasError(board, "Questa espressione usa \\show, che un elemento LaTeX non consente.");
        await source(board).fill(`a${"\u0301".repeat(48)}`);
        await hasError(board, "Questa espressione è troppo complessa per l'anteprima.");
        await source(board).fill(`${"\\frac{".repeat(12)}x${"}{x}".repeat(12)}`);
        await hasError(
          board,
          "Questa espressione ha 12 livelli di annidamento, oltre il limite di 11.",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the LaTeX after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "an edited expression is sent as one answer and collected as one set; once the ask closes the field is read-only, shows the preview and a too-complex expression keeps its field error",
      async () => {
        const run = await start(lifecycleScenario(latexAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await typeAfter(board, "=c^2");
        await eventually(
          () =>
            sentDrafts(run).some((record) => record.questions.plan?.values?.formula !== undefined),
          "the draft to hold the value",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.changes).toEqual([
          { op: "set", target: "formula.expression", value: "a^2+b^2=c^2" },
        ]);
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await fieldValue(board)).toBe("a^2+b^2=c^2");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await source(board).getAttribute("readonly")) !== null,
          "the field to turn read-only",
        );
        expect(await drawn(board)).toBe(1);
        expect(await source(board).getAttribute("data-change")).toBe("edited");
        const [drafts, acts] = [sentDrafts(run).length, sentActs(run).length];
        await source(board).click({ force: true });
        await board.page.keyboard.type("zz");
        await Bun.sleep(QUIET_MS);
        expect(await fieldValue(board)).toBe("a^2+b^2=c^2");
        expect([sentDrafts(run).length, sentActs(run).length]).toEqual([drafts, acts]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answered expression too complex to preview shows its source read-only with the same field error and no node",
      async () => {
        const complex = `a${"\u0301".repeat(48)}`;
        const run = await start(lifecycleScenario(latexAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await source(board).fill(complex);
        await hasError(board, "This expression is too complex to preview.");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.collect();
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        // A reloaded board has no earlier preview to keep: the answer's expression is the first.
        await reloadBoard(board, run, () =>
          board.view
            .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
            .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS }),
        );
        await eventually(
          async () => (await source(board).getAttribute("readonly")) !== null,
          "the field to turn read-only",
        );
        expect(await fieldValue(board)).toBe(complex);
        expect(await errorText(board)).toBe(
          "This expression is too complex to preview. Simplify it to see it drawn.",
        );
        expect(await preview(board).locator("*").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
