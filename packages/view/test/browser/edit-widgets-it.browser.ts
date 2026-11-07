// The LaTeX, the Kanban and the Timeline on an Italian board, in each engine, on the widget host
// (latex-kanban-timeline, task 6.5; spec view-and-widgets: LaTeX, Kanban and Timeline strings): a
// board in it-IT holding the three shows "Sorgente LaTeX", "Sposta in…", "Sposta dopo" and "Sposta
// nella corsia…", the counters, the names of cards and entries and the dates in Italian, and none
// of the English chrome, in the text and in the accessible names, before and after the user acts.
// The agent's own labels are data and stay as sent.

import { describe, expect, test } from "bun:test";
import { LATEX_FIXTURE_ITEM, treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { kanbanItem } from "./fixtures/kanban-documents.ts";
import { timelineItem } from "./fixtures/timeline-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { cardOf } from "./harness/kanban-drag.ts";
import { entryOf } from "./harness/timeline-drag.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const italian: ViewDocument = {
  ...treeBoardDocument,
  language: "it-IT",
  items: [
    {
      ...plan,
      props: {
        ...plan.props,
        items: [LATEX_FIXTURE_ITEM, kanbanItem("it-IT"), timelineItem("it-IT")],
      },
    },
  ],
} as unknown as ViewDocument;

// The chrome of the three in English, as the string tables write it (agent content never is one).
const ENGLISH = [
  "LaTeX source",
  "Preview",
  "Kanban tools",
  "Move to…",
  "Timeline tools",
  "Move earlier",
  "Move later",
  "Move to lane…",
  "No changes",
  "Your changes",
  "expression edited",
  "1 moved",
  "milestone",
  " cards",
  "Jan ",
  "Feb ",
  "Day",
  "Week",
  "Month",
] as const;

// What the question card shows and names: its text and every accessible label, title and value
// text in it.
const shownIn = (board: Board): Promise<string[]> =>
  board.view
    .locator("[data-askboard-question]")
    .evaluate((card) => [
      card.textContent ?? "",
      ...[...card.querySelectorAll("[aria-label], [title], [aria-valuetext]")].flatMap(
        (element) => [
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? "",
          element.getAttribute("aria-valuetext") ?? "",
        ],
      ),
    ]);

const expectNoEnglish = async (board: Board): Promise<string> => {
  const shown = (await shownIn(board)).join("\n");
  for (const english of ENGLISH) {
    expect({ english, shown: shown.includes(english) }).toEqual({ english, shown: false });
  }
  return shown;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the LaTeX, the Kanban and the Timeline on an Italian board`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the three show their strings in Italian and none of the English ones, before and after the user acts",
      async () => {
        const run = await host(dist, italian);
        await readyIn(run);
        const { board } = run;
        const kanbanTool = (name: string) =>
          board.view
            .getByRole("toolbar", { name: "Strumenti del Kanban" })
            .getByRole("button", { name, exact: true });
        const timelineTool = (name: string) =>
          board.view
            .getByRole("toolbar", { name: "Strumenti della timeline" })
            .getByRole("button", { name, exact: true });
        // "Sorgente LaTeX" names the field, "Anteprima" the preview.
        expect(await board.view.getByLabel("Sorgente LaTeX", { exact: true }).count()).toBe(1);
        expect(await board.view.getByLabel("Anteprima", { exact: true }).count()).toBe(1);
        expect(await kanbanTool("Sposta in…").count()).toBe(1);
        for (const name of ["Sposta prima", "Sposta dopo", "Sposta nella corsia…"]) {
          expect(await timelineTool(name).count()).toBe(1);
        }
        expect(await board.view.getByRole("group", { name: "Da fare, 2 schede" }).count()).toBe(1);
        expect(await board.view.getByRole("group", { name: "Fatto, 1 scheda" }).count()).toBe(1);
        expect(
          await board.view
            .getByRole("option", { name: "Checkout, dal 5 gen al 9 gen 2026, Web" })
            .count(),
        ).toBe(1);
        expect(
          await board.view
            .getByRole("option", { name: "Lancio, traguardo, 2 feb 2026, Mobile" })
            .count(),
        ).toBe(1);
        expect(await board.view.locator("[data-kanban-counter]").textContent()).toContain(
          "Nessuna modifica",
        );
        expect(await board.view.locator("[data-timeline-counter]").textContent()).toContain(
          "Nessuna modifica",
        );
        await expectNoEnglish(board);

        // The user acts on each: a parse error, then a corrected expression, a card and a milestone.
        const source = board.view.locator("[data-latex-source]");
        await source.fill("\\frac{1}{");
        await eventually(
          async () =>
            ((await board.view.locator("[data-latex-error]").textContent()) ?? "").startsWith(
              "Questa espressione non si visualizza: ",
            ),
          "the field error in Italian",
        );
        expect(await board.view.locator("[data-latex-error]").textContent()).not.toContain(
          "This expression",
        );
        await source.fill("a^2+b^2=c^2");
        await eventually(
          async () =>
            (await board.view.locator("[data-latex-counter]").textContent())?.trim() ===
            "Le tue modifiche: espressione modificata",
          "the LaTeX counter in Italian",
        );
        await cardOf(board, "a").click();
        await kanbanTool("Sposta in…").click();
        await board.view.getByRole("menuitem", { name: "In corso", exact: true }).click();
        await eventually(
          async () =>
            ((await board.view.locator("[data-kanban-counter]").textContent()) ?? "").trim() ===
            "Le tue modifiche: 1 spostata",
          "the Kanban counter in Italian",
        );
        await entryOf(board, "launch").focus();
        await timelineTool("Sposta dopo").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            ((await board.view.locator("[data-timeline-counter]").textContent()) ?? "").trim() ===
            "Le tue modifiche: 1 spostato",
          "the Timeline counter in Italian",
        );
        const shown = await expectNoEnglish(board);
        expect(shown).toContain("9 feb 2026");
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
