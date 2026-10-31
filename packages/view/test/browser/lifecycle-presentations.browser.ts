// The ask lifecycle's presentations and navigation, in each engine (ask-lifecycle, task 6.2; view
// spec: Single-question board, Presentations, Tabs, One question per view, Outline navigator):
// sections by default, tabs with their open counts and their hidden questions mounted and ready,
// tabs without areas as one group, one question per view with its navigator, the outline's jump
// into another tab, an area the agent empties, and the single-question board whatever the ask
// requests. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import {
  emptiedAsk,
  flatTabsAsk,
  onePerViewAsk,
  sectionsAsk,
  singleRequestingMoreAsk,
  tabsAsk,
} from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
  viewText,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const heading = (board: Board, id: string) =>
  card(board, id)
    .getByRole("heading", { level: 2 })
    .or(card(board, id).getByRole("heading", { level: 3 }));

// Answers a plain question "Yes" with the mouse and waits for its receipt.
const answerYes = async (board: Board, id: string) => {
  await optionOf(board, id, "Yes").click({ timeout: STEP_TIMEOUT_MS });
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await card(board, id).getByText("sent", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: presentations and navigation`, () => {
    const { start } = useEngine(engine);

    test(
      "three areas without a presentation: three titled sections, one after another, and the outline",
      async () => {
        const run = await start(lifecycleScenario(sectionsAsk, dist));
        const board = await openBoard(run, ["region", "mobile", "export", "flag"]);
        const areas = board.view.locator("[data-askboard-area]");
        expect(await areas.count()).toBe(3);
        for (const [at, title] of ["Scope", "Data", "Release"].entries()) {
          await areas.nth(at).getByRole("heading", { name: title, level: 2 }).waitFor();
        }
        const outline = board.view.getByRole("navigation", { name: "Outline" });
        await outline.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await outline.getByText("Unanswered", { exact: true }).count()).toBe(4);
        expect(await board.view.getByRole("tablist").count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "tabs: one tab per area with its open count; hidden tabs stay mounted and ready; answering the last open question of a tab clears its count only",
      async () => {
        const run = await start(lifecycleScenario(tabsAsk, dist));
        const board = await openBoard(run, [
          "region",
          "payment",
          "analytics",
          "rollout",
          "erp-export",
        ]);
        const scope = board.view.getByRole("tab", { name: /Scope/ });
        const delivery = board.view.getByRole("tab", { name: /Delivery/ });
        expect(await scope.textContent()).toContain("3 open");
        expect(await delivery.textContent()).toContain("2 open");
        // The hidden tab's questions are mounted and ready: not busy, though not visible.
        expect(await card(board, "rollout").getAttribute("aria-busy")).toBe("false");
        expect(await card(board, "rollout").isVisible()).toBe(false);
        await delivery.click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "rollout").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        for (const id of ["rollout", "erp-export"]) {
          const label = id === "rollout" ? "All at once" : "Yes";
          await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
          await card(board, id)
            .getByText("sent", { exact: true })
            .waitFor({ timeout: STEP_TIMEOUT_MS });
        }
        await eventually(
          async () => !((await delivery.textContent()) ?? "").includes("open"),
          "the Delivery tab to show no open question",
        );
        expect(await scope.textContent()).toContain("3 open");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "four questions without areas asking for tabs: one group, no tab strip",
      async () => {
        const run = await start(lifecycleScenario(flatTabsAsk, dist));
        const board = await openBoard(run, ["one", "two", "three", "four"]);
        expect(await board.view.getByRole("tablist").count()).toBe(0);
        for (const id of ["one", "two", "three", "four"]) {
          expect(await card(board, id).isVisible()).toBe(true);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: Question n of m, Previous and Next stop at the ends, Next open wraps, focus to the heading, no auto-advance",
      async () => {
        const run = await start(lifecycleScenario(onePerViewAsk, dist));
        const board = await openBoard(run, ["q1", "q2", "q3", "q4", "q5"]);
        const navigator = board.view.getByRole("navigation", { name: "Question navigator" });
        await navigator.getByText("Question 1 of 5", { exact: true }).waitFor();
        expect(await viewText(board, "First area").filter({ visible: true }).count()).toBe(1);
        const previous = navigator.getByRole("button", { name: "Previous", exact: true });
        const next = navigator.getByRole("button", { name: "Next", exact: true });
        const nextOpen = navigator.getByRole("button", { name: "Next open →" });
        expect(await previous.isDisabled()).toBe(true);
        await answerYes(board, "q1");
        // Answering does not advance.
        await navigator.getByText("Question 1 of 5", { exact: true }).waitFor();
        await next.click();
        await next.click();
        await answerYes(board, "q3");
        await next.click();
        await answerYes(board, "q4");
        await navigator.getByText("Question 4 of 5", { exact: true }).waitFor();
        expect(await viewText(board, "Second area").filter({ visible: true }).count()).toBe(1);
        await nextOpen.click();
        await navigator.getByText("Question 5 of 5", { exact: true }).waitFor();
        await eventually(() => isFocused(heading(board, "q5")), "focus on question 5's heading");
        expect(await next.isDisabled()).toBe(true);
        await nextOpen.click();
        await navigator.getByText("Question 2 of 5", { exact: true }).waitFor();
        await eventually(() => isFocused(heading(board, "q2")), "focus on question 2's heading");
        // Hidden questions stay mounted.
        expect(await card(board, "q5").count()).toBe(1);
        expect(await board.view.getByRole("navigation", { name: "Outline" }).count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the outline jumps into a hidden tab: the tab becomes active and the heading takes focus",
      async () => {
        const run = await start(lifecycleScenario(tabsAsk, dist));
        const board = await openBoard(run, ["region", "erp-export"]);
        expect(await card(board, "erp-export").isVisible()).toBe(false);
        const outline = board.view.getByRole("navigation", { name: "Outline" });
        await outline.getByRole("button", { name: /ERP/ }).click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "erp-export").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        const delivery = board.view.getByRole("tab", { name: /Delivery/ });
        expect(await delivery.getAttribute("aria-selected")).toBe("true");
        await eventually(() => isFocused(heading(board, "erp-export")), "focus on the heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an area the agent empties is hidden",
      async () => {
        const run = await start(lifecycleScenario(emptiedAsk, dist));
        const board = await openBoard(run, ["stays", "also", "goes"]);
        await board.view.getByRole("heading", { name: "Emptied" }).waitFor();
        await run.session.update([{ action: "delete", itemId: "goes" }]);
        await board.view
          .getByRole("heading", { name: "Emptied" })
          .waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await card(board, "goes").count()).toBe(0);
        expect(await board.view.locator("[data-askboard-area]").count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question asking for one per view and submitted delivery: the single-question board, Answer sends at once",
      async () => {
        const run = await start(lifecycleScenario(singleRequestingMoreAsk, dist));
        const board = await openBoard(run, ["database"]);
        expect(await board.view.getByRole("navigation").count()).toBe(0);
        expect(await board.view.getByRole("button", { name: "Submit" }).count()).toBe(0);
        expect(await board.view.getByText("Immediate").count()).toBe(0);
        expect(await board.header.getByText("open", { exact: false }).count()).toBe(0);
        await optionOf(board, "database", "SQLite").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "database").click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "database")
          .getByText("sent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(sentActs(run).map(({ acts }) => acts.map((act) => act.type))).toEqual([["answer"]]);
        await board.header.getByText("Answered", { exact: true }).waitFor();
      },
      TEST_TIMEOUT_MS,
    );
  });
}
