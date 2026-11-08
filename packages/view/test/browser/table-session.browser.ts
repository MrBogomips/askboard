// The Table on the real board page and the session process, in each engine (table-widget, task 7.1;
// design decision 17, first row; spec view-and-widgets: The Table's answer from the board, Cell
// entries block "Answer", An agent's change to a Table): the Table of roles asked, a rate lowered,
// a row added and filled and one deleted, answered and read through `collect` with its changes and
// derived values and through `fetch`; a cell entry blocking "Answer" across a reload; the agent's
// `update` with "Keep mine" (the answer names revision 1) and with "Reload"; a Table nested in a
// Group answered; a caption, a header and a text cell of 200 characters wrapped at 1,280 pixels
// (task 7.3); a misspelt column formula warned once in the `ask` result and shown once over the
// grid. Each real `collect` and `fetch` result passes its schema.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/table-session.browser.ts

import { describe, expect, test } from "bun:test";
import type { TableProps } from "@askboard/contract";
import { atomAsk } from "./fixtures/atom-documents.ts";
import {
  longWord,
  ROLES,
  rolesWith,
  tableAsk,
  tableItem,
  withFormula,
} from "./fixtures/table-documents.ts";
import { checkedEvents, checkedFetchItem } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  LOAD_TIMEOUT_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  cellOf,
  cellText,
  counterText,
  tableGridOf,
  toolOf,
  typeInCell,
} from "./harness/table-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');

const reloaded = (board: Board, run: Parameters<typeof reloadBoard>[1]) =>
  reloadBoard(board, run, () =>
    board.view
      .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
      .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS }),
  );

// What the latest draft mirror holds for the Table `costs`.
const lastRecord = (run: Parameters<typeof sentDrafts>[0]) =>
  sentDrafts(run).at(-1)?.questions.plan;
const draftHolds = (run: Parameters<typeof sentDrafts>[0]) => {
  const record = lastRecord(run);
  return {
    value: record?.values?.costs,
    entries: (record as { cellEntries?: Record<string, unknown> } | undefined)?.cellEntries?.costs,
  };
};

// The agent's change of the Table's row `dev`: its role only.
const engineerProps = (): TableProps =>
  rolesWith({
    rows: ROLES.rows.map((row) => (row.id === "dev" ? { ...row, role: "Engineer" } : row)),
  });

// The agent's change that drops the `rate` column, and the `amount` computed from it.
const withoutRate = (): TableProps =>
  rolesWith({
    columns: ROLES.columns.filter(({ field }) => field !== "rate" && field !== "amount"),
    rows: ROLES.rows.map(({ rate: _rate, ...row }) => row),
  });

const changeCosts = (props: TableProps) => [{ action: "change", itemId: "costs", props }];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Table on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a rate lowered, a row added and filled and one deleted are answered: collect returns the changes and the derived values, fetch the edited Table",
      async () => {
        const run = await start(lifecycleScenario(tableAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", "Rate, row 1", "960.00");
        await cellOf(table, "pm", "role").click();
        await toolOf(table, "Add row").click();
        await typeInCell(board, table, "u-1", "role", "Role, row 2", "QA");
        await typeInCell(board, table, "u-1", "days", "Days, row 2", "10");
        await typeInCell(board, table, "u-1", "rate", "Rate, row 2", "500");
        await cellOf(table, "dev", "role").click();
        await toolOf(table, "Delete row").click();
        await eventually(async () => (await counterText(table)) === "Your changes: 3", "3 changes");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan", rev: 1 });
        expect(events[0]?.changes).toEqual([
          { op: "set", target: "costs.pm.rate", value: "960.00" },
          {
            op: "add",
            target: "costs.u-1",
            after: "pm",
            value: { role: "QA", days: 10, rate: "500.00" },
          },
          { op: "remove", target: "costs.dev" },
        ]);
        expect(events[0]?.derived).toEqual({
          "costs.days": 28,
          "costs.amount": "22280.00",
          "costs.pm.amount": "17280.00",
          "costs.u-1.amount": "5000.00",
        });
        const item = checkedFetchItem(await run.session.fetch("costs"));
        expect(item).toMatchObject({ type: "table", id: "costs", questionId: "plan" });
        expect(item.state).toBe("answered");
        expect((item.props as TableProps).rows).toEqual([
          { id: "pm", role: "Project manager", days: 18, rate: "960.00" },
          { id: "u-1", role: "QA", days: 10, rate: "500.00" },
        ]);
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a cell entry blocks Answer across a reload, and correcting it releases Answer",
      async () => {
        const run = await start(lifecycleScenario(tableAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", "Rate, row 1", "960.00");
        await typeInCell(board, table, "dev", "days", "Days, row 2", "oops");
        await cellOf(table, "pm", "role").click();
        await eventually(() => draftHolds(run).entries !== undefined, "the entry mirrored");
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await reloaded(board, run);
        const again = tableGridOf(board);
        await eventually(
          async () => (await cellOf(again, "dev", "days").getAttribute("data-entry")) === "",
          "the entry back after the reload",
        );
        expect(await cellText(again, "dev", "days")).toBe("oops");
        expect(await cellText(again, "pm", "rate")).toBe("$960.00");
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await typeInCell(board, again, "dev", "days", "Days, row 2", "70");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent's update with Keep mine keeps the user's edit and the answer names revision 1",
      async () => {
        const run = await start(lifecycleScenario(tableAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", "Rate, row 1", "960.00");
        await eventually(() => draftHolds(run).value !== undefined, "the draft mirrored");
        await run.session.update(changeCosts(engineerProps()));
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board).getByRole("button", { name: "Keep mine" }).click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await cellText(table, "pm", "rate")).toBe("$960.00");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        const answer = events.find((event) => event.type === "answer");
        expect(answer).toMatchObject({ itemId: "plan", rev: 1 });
        expect(answer?.changes).toEqual([{ op: "set", target: "costs.pm.rate", value: "960.00" }]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent's update with Reload, losing my work shows the agent's rows and no change",
      async () => {
        const run = await start(lifecycleScenario(tableAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", "Rate, row 1", "960.00");
        await typeInCell(board, table, "dev", "days", "Days, row 2", "oops");
        await cellOf(table, "pm", "role").click();
        await eventually(() => draftHolds(run).entries !== undefined, "the draft mirrored");
        await run.session.update(changeCosts(engineerProps()));
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board).getByRole("button", { name: "Reload, losing my work" }).click();
        await eventually(
          async () => (await cellText(table, "dev", "role")) === "Engineer",
          "the agent's role",
        );
        expect(await cellText(table, "pm", "rate")).toBe("$1,040.00");
        expect(await table.frame.locator("[data-entry]").count()).toBe(0);
        expect(await counterText(table)).toBe("No changes");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after the agent drops the rate column and a reload, Keep mine shows the agent's Table, without the draft and its entries, and Answer sends nothing",
      async () => {
        const run = await start(lifecycleScenario(tableAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", "Rate, row 1", "960.00");
        await typeInCell(board, table, "dev", "days", "Days, row 2", "oops");
        await cellOf(table, "pm", "role").click();
        await eventually(() => draftHolds(run).entries !== undefined, "the draft mirrored");
        await run.session.update(changeCosts(withoutRate()));
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloaded(board, run);
        const again = tableGridOf(board);
        await notice(board).getByRole("button", { name: "Keep mine" }).click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await cellText(again, "pm", "days")).toBe("18");
        expect(await again.frame.locator("[data-entry]").count()).toBe(0);
        expect(await counterText(again)).toBe("No changes");
        await eventually(
          async () => draftHolds(run).value === undefined && draftHolds(run).entries === undefined,
          "the draft and its entries gone",
        );
        // The choice is the only event: nothing of the Table is answered.
        const { events } = await run.session.collect();
        expect(events.map((event) => event.type)).toEqual(["edit-choice"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Table nested in a Group is answered: collect returns its changes with the nested Table's own IDs",
      async () => {
        const group = {
          type: "group",
          id: "box",
          props: { title: "Box", items: [tableItem()] },
        };
        const run = await start(
          lifecycleScenario(atomAsk([group], { askId: "table-nest-n4q8" }), dist),
        );
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", "Rate, row 1", "960.00");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events[0]?.changes).toEqual([
          { op: "set", target: "costs.pm.rate", value: "960.00" },
        ]);
        const item = checkedFetchItem(await run.session.fetch("costs"));
        expect(item).toMatchObject({ type: "table", id: "costs", questionId: "plan" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a caption, a header and a text cell of 200 characters wrap inside the frame at 1,280 pixels with no horizontal scroll",
      async () => {
        const word = longWord(200);
        const props = {
          label: word,
          columns: [
            { field: "role", label: word, type: "text" },
            { field: "days", label: "Days", type: "number" },
          ],
          rows: [{ id: "a", role: word, days: 1 }],
        } as unknown as TableProps;
        const ask = tableAsk(props, { askId: "table-words-w5d3" });
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        await board.page.setViewportSize({ width: 1280, height: 800 });
        const table = tableGridOf(board);
        await table.grid.waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => {
          const fits = await table.frame.evaluate((frame) => {
            const box = frame.getBoundingClientRect();
            const wide = [...frame.querySelectorAll("caption, th, td")].filter(
              (element) => element.getBoundingClientRect().right > box.right + 1,
            );
            const page = frame.ownerDocument.documentElement;
            return { wide: wide.length, scrolls: page.scrollWidth > page.clientWidth };
          });
          return fits.wide === 0 && !fits.scrolls;
        }, "the 200-character words to wrap inside the frame");
        expect(await table.frame.locator("caption").textContent()).toContain(word);
        expect(await cellText(table, "a", "role")).toBe(word);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a misspelt column formula is warned once in the ask result and shown once over the grid",
      async () => {
        const run = await start(lifecycleScenario(tableAsk(withFormula("[@days] * [@rte]")), dist));
        const warnings = (run.session.askWarnings?.() ?? []).filter(
          (warning) => (warning as { code?: unknown }).code === "formula",
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
          code: "formula",
          itemId: "costs",
          address: "costs.*.amount",
          error: "missing-reference",
        });
        const board = await openBoard(run, ["plan"]);
        const table = tableGridOf(board);
        const problems = table.frame.locator("[data-table-problems] p");
        await problems.first().waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await problems.count()).toBe(1);
        expect(await problems.textContent()).toContain("Amount");
        expect(await table.frame.locator("[data-row-error]").count()).toBe(0);
        expect(await cellText(table, "pm", "amount")).toBe("—");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
