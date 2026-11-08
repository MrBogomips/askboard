// Layouts on the real board page and the session process, in each engine (layouts, task 4.1;
// view-and-widgets spec: Layouts end to end; core spec: Answers of nested items, Fetching nested
// items and layouts): an arranged question answered across tabs with `collect` returning one answer
// whose `results` hold each nested field's ID, an entry in a hidden tab blocking "Answer" across a
// reload, an agent `update` of a nested NumberField's bound showing the agent-change notice and
// keeping the other fields' draft, and `fetch` of the Group and of the Tree nested in it.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/layouts-session.browser.ts

import { describe, expect, test } from "bun:test";
import { atomAsk } from "./fixtures/atom-documents.ts";
import { planAsk } from "./fixtures/widget-asks.ts";
import { checkedEvents, checkedFetchItem } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { pressIn, treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const [{ props: planProps }] = planAsk.items;
const [WBS] = planProps.items;
const NEW_NAME = "UX design, reviewed";

const who = { type: "text-field", id: "who", props: { label: "Who" } };
const days = { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 20 } };
const panel = (id: string, title: string, ...items: unknown[]) => ({ id, title, items });
// Two tabs: People holds a field; Effort holds a Group with a NumberField and the WBS Tree.
const ARRANGED = {
  type: "tabs",
  id: "sections",
  props: {
    tabs: [
      panel("people", "People", who),
      panel("effort", "Effort", {
        type: "group",
        id: "load",
        props: { title: "Load", items: [days, WBS] },
      }),
    ],
  },
};
const renamedTree = {
  ...WBS.props,
  nodes: WBS.props.nodes.map((node, at) => (at === 0 ? { ...node, label: "Renamed" } : node)),
};
const ask = () => atomAsk([ARRANGED]);

const tab = (board: Board, name: string | RegExp) => board.view.getByRole("tab", { name });
const daysField = (board: Board) => board.view.getByLabel("Days", { exact: true });
const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');

// Renames the Tree's `ux` node with the keyboard alone, from the tab already selected.
const renameUx = async (board: Board): Promise<void> => {
  const tree = treeGridOf(board);
  await tree.grid.locator('[tabindex="0"]').focus();
  await pressIn(board, "ArrowDown");
  await pressIn(board, "ArrowRight");
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(NEW_NAME);
  await pressIn(board, "Enter");
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: layouts on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the arranged question is answered across tabs: collect returns one answer whose results hold each nested field's ID, and fetch returns the Group and the nested Tree as the user left them",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Who", { exact: true }).fill("Ada");
        await tab(board, "Effort").click();
        await daysField(board).fill("5");
        await renameUx(board);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan" });
        expect(events[0]?.results).toEqual({ who: "Ada", days: 5 });
        expect(events[0]?.results).not.toHaveProperty("sections");
        expect(events[0]?.results).not.toHaveProperty("load");

        const tree = checkedFetchItem(await run.session.fetch("wbs"));
        expect(tree).toMatchObject({ type: "tree", id: "wbs", questionId: "plan" });
        expect(tree.state).toBe("answered");
        expect(JSON.stringify(tree)).toContain(NEW_NAME);
        const group = checkedFetchItem(await run.session.fetch("load"));
        expect(group).toMatchObject({ type: "group", id: "load", questionId: "plan" });
        expect(group.state).toBe("answered");
        const inside = JSON.stringify(group);
        expect(inside).toContain(NEW_NAME);
        expect(inside).toContain('"days"');
        expect(inside).toContain("Load");
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an entry in a hidden tab blocks Answer across a reload, marks its tab, and correcting it enables Answer",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Who", { exact: true }).fill("Ada");
        await tab(board, "Effort").click();
        await daysField(board).fill("abc");
        await daysField(board).blur();
        await tab(board, "People").click();
        await eventually(
          () => sentDrafts(run).some((record) => JSON.stringify(record).includes('"days":"abc"')),
          "the entry mirrored to the board page",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await reloadBoard(board, run, () =>
          tab(board, /People/).waitFor({ timeout: STEP_TIMEOUT_MS }),
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await eventually(
          async () => (await tab(board, "Effort needs a correction").count()) === 1,
          "the mark back after the reload",
        );
        await tab(board, "Effort needs a correction").click();
        await eventually(async () => (await daysField(board).inputValue()) === "abc", "restored");
        await daysField(board).fill("2");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an update changing a nested NumberField's bound shows the agent-change notice and keeps the other fields' draft",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Who", { exact: true }).fill("Ada");
        await eventually(
          () => sentDrafts(run).some((record) => draftHolds([record], "plan", "who", "Ada")),
          "the field mirrored to the board page",
        );
        await run.session.update([
          { action: "change", itemId: "days", props: { label: "Days", min: 0, max: 10 } },
          { action: "change", itemId: "wbs", props: renamedTree },
        ]);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board).getByRole("button", { name: "Show the agent's change" }).click();
        // The notice names the nested Tree the agent changed, and no field it did not.
        const line = notice(board).locator('[data-askboard-widget="wbs"]');
        await line.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await line.textContent()).toContain("wbs");
        expect(await notice(board).locator('[data-askboard-widget="who"]').count()).toBe(0);
        await notice(board).getByRole("button", { name: "Keep mine" }).click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await board.view.getByLabel("Who", { exact: true }).inputValue()).toBe("Ada");
        await tab(board, "Effort").click();
        await daysField(board).fill("5");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        const answer = events.find((event) => event.type === "answer");
        expect(answer?.results).toEqual({ who: "Ada", days: 5 });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
