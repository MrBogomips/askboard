// The cost of placing, in Chromium (document-review, task 6.4; review verdict 3 and task 5.8; moved
// here from document-review.browser.ts by e2e-cadence, decision 6 and its C1): 100 near-miss quotes
// of 2,000 characters over one repeated character are placed once, and typing in a card places
// nothing again, also with 32 Document reviews on the board. Chromium only, for the figures the
// note gives task 8.1; the logic is engine-independent and tested in Bun.
//
// These are wall-clock gates, so they are judged in the perf pass, on the median of three runs: each
// test takes three runs on fresh hosts, asserts its functional outcomes (the detached list, the 32
// marks, no CSP problem) on every run, and judges each gate once, on the medians: `placed` under 15 s,
// a key beside 99 quotes under four times a key alone plus 60 ms, and, with 32 Document reviews, the
// board shown under 20 s and a key under 150 ms.
//
// Run by hand: ASKBOARD_E2E_ENGINES=chromium bun test ./packages/view/test/browser/document-review-cost.browser.ts

import { describe, expect, test } from "bun:test";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { reviewDocument, reviewItem } from "./fixtures/document-review-documents.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { judgeMedians, median, PERF_RUNS, perfScaled } from "./harness/perf.ts";
import { card, commentOn, marks, restoreAnnotations } from "./harness/review-steps.ts";
import { enginesFor } from "./harness/suites.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

// A document of one repeated character with a unique word first, and quotes that nearly occur.
const SOURCE = `word ${"x".repeat(5000)}`;
const nearMiss = (count: number, from = 2) =>
  Array.from({ length: count }, (_, at) =>
    commentOn(`u-${at + from}`, `${"x".repeat(1999)}y`, `Miss ${at}.`),
  );

// The mean time of one key typed in the first comment of `reviewId`, in milliseconds.
const typing = async (run: WidgetHostRun, reviewId: string, first: boolean): Promise<number> => {
  const { view, page } = run.board;
  const item = view.locator(`[data-askboard-item="${reviewId}"]`);
  await item.getByRole("button", { name: "Comment 1", exact: true }).click();
  await card(view).getByRole("button", { name: "Edit" }).click();
  const field = card(view).getByLabel("Your comment");
  await field.focus();
  const began = Date.now();
  await page.keyboard.type("0123456789".repeat(first ? 3 : 2), { delay: 0 });
  return (Date.now() - began) / (first ? 30 : 20);
};

const detachedList = (run: WidgetHostRun) =>
  run.board.view.getByRole("region", { name: "Detached comments" });

for (const engine of enginesFor(import.meta.path)) {
  describe(`${engine}: the cost of placing`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "100 near-miss quotes are placed at once, and typing in a card beside 99 of them places nothing again",
      async () => {
        const placedSamples: number[] = [];
        const busySamples: number[] = [];
        const aloneSamples: number[] = [];
        for (let run = 0; run < PERF_RUNS; run += 1) {
          const document = reviewDocument(SOURCE);
          const control = await host(dist, document);
          await readyIn(control);
          await restoreAnnotations(control, document, [commentOn("u-1", "word", "Mine.")]);
          await eventually(
            async () => (await marks(control.board.view).count()) === 1,
            "control mark",
          );
          const alone = await typing(control, "review", true);
          // 100 quotes that nearly occur, over one repeated character: placed in one pass.
          const only = await host(dist, document);
          await readyIn(only);
          const began = Date.now();
          await restoreAnnotations(only, document, nearMiss(100, 1));
          await eventually(
            async () => (await detachedList(only).count()) === 1,
            "100 detached",
            perfScaled(30_000),
          );
          const placed = Date.now() - began;
          // 99 of them beside one held annotation: a key in its card costs what it does alone.
          const many = await host(dist, document);
          await readyIn(many);
          await restoreAnnotations(many, document, [
            commentOn("u-1", "word", "Mine."),
            ...nearMiss(99),
          ]);
          await eventually(
            async () => (await detachedList(many).count()) === 1,
            "99 detached",
            perfScaled(30_000),
          );
          const busy = await typing(many, "review", true);
          console.log(
            `document-review timing: 100 near-miss quotes of 2,000 characters over one repeated character shown in ${placed} ms; typing ${busy.toFixed(1)} ms per key beside 99 of them, ${alone.toFixed(1)} ms alone`,
          );
          placedSamples.push(placed);
          busySamples.push(busy);
          aloneSamples.push(alone);
        }
        const label = `document-review-cost ${engine}`;
        judgeMedians([
          { label: `${label} placed`, samples: placedSamples, gate: 15_000, below: true },
          {
            label: `${label} key beside 99 quotes against four times a key alone plus 60`,
            samples: busySamples,
            gate: median(aloneSamples) * 4 + perfScaled(60),
            below: true,
            factor: 1,
          },
        ]);
      },
      perfScaled(PERF_RUNS * TEST_TIMEOUT_MS * 2),
    );

    test(
      "typing in one card with 32 Document reviews on the board costs a key about what it does alone",
      async () => {
        const shownSamples: number[] = [];
        const perKeySamples: number[] = [];
        for (let at = 0; at < PERF_RUNS; at += 1) {
          const items = Array.from({ length: 32 }, (_, index) =>
            reviewItem(SOURCE, undefined, `r${index}`),
          );
          const document = atomDocument(items);
          const run = await host(dist, document);
          await readyIn(run);
          const record = {
            delivery: "immediate",
            questions: {
              plan: {
                rev: 1,
                results: Object.fromEntries(
                  items.map(({ id }) => [
                    id,
                    { annotations: [commentOn("u-1", "word", "Mine."), ...nearMiss(3)] },
                  ]),
                ),
              },
            },
          };
          const began = Date.now();
          await run.update({
            type: "state",
            state: openStateOf(document),
            restore: { id: 1, record: record as never },
          });
          await eventually(
            async () => (await run.board.view.locator("[data-review-mark]").count()) === 32,
            "32 marks",
            perfScaled(30_000),
          );
          const shown = Date.now() - began;
          const perKey = await typing(run, "r7", false);
          console.log(
            `document-review timing: 32 Document reviews with 3 near-miss quotes each shown in ${shown} ms; typing ${perKey.toFixed(1)} ms per key in one`,
          );
          expect(run.browser.cspProblems()).toEqual([]);
          shownSamples.push(shown);
          perKeySamples.push(perKey);
        }
        const label = `document-review-cost ${engine} 32 reviews`;
        judgeMedians([
          { label: `${label} per key`, samples: perKeySamples, gate: 150, below: true },
          { label: `${label} shown`, samples: shownSamples, gate: 20_000, below: true },
        ]);
      },
      perfScaled(PERF_RUNS * TEST_TIMEOUT_MS * 2),
    );
  });
}
