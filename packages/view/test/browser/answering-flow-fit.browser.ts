// The fit of the frame's labels, and the ledger's pulse under reduced motion, in the browser
// (answering-flow-visual, task 8.1; view-and-widgets spec: The board's frame "Comfortable, in
// Italian"; design decision 16). At 1280x800, in en-US and it-IT, compact and comfortable, with
// sections, tabs and one question per view and three answers ready in "All together": no label of
// the outbox, its ledger or its switch is clipped, and no header row or rail element is wider than
// its box. Agent text (the title, the outline's entries) ends in an ellipsis on purpose and is not
// counted. A label clipped here stops the work: the rail's width is the PO's (design decision 16).
// Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { answeringAsk, type Language, type Presentation } from "./fixtures/answering-flow-asks.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard, optionOf } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ALL,
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};
const DENSITIES = ["compact", "comfortable"] as const;
const LANGUAGES: readonly Language[] = ["en-US", "it-IT"];
const PRESENTATIONS: readonly Presentation[] = ["sections", "tabs", "one-per-view"];

/**
 * The elements of the view whose text is wider than their box: inside the outbox every one counts,
 * ellipsis included (its labels are the board's own); elsewhere in the header and the rail only
 * those that do not end in an ellipsis on purpose (agent text).
 */
const clipped = (board: Board): Promise<string[]> =>
  board.view.locator("body").evaluate((body) => {
    const doc = body.ownerDocument;
    const view = doc.defaultView;
    if (view === null) return [];
    const wide = (element: Element) => element.scrollWidth > element.clientWidth + 1;
    const named = (element: Element) =>
      `${element.tagName.toLowerCase()}[${(element.textContent ?? "").trim().slice(0, 30)}]`;
    const found: string[] = [];
    for (const element of doc.querySelectorAll(
      "[data-askboard-outbox], [data-askboard-outbox] *",
    )) {
      if (wide(element)) found.push(`outbox ${named(element)}`);
    }
    const scoped = ["header", "header *", "[data-askboard-rail]", "[data-askboard-rail] *"];
    for (const element of doc.querySelectorAll(scoped.join(", "))) {
      if (element.closest("[data-askboard-outbox]") !== null) continue;
      const style = view.getComputedStyle(element);
      const scrolls = style.overflowX === "auto" || style.overflowX === "scroll";
      if (wide(element) && style.textOverflow !== "ellipsis" && !scrolls) {
        found.push(`frame ${named(element)}`);
      }
    }
    return found;
  });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the frame's labels fit`, () => {
    const { start } = useEngine(engine);

    for (const language of LANGUAGES) {
      for (const density of DENSITIES) {
        for (const presentation of PRESENTATIONS) {
          test(
            `${language}, ${density}, ${presentation}: three answers ready in All together, nothing clipped`,
            async () => {
              const run = await start({
                ...lifecycleScenario(answeringAsk(presentation, language, "submitted"), dist),
                config: { user: { version: "1.0", density } },
              });
              const board = await openBoard(run, FIRST_VIEW[presentation]);
              const yes = language === "it-IT" ? "Sì" : "Yes";
              // Three answers ready: the questions of the first view, or the first three shown.
              for (const id of ["q1", "q2", "q3"]) {
                if (presentation === "one-per-view" && id !== "q1") continue;
                await optionOf(board, id, yes).click({ timeout: STEP_TIMEOUT_MS });
                await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
              }
              await board.outbox.waitFor({ timeout: STEP_TIMEOUT_MS });
              expect(await clipped(board)).toEqual([]);
            },
            TEST_TIMEOUT_MS,
          );
        }
      }
    }
  });

  describe(`${engine}: the ledger's pulse`, () => {
    const { start } = useEngine(engine);

    const watchPulse = (board: Board) =>
      board.view.locator("body").evaluate((body) => {
        const doc = body.ownerDocument;
        const seen: string[] = [];
        (window as unknown as { __pulses: string[] }).__pulses = seen;
        new MutationObserver((records) => {
          for (const record of records) {
            const target = record.target as Element;
            if (target.hasAttribute("data-askboard-pulse")) {
              seen.push(getComputedStyle(target).animationDuration);
            }
          }
        }).observe(doc.body, {
          attributes: true,
          subtree: true,
          attributeFilter: ["data-askboard-pulse"],
        });
      });

    const pulses = async (board: Board, count: number): Promise<string[]> => {
      const frame = await board.viewFrame();
      const deadline = Date.now() + STEP_TIMEOUT_MS;
      for (;;) {
        const seen = await frame.evaluate(
          () => (window as unknown as { __pulses: string[] }).__pulses ?? [],
        );
        if (seen.length >= count || Date.now() > deadline) return seen;
        await Bun.sleep(50);
      }
    };

    for (const [motion, expected] of [
      ["reduce", "0s"],
      ["no-preference", "0.15s"],
    ] as const) {
      test(
        `${motion}: a ledger cell that rises computes an animation duration of ${expected}`,
        async () => {
          const run = await start(
            lifecycleScenario(answeringAsk("sections", "en-US", "submitted"), dist),
          );
          const board = await openBoard(run, ALL);
          await board.page.emulateMedia({ reducedMotion: motion });
          await watchPulse(board);
          await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
          const seen = await pulses(board, 1);
          expect(seen.length).toBeGreaterThan(0);
          expect(seen[0]).toBe(expected);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
