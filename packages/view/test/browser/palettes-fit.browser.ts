// The frame's fit in every palette and scheme (palettes, task 3.6, design decision D11; view-and-
// widgets spec: Fit in every palette): at 1280x800, in en-US and it-IT, compact and comfortable, with three
// answers ready in "All together", no label of the outbox, the ledger or the header is clipped and no
// header row or rail element is wider than its box; the Theme popover holds four palettes' segments
// with none clipped. A label clipped here stops the group for the architect: the rail's width is the
// PO's. Screenshots of Carta on the board, light and dark, compact, go to the folder named by
// ASKBOARD_PALETTE_SHOTS when it is set (for the pull request). Chromium runs it; every scenario
// runs on the session process.

import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { answeringAsk, type Language } from "./fixtures/answering-flow-asks.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { clipped } from "./harness/fit.ts";
import { answerOf, lifecycleScenario, openBoard, optionOf } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const PALETTES = ["carta", "nordico", "grafite", "contrasto"] as const;
const THEMES = ["light", "dark"] as const;
const DENSITIES = ["compact", "comfortable"] as const;
const LANGUAGES: readonly Language[] = ["en-US", "it-IT"];
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];

/** The elements of the Theme popover that are wider than their box. */
const clippedSegments = (board: Board): Promise<string[]> =>
  board.paletteRow.evaluate((row) => {
    const popover = row.closest("[role=dialog]") ?? row.parentElement;
    if (popover === null) return ["no popover"];
    return [popover, ...popover.querySelectorAll("*")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => `${element.tagName.toLowerCase()}[${(element.textContent ?? "").trim()}]`);
  });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the frame's labels fit in every palette`, () => {
    const { start } = useEngine(engine);

    for (const language of LANGUAGES) {
      for (const palette of PALETTES) {
        for (const theme of THEMES) {
          for (const density of DENSITIES) {
            test(
              `${palette}, ${theme}, ${density}, ${language}: three answers ready, nothing clipped, the Theme popover whole`,
              async () => {
                const run = await start({
                  ...lifecycleScenario(answeringAsk("sections", language, "submitted"), dist),
                  config: { user: { version: "1.0", palette, theme, density } },
                });
                const board = await openBoard(run, ALL);
                for (const id of ["q1", "q2", "q3"]) {
                  await optionOf(board, id, language === "it-IT" ? "Sì" : "Yes").click({
                    timeout: STEP_TIMEOUT_MS,
                  });
                  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
                }
                await board.outbox.waitFor({ timeout: STEP_TIMEOUT_MS });
                expect(await clipped(board)).toEqual([]);
                await board.themeControl.click({ timeout: STEP_TIMEOUT_MS });
                await board.paletteRow.waitFor({ timeout: STEP_TIMEOUT_MS });
                expect(await clippedSegments(board)).toEqual([]);
                const shots = process.env.ASKBOARD_PALETTE_SHOTS;
                if (
                  shots !== undefined &&
                  language === "en-US" &&
                  palette === "carta" &&
                  density === "compact"
                ) {
                  await board.page.keyboard.press("Escape");
                  await mkdir(shots, { recursive: true });
                  await board.page.screenshot({ path: join(shots, `carta-${theme}-compact.png`) });
                }
              },
              TEST_TIMEOUT_MS,
            );
          }
        }
      }
    }
  });
}
