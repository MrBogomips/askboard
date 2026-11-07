// The Approval, the Scale and the Ranking on an Italian board, in each engine, on the widget host
// (approval-scale-ranking, task 6.7; spec view-and-widgets: The three widgets' strings): a board in
// it-IT holding the three shows "Approvazione", "Approva con modifiche", "Mantieni quest'ordine"
// and "Sposta su" and none of their English strings, in the text and in the accessible names, and
// the Approval's summary formats the values it lists in the ask's locale, so that a Tree number
// changed from 1234.5 to 10 reads "1.234,5" struck through before "10".

import { describe, expect, test } from "bun:test";
import { RANKING_FIXTURE_ITEM, treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { VERDICT } from "./fixtures/approval-asks.ts";
import { plan, wbs } from "./fixtures/tree-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { pressIn, treeGridOf } from "./harness/tree-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const RATING = {
  type: "scale",
  id: "mood",
  props: { min: 1, max: 5, display: "rating", minLabel: "Basso", maxLabel: "Alto" },
} as const;
const SLIDER = { type: "scale", id: "share", props: { min: 0, max: 100, step: 5 } } as const;

const documentOf = (items: readonly unknown[]): ViewDocument =>
  ({
    ...treeBoardDocument,
    language: "it-IT",
    items: [{ ...plan, props: { ...plan.props, items } }],
  }) as unknown as ViewDocument;

// The chrome of the three in English, as the string tables write it (agent content never is one).
const ENGLISH = [
  "Approval",
  "Approve",
  "Reject",
  "Not set",
  "Keep this order",
  "Move up",
  "Move down",
  "Your changes",
  "Order kept",
  "No changes",
  "Drag ",
  "Reason for the changes",
  "Note for the agent",
  "Lower value",
  "Upper value",
  "and 2 more",
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

// None of the English strings is shown or named in the card, now (agent content is never one).
const expectNoEnglish = async (board: Board): Promise<string> => {
  const shown = (await shownIn(board)).join("\n");
  for (const english of ENGLISH)
    expect({ english, shown: shown.includes(english) }).toEqual({ english, shown: false });
  return shown;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the three result widgets on an Italian board`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the three show their strings in Italian and none of the English ones, before and after the user acts",
      async () => {
        const run = await host(
          dist,
          documentOf([wbs, RATING, SLIDER, RANKING_FIXTURE_ITEM, VERDICT]),
        );
        await readyIn(run);
        const { board } = run;
        const text = (name: string) => board.view.getByText(name, { exact: true });
        await text("Approvazione").first().waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const name of ["Approva", "Approva con modifiche", "Respingi"]) {
          expect(await board.view.getByRole("radio", { name, exact: true }).count()).toBe(1);
        }
        for (const name of ["Mantieni quest'ordine", "Sposta su", "Sposta giù"]) {
          expect(
            await board.view
              .getByRole("toolbar", { name: "Strumenti della classifica" })
              .getByRole("button", { name, exact: true })
              .count(),
          ).toBe(1);
        }
        expect(await text("Non impostato").count()).toBe(2);
        expect(await board.view.locator("[data-ranking-counter]").textContent()).toBe(
          "Nessuna modifica",
        );
        // Before the user's first act: the unset rating and slider, the Approval with no decision
        // and the Ranking's first counter name nothing in English (spec review S-1 of group 6).
        await expectNoEnglish(board);
        // The user acts: the reason's label, the rating, the kept order and the Ranking's move.
        await board.view.getByRole("radio", { name: "Approva con modifiche", exact: true }).click();
        await board.view
          .getByRole("textbox", { name: "Motivo delle modifiche (obbligatorio)", exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByRole("button", { name: "Rispondi", exact: true }).click();
        await text("Aggiungi il motivo delle modifiche.").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByRole("radio", { name: "4", exact: true }).click();
        await board.view.locator('[data-ranking-row="comfort"]').focus();
        await board.view
          .getByRole("toolbar", { name: "Strumenti della classifica" })
          .getByRole("button", { name: "Sposta su", exact: true })
          .click();
        await eventually(
          async () =>
            (await board.view.locator("[data-ranking-counter]").textContent()) ===
            "Le tue modifiche: 2 spostati",
          "the counter in Italian",
        );
        await board.view
          .getByRole("toolbar", { name: "Strumenti della classifica" })
          .getByRole("button", { name: "Mantieni quest'ordine", exact: true })
          .click();
        const shown = await expectNoEnglish(board);
        expect(shown).toContain("Trascina Speed");
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Tree number changed from 1234.5 to 10 beside an Approval reads 1.234,5 struck through before 10, in the ask's locale",
      async () => {
        const effort = {
          type: "tree",
          id: "wbs",
          props: {
            columns: [{ field: "effort", label: "Impegno", type: "number" }],
            nodes: [
              { id: "portal", label: "Portale clienti", effort: 1234.5 },
              { id: "billing", label: "Fatturazione", effort: 8 },
            ],
          },
        } as const;
        const run = await host(dist, documentOf([effort, VERDICT]));
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tree.cell("portal", 1).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("F2");
        await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.type("10");
        await pressIn(board, "Enter");
        const line = board.view.locator("[data-summary-line]");
        await line.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.view.locator("[data-summary-title]").textContent()).toBe("1 modifica");
        expect(await line.locator("del").textContent()).toBe("1.234,5");
        expect(await line.locator("ins").textContent()).toBe("10");
        expect(
          await line.locator("del").evaluate((el) => getComputedStyle(el).textDecorationLine),
        ).toContain("line-through");
        // The struck-through value comes before the new one.
        expect(
          await line.evaluate((el) => {
            const [old, now] = [el.querySelector("del"), el.querySelector("ins")];
            return old !== null && now !== null
              ? Boolean(old.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING)
              : false;
          }),
        ).toBe(true);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
