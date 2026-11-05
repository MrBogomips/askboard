// The widgets' number and date entry in the ask's locale, in each engine (settings-languages, task
// 9.3): the browser runs in German in each extreme time zone of AD-13's determinism runs, and the
// widgets follow the ask alone. An it-IT ask's Tree reads `1.234,5` and echoes `= 1234,5`, and
// refuses an en-US entry with the Italian reason; an en-US ask with the it-IT locale reads the same
// entry and refuses in English; its Gantt takes `9/12/2026` day first, echoes `= mer 9 dic 2026`,
// shows `09/12/2026` in the grid and labels its axis in Italian.

import { describe, expect, test } from "bun:test";
import { parseNumber } from "@askboard/contract";
import { ganttBoardDocument, treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { editorFocused, keysTo } from "./fixtures/gantt-input.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { pressIn, treeGridOf } from "./harness/tree-grid.ts";
import { expectSteps, focusPortal, readyIn, typeIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const ZONES = ["Pacific/Kiritimati", "America/Adak"] as const;
const italian = { language: "it-IT" } as const;
const mixed = { language: "en-US", locale: "it-IT" } as const;
const withAsk = <D extends object>(document: D, ask: object): ViewDocument =>
  ({ ...document, ...ask }) as unknown as ViewDocument;

const ITALIAN_MONTHS = /^(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)$/;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const timezoneId of ZONES) {
    describe(`${engine}, de-DE, ${timezoneId}: the widgets in the ask's locale`, () => {
      const { host } = useWidgetHost(engine);
      const options = { locale: "de-DE", timezoneId };
      const opened = (document: ViewDocument) => {
        const open = openerFor((build, doc) => host(build, doc, options), dist);
        return open(document);
      };

      test(
        "an it-IT Tree reads 1.234,5, echoes = 1234,5, shows 1234,5 and refuses an en-US entry in Italian",
        async () => {
          const run = await host(dist, withAsk(treeBoardDocument, italian), options);
          await readyIn(run);
          const tree = treeGridOf(run.board);
          await focusPortal(run, tree);
          await expectSteps(run, tree, [
            ["ArrowRight", { nodeId: "portal", cell: 0 }],
            ["ArrowRight", { nodeId: "portal", cell: 1 }],
          ]);
          await typeIn(run, tree, "F2", "1.234,5");
          expect(await tree.cell("portal", 1).textContent()).toContain("= 1234,5");
          expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "portal", cell: 1 });
          expect(((await tree.cell("portal", 1).textContent()) ?? "").trim()).toBe("1234,5");
          await typeIn(run, tree, "F2", "1,234.5");
          await run.board.page.keyboard.press("Enter");
          const refusal = parseNumber("1,234.5", "it-IT");
          if (refusal.kind !== "refused") throw new Error("the entry was read");
          await run.board.view
            .getByText(refusal.reason, { exact: true })
            .waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "an en-US ask with the it-IT locale reads 1.234,5 and refuses in English",
        async () => {
          const run = await host(dist, withAsk(treeBoardDocument, mixed), options);
          await readyIn(run);
          const tree = treeGridOf(run.board);
          await focusPortal(run, tree);
          await expectSteps(run, tree, [
            ["ArrowRight", { nodeId: "portal", cell: 0 }],
            ["ArrowRight", { nodeId: "portal", cell: 1 }],
          ]);
          await typeIn(run, tree, "F2", "1.234,5");
          expect(await tree.cell("portal", 1).textContent()).toContain("= 1234,5");
          await run.board.page.keyboard.press("Escape");
          await typeIn(run, tree, "F2", "1,234.5");
          await run.board.page.keyboard.press("Enter");
          const refusal = parseNumber("1,234.5", "it-IT", "en-US");
          if (refusal.kind !== "refused") throw new Error("the entry was read");
          await run.board.view
            .getByText(refusal.reason, { exact: true })
            .waitFor({ timeout: STEP_TIMEOUT_MS });
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "an it-IT Gantt takes 9/12/2026 day first, echoes = mer 9 dic 2026, shows 09/12/2026 and labels its axis in Italian",
        async () => {
          const run = await opened(withAsk(ganttBoardDocument, italian));
          const gantt = ganttOf(run.board);
          for (const label of await gantt.root.locator("[data-gantt-tick]").allTextContents()) {
            expect(
              label
                .trim()
                .split(" ")
                .some((part) => ITALIAN_MONTHS.test(part)),
            ).toBe(true);
          }
          await keysTo(run.board, "reporting", "start");
          await run.board.page.keyboard.press("Enter");
          const editor = gantt.cell("reporting", "start").locator("input");
          expect(await editor.inputValue()).toBe("04/12/2026");
          expect(await editorFocused(run.board, "reporting", "start")).toBe(true);
          await run.board.page.keyboard.type("9/12/2026");
          expect(await gantt.cell("reporting", "start").textContent()).toContain(
            "= mer 9 dic 2026",
          );
          await run.board.page.keyboard.press("Enter");
          expect(((await gantt.cell("reporting", "start").textContent()) ?? "").trim()).toBe(
            "09/12/2026",
          );
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "an en-US ask with the it-IT locale shows the Gantt's dates in Italian formats",
        async () => {
          const run = await opened(withAsk(ganttBoardDocument, mixed));
          const gantt = ganttOf(run.board);
          expect(((await gantt.cell("reporting", "start").textContent()) ?? "").trim()).toBe(
            "04/12/2026",
          );
          await keysTo(run.board, "reporting", "start");
          await run.board.page.keyboard.press("Enter");
          await run.board.page.keyboard.type("9/12/2026");
          expect(await gantt.cell("reporting", "start").textContent()).toContain(
            "= mer 9 dic 2026",
          );
        },
        TEST_TIMEOUT_MS,
      );
    });
  }
}
