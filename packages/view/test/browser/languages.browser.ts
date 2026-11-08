// The view spec's "The board's interface in the ask's language" and "Values shown in the ask's
// locale", in each engine (settings-languages, task 7.4): the browser runs in German, in each
// extreme time zone of AD-13's determinism runs, and the board still follows the ask alone. An
// it-IT ask shows the Italian strings and `lang="it"` on the board page and in the view, with the
// agent's English text as sent; an en-US ask with the it-IT locale shows English strings and
// Italian formats; header row 2 in Italian fits a 1280 px viewport (DESIGN, Open Items 5); no
// control changes the language. "Impostazioni" comes with the settings panel (group 8).

import { describe, expect, test } from "bun:test";
import { formatTime } from "@askboard/contract";
import { atomAsk } from "./fixtures/atom-documents.ts";
import { NOTES, reviewItem } from "./fixtures/document-review-documents.ts";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { ROLES, tableAsk } from "./fixtures/table-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  buttonOf,
  card,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { annotationsHeld, marks, select } from "./harness/review-steps.ts";
import {
  cellOf,
  cellText,
  tableGridOf,
  toolOf,
  totalText,
  typeInCell,
} from "./harness/table-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const QUESTION = "Which database should the order service use?";
const italianAsk = { ...twoAsk, askId: "two-italian-i7t1", language: "it-IT" };
const mixedAsk = { ...twoAsk, askId: "two-mixed-m1x2", language: "en-US", locale: "it-IT" };

/** The zones of AD-13's determinism runs: 14 hours ahead of UTC, and 10 or 9 behind. */
const ZONES = ["Pacific/Kiritimati", "America/Adak"] as const;

/** A zone's offset at an instant, in minutes east of UTC, as the test computes it. */
const offsetAt = (zone: string, instant: string): number => {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(new Date(instant))
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (match === null) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
};

const langOf = (board: Board) => ({
  page: board.page.locator("html").getAttribute("lang"),
  view: board.view.locator("html").getAttribute("lang"),
});

// Every control on the board page and in the view: none may set the language.
const languageControls = async (board: Board): Promise<number> => {
  const named = /language|lingua|english|italiano|en-US|it-IT/i;
  const count = async (scope: Board["view"] | Board["page"]) =>
    (await scope.getByRole("combobox").count()) +
    (await scope.getByRole("listbox").count()) +
    (await scope.getByRole("button", { name: named }).count()) +
    (await scope.getByRole("radio", { name: named }).count());
  return (await count(board.page)) + (await count(board.view));
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const timezoneId of ZONES) {
    describe(`${engine}, de-DE, ${timezoneId}: the board in the ask's language`, () => {
      const { start } = useEngine(engine);
      const options = { locale: "de-DE", timezoneId };

      test(
        "an it-IT ask shows Rispondi and Rinvia and lang it, its English question untouched, with no language control",
        async () => {
          const run = await start(lifecycleScenario(italianAsk, dist), options);
          const board = await openBoard(run, ["database", "cache"]);
          await buttonOf(board, "database", "Rispondi").waitFor({ timeout: STEP_TIMEOUT_MS });
          await buttonOf(board, "database", "Rinvia").waitFor({ timeout: STEP_TIMEOUT_MS });
          await card(board, "database")
            .getByText(QUESTION, { exact: true })
            .first()
            .waitFor({ timeout: STEP_TIMEOUT_MS });
          const lang = langOf(board);
          expect({ page: await lang.page, view: await lang.view }).toEqual({
            page: "it",
            view: "it",
          });
          expect(await buttonOf(board, "database", "Answer").count()).toBe(0);
          expect(await languageControls(board)).toBe(0);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "header row 2 in Italian fits the 1280 px viewport with no overflow",
        async () => {
          const run = await start(lifecycleScenario(italianAsk, dist), options);
          const board = await openBoard(run, ["database", "cache"]);
          const row = board.view.locator("header > div").nth(1);
          await row.getByText("Prossima aperta ↓").waitFor({ timeout: STEP_TIMEOUT_MS });
          const fit = await row.evaluate((element) => {
            const right = Math.max(
              ...[...element.children].map((child) => child.getBoundingClientRect().right),
            );
            return {
              overflow: element.scrollWidth > element.clientWidth,
              inside: right <= element.getBoundingClientRect().right + 0.5,
              viewport: window.innerWidth,
            };
          });
          expect(fit).toEqual({ overflow: false, inside: true, viewport: 1280 });
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "an en-US ask with the it-IT locale shows English strings and Italian formats",
        async () => {
          const run = await start(lifecycleScenario(mixedAsk, dist), options);
          const board = await openBoard(run, ["database", "cache"]);
          await buttonOf(board, "database", "Answer").waitFor({ timeout: STEP_TIMEOUT_MS });
          await buttonOf(board, "database", "Ask a follow-up").click();
          await card(board, "database")
            .getByRole("textbox", { name: "Ask the agent a follow-up…" })
            .fill("Is it needed for the pilot?");
          await buttonOf(board, "database", "Send").click();
          const time = card(board, "database").locator("[data-askboard-message] time").first();
          await time.waitFor({ timeout: STEP_TIMEOUT_MS });
          const when = (await time.getAttribute("datetime")) ?? "";
          const shown = (await time.textContent()) ?? "";
          expect(shown).toMatch(/^\d{2}:\d{2}$/);
          expect(shown).toBe(formatTime(when, offsetAt(timezoneId, when), "it-IT"));
          const lang = langOf(board);
          expect({ page: await lang.page, view: await lang.view }).toEqual({
            page: "en",
            view: "en",
          });
        },
        TEST_TIMEOUT_MS,
      );
    });
  }
}

// The Table's en-US strings (table-widget task 7.3; spec view-and-widgets: Table strings): none may
// show in an it-IT board's text, accessible names or titles. The agent's own labels are English as
// sent and never count.
const ENGLISH_TABLE_STRINGS =
  /Add row|Delete row|Table tools|No changes|Your changes?|\bTotal\b|Computed|Not set|at most|characters|\bCorrect\b/;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an it-IT Table`, () => {
    const { start } = useEngine(engine);

    test(
      "the toolbar, the counter, the total, the cell names and the 501-character error read in Italian, the amounts in Italian formats, and no English string of the Table shows",
      async () => {
        const ask = tableAsk(ROLES, { askId: "table-italian-t9i1", language: "it-IT" });
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await toolOf(table, "Aggiungi riga").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await toolOf(table, "Elimina riga").count()).toBe(1);
        expect(await cellText(table, "pm", "rate")).toBe("$ 1.040,00");
        expect(await totalText(table, "amount")).toBe("$ 70.560,00");
        expect(await table.frame.locator("[data-total-row]").textContent()).toContain("Totale");
        expect(await table.counter.textContent()).toContain("Nessuna modifica");
        await cellOf(table, "pm", "role").click();
        await toolOf(table, "Aggiungi riga").click();
        await eventually(async () => (await table.rows.count()) === 3, "the row to be added");
        await eventually(
          async () => ((await table.counter.textContent()) ?? "").includes("Le tue modifiche: 1"),
          "the counter to count the row",
        );
        await typeInCell(board, table, "u-1", "role", "Role, riga 2", "x".repeat(501));
        const error = table.frame.locator("[data-row-error]");
        await error.first().waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await error.first().textContent()).toContain(
          "Una cella di testo contiene al massimo 500 caratteri.",
        );
        const shown = await table.frame.evaluate((frame) => {
          const names = [...frame.querySelectorAll("[aria-label], [title]")].flatMap((element) => [
            element.getAttribute("aria-label") ?? "",
            element.getAttribute("title") ?? "",
          ]);
          // The 501 typed characters are the user's text, not a string of the Table.
          return [(frame.textContent ?? "").replaceAll("x".repeat(501), ""), ...names];
        });
        for (const text of shown) expect(text).not.toMatch(ENGLISH_TABLE_STRINGS);
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// The Document review's en-US strings (document-review task 7.3; spec view-and-widgets: Document
// review strings): none may show in an it-IT board's text, accessible names or titles. The agent's
// own text (the title, the document) is English as sent and never counts.
const ENGLISH_REVIEW_STRINGS =
  /Document review|\bComment\b|comments?\b(?! to)|Suggest|suggested edits?|Detached|Replace with|Note \(optional\)|\bDone\b|\bEdit\b|\bDelete\b|\bClose\b|Your changes|Select a passage|\bPin \d/;
// The agent's title and document, as sent.
const AGENT_TEXT = [
  "Release notes",
  "Release 0.2",
  "The board remembers drafts and keeps unsent answers.",
  "See the docs for more.",
  "First item",
  "Second item",
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an it-IT Document review`, () => {
    const { start } = useEngine(engine);

    test(
      "the tools, the labels, the counter, the pins and the detached list read in Italian, and no English string of the Document review shows",
      async () => {
        const ask = atomAsk([reviewItem(NOTES, "Release notes")], {
          askId: "review-italian-t7i1",
          language: "it-IT",
        });
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        const dialog = view.getByRole("dialog");
        const open = async (needle: string, tool: string) => {
          expect(await select(view, needle)).toBe(true);
          await view.getByRole("toolbar").getByRole("button", { name: tool, exact: true }).click();
          await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        };
        await open("remembers", "Commenta");
        await dialog.getByLabel("Il tuo commento").fill("Per quanto tempo?");
        await dialog.getByRole("button", { name: "Fatto" }).click();
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await open("drafts", "Suggerisci modifica");
        await dialog.getByLabel("Sostituisci con").fill("risposte non inviate");
        await dialog.getByRole("button", { name: "Fatto" }).click();
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => annotationsHeld(sentDrafts(run)).length === 2,
          "two annotations mirrored",
        );
        expect(await view.getByRole("button", { name: "Commento 1", exact: true }).count()).toBe(1);
        expect(
          await view.getByRole("button", { name: "Modifica suggerita 2", exact: true }).count(),
        ).toBe(1);
        const counter = await view.locator("[data-document-review]").textContent();
        expect(counter).toContain("1 commento");
        expect(counter).toContain("1 modifica suggerita");
        // Answer, reopen with the commented word rewritten, and start from the answer: the comment
        // is detached.
        await buttonOf(board, "plan", "Rispondi").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.update([
          { action: "reopen", itemId: "plan" },
          {
            action: "change",
            itemId: "review",
            props: reviewItem(NOTES.replace("remembers", "recalls"), "Release notes").props,
          },
        ]);
        const reopened = card(board, "plan").locator('[data-askboard-notice="reopened"]');
        await reopened.waitFor({ timeout: STEP_TIMEOUT_MS });
        await reopened
          .getByRole("button", { name: "Parti dalla mia risposta precedente" })
          .click({ timeout: STEP_TIMEOUT_MS });
        const list = view.getByRole("region", { name: "Commenti staccati" });
        await eventually(async () => (await list.count()) === 1, "the detached list");
        expect(await list.textContent()).toContain("Per quanto tempo?");
        expect(await list.textContent()).toContain("Il documento è cambiato");
        expect(await list.getByRole("button", { name: /^Elimina/ }).count()).toBe(2);
        // The suggested edit quotes "drafts" with its context, which the rewrite broke too.
        expect(await list.textContent()).toContain("risposte non inviate");
        expect(await marks(view).count()).toBe(0);
        const answer = buttonOf(board, "plan", "Rispondi");
        expect(await answer.isDisabled()).toBe(true);
        const hintId = await answer.getAttribute("aria-describedby");
        expect(await view.locator(`[id="${hintId}"]`).textContent()).toBe(
          "Elimina prima i commenti staccati in Release notes.",
        );
        // No English string of the widget in the text, the names or the titles.
        const shown = await card(board, "plan").evaluate((body) => {
          const names = [...body.querySelectorAll("[aria-label], [title]")].flatMap((element) => [
            element.getAttribute("aria-label") ?? "",
            element.getAttribute("title") ?? "",
          ]);
          return [body.textContent ?? "", ...names];
        });
        const stripped = shown.map((text) =>
          AGENT_TEXT.reduce((rest, agent) => rest.replaceAll(agent, ""), text),
        );
        for (const text of stripped) expect(text).not.toMatch(ENGLISH_REVIEW_STRINGS);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
