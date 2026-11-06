// The Tree's, the Gantt's and the work breakdown's own chrome in the ask's language, in each
// engine, on the widget host (widget-editing-plus spec, "Widget chrome follows the ask's
// language"; review F-04): the UJ-2 board (a work breakdown and its plan) opened in it-IT shows the tools, the counters, the
// column headers, the zoom, the legend and the chart's name in Italian, none of the English
// strings the review lists remains in the Tree's or the Gantt's frame, and the same board in
// en-US reads as before. The agent's own texts (its column labels, its task names) stay as sent.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { wbsPlan } from "./fixtures/wbs-documents.ts";
import { LOAD_TIMEOUT_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const ask = (language: "en-US" | "it-IT"): ViewDocument =>
  ({ ...uj2ExpandedBoardDocument, language }) as unknown as ViewDocument;

// The review's English strings (F-04) that an Italian board must not show in these widgets.
const ENGLISH = [
  "Add node",
  "Add child",
  "Move up",
  "Move down",
  "Indent",
  "Outdent",
  "Delete",
  "Changes vs agent's original",
  "Depends on",
  "Duration",
  "critical path",
  "your change",
  "Work package",
  "Expected",
  "Spread",
  "No changes",
] as const;

const words = (text: string): string => text.replace(/\s+/g, " ");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the widgets' chrome follows the ask's language`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an it-IT plan board shows the Tree's and the Gantt's chrome in Italian and none of the review's English strings",
      async () => {
        const run = await host(dist, ask("it-IT"));
        await readyIn(run);
        const tree = treeGridOf(run.board);
        const gantt = ganttOf(run.board, wbsPlan.id);
        await tree.counter.waitFor({ timeout: STEP_TIMEOUT_MS });
        await gantt.bars.first().waitFor({ timeout: LOAD_TIMEOUT_MS });
        expect(await tree.tools.allTextContents()).toEqual([
          "Aggiungi nodo",
          "Aggiungi figlio",
          "Sposta su",
          "Sposta giù",
          "Rientra",
          "Riduci rientro",
          "Elimina",
        ]);
        expect(await tree.counter.textContent()).toBe("Nessuna modifica");
        const treeHeaders = words((await tree.headers.allTextContents()).join(" | "));
        expect(treeHeaders).toContain("Pacchetto di lavoro");
        expect(treeHeaders).toContain("Atteso");
        expect(treeHeaders).toContain("Dispersione");
        const ganttText = words((await gantt.root.textContent()) ?? "");
        for (const italian of [
          "Attività",
          "Inizio",
          "Durata",
          "Dipende da",
          "Giorno",
          "Settimana",
          "Mese",
        ]) {
          expect(ganttText.toLowerCase()).toContain(italian.toLowerCase());
        }
        expect(ganttText.toLowerCase()).toContain("percorso critico");
        expect(ganttText.toLowerCase()).toContain("tua modifica");
        const chartName = await gantt.root.getByRole("img").first().getAttribute("aria-label");
        expect(chartName).toMatch(/^Diagramma di Gantt, zoom /);
        const shown = [
          ...(await tree.tools.allTextContents()),
          treeHeaders,
          (await tree.counter.textContent()) ?? "",
          ganttText,
          chartName ?? "",
        ].join(" | ");
        for (const english of ENGLISH) expect(shown).not.toContain(english);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the same board in en-US reads as before",
      async () => {
        const run = await host(dist, ask("en-US"));
        await readyIn(run);
        const tree = treeGridOf(run.board);
        const gantt = ganttOf(run.board, wbsPlan.id);
        await tree.counter.waitFor({ timeout: STEP_TIMEOUT_MS });
        await gantt.bars.first().waitFor({ timeout: LOAD_TIMEOUT_MS });
        expect(await tree.tools.allTextContents()).toEqual([
          "Add node",
          "Add child",
          "Move up",
          "Move down",
          "Indent",
          "Outdent",
          "Delete",
        ]);
        expect(await tree.counter.textContent()).toBe("No changes");
        const ganttText = words((await gantt.root.textContent()) ?? "");
        expect(ganttText).toContain("Depends on");
        expect(ganttText).toContain("critical path");
        expect(await gantt.root.getByRole("img").first().getAttribute("aria-label")).toMatch(
          /^Gantt chart, \w+ zoom$/,
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
