// An edit widget after a reload, on the real board page and the session process, in each engine
// (keep-mine-shown-revision, task 1.3; spec view-and-widgets: Edit widgets on a revision the board
// cannot show, What stays usable beside a read-only edit widget): the page reloaded while work made
// on revision 1 is held and the agent has changed the question to revision 2 shows the Kanban or
// the Tree read-only with a line, takes no move or edit of it, and "Keep mine" sends the answer
// naming revision 1 with the user's own work only, none of the agent's change counted as the
// user's; "Reload, losing my work" makes the widget editable on revision 2; a page that saw
// revision 1 never makes anything read-only.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/keep-mine-reload-session.browser.ts

import { describe, expect, test } from "bun:test";
import { release as releaseGantt } from "./fixtures/gantt-documents.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { kanbanAsk, kanbanItem } from "./fixtures/kanban-documents.ts";
import { planAsk } from "./fixtures/widget-asks.ts";
import { checkedEvents } from "./harness/approval-board.ts";
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
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import { beginDrag, cardOf, cardsIn, columnOf, dragOver, release } from "./harness/kanban-drag.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { pressIn, tabIntoTree, treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const LINE_START = "Read-only: your work";
const who = { type: "text-field", id: "who", props: { label: "Who" } };
const group = (...items: unknown[]) => ({
  type: "group",
  id: "box",
  props: { title: "Box", items },
});

// The question `plan` of the Kanban ask with a TextField beside the Kanban, or the Kanban in a Group.
const askWith = (items: readonly unknown[]) => ({
  ...kanbanAsk,
  items: [{ ...kanbanAsk.items[0], props: { ...kanbanAsk.items[0].props, items } }],
});
const plainAsk = () => askWith([who, kanbanItem()]);
const nestedAsk = () => askWith([who, group(kanbanItem())]);

// The agent's change: the text of card `a`.
const agentChange = (run: { session: { update(actions: readonly unknown[]): Promise<unknown> } }) =>
  run.session.update([
    {
      action: "change",
      itemId: "board",
      props: {
        ...kanbanItem().props,
        cards: kanbanItem().props.cards.map((each) =>
          each.id === "a" ? { ...each, label: "Fix login, again" } : each,
        ),
      },
    },
  ]);

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');
const line = (board: Board, id: string) => board.view.locator(`[data-askboard-read-only="${id}"]`);
const moveTo = (board: Board) =>
  board.view
    .getByRole("toolbar", { name: "Kanban tools" })
    .getByRole("button", { name: "Move to…", exact: true });
const button = (board: Board, name: string) =>
  notice(board).getByRole("button", { name, exact: true });

const loaded = (board: Board) =>
  board.view
    .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
    .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });

type Run = Parameters<typeof reloadBoard>[1];
const reloaded = (board: Board, run: Run) => reloadBoard(board, run, () => loaded(board));

const kanbanState = async (board: Board) => ({
  todo: await cardsIn(board, "todo"),
  doing: await cardsIn(board, "doing"),
  done: await cardsIn(board, "done"),
});
const UNMOVED = { todo: ["a", "c"], doing: [], done: ["b"] };

// Types in the TextField, changes the Kanban as the agent, reloads while the notice shows.
const workThenReload = async (
  run: Run & { session: Parameters<typeof agentChange>[0]["session"] },
) => {
  const board = await openBoard(run, ["plan"]);
  await board.view.getByLabel("Who", { exact: true }).fill("Ada");
  await eventually(
    () => sentDrafts(run).some((record) => draftHolds([record], "plan", "who", "Ada")),
    "the field mirrored to the board page",
  );
  await agentChange(run);
  await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
  await reloaded(board, run);
  await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
  return board;
};

// Tries to move card `a` by drag and card `c` by "Move to…", on a Kanban that takes neither.
const tryToMove = async (board: Board): Promise<void> => {
  await beginDrag(board, cardOf(board, "a"));
  await dragOver(board, columnOf(board, "doing"));
  await release(board);
  await cardOf(board, "c").click();
  await moveTo(board)
    .click({ force: true, timeout: STEP_TIMEOUT_MS })
    .catch(() => {});
  expect(await board.view.getByRole("menuitem", { name: "Done", exact: true }).count()).toBe(0);
  await board.page.keyboard.press("Escape");
};

const kanbanValues = (run: Run): readonly unknown[] =>
  sentDrafts(run).map((record) => record.questions.plan?.values?.board);

// The Tree's rename of `ux`, made on revision 1 and mirrored to the board page, and the agent's
// change of the plan: the tasks of `schedule`, which move its finish and critical path.
const NEW_NAME = "UX design, reviewed";
const renameUx = async (run: Run, board: Board): Promise<void> => {
  const [{ props }] = planAsk.items;
  const tree = treeGridOf(board);
  await tabIntoTree(board, props.text);
  await pressIn(board, "ArrowDown");
  await pressIn(board, "ArrowRight");
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(NEW_NAME);
  await pressIn(board, "Enter");
  await eventually(
    () => sentDrafts(run).some((record) => JSON.stringify(record).includes(NEW_NAME)),
    "the rename mirrored to the board page",
  );
};
const agentChangesSchedule = (run: Parameters<typeof agentChange>[0]) => {
  const [, plan] = planAsk.items[0].props.items;
  return run.session.update([
    {
      action: "change",
      itemId: "schedule",
      props: { tasks: { ...plan.props.tasks, prototype: { dependencies: [] } } },
    },
  ]);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an edit widget after a reload, on the session process`, () => {
    const { start } = useEngine(engine);

    for (const [name, ask] of [
      ["the Kanban", plainAsk],
      ["the Kanban in a Group", nestedAsk],
    ] as const) {
      test(
        `${name} is read-only with the line after the reload, takes no move, and Keep mine sends the TextField's result alone, naming revision 1`,
        async () => {
          const run = await start(lifecycleScenario(ask(), dist));
          const board = await workThenReload(run);
          await line(board, "board").waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await line(board, "board").textContent()).toContain(LINE_START);
          expect(await line(board, "who").count()).toBe(0);
          expect(await board.view.getByLabel("Who", { exact: true }).inputValue()).toBe("Ada");
          await tryToMove(board);
          expect(await kanbanState(board)).toEqual(UNMOVED);
          expect(kanbanValues(run).every((value) => value === undefined)).toBe(true);

          await button(board, "Keep mine").click();
          await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
          // The line stays while the page cannot show the revision the work was made on.
          expect(await line(board, "board").count()).toBe(1);
          await tryToMove(board);
          expect(await kanbanState(board)).toEqual(UNMOVED);
          await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
          await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
          await actsDone(run, 2);
          const events = checkedEvents(await run.session.collectJson());
          expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
            "edit-choice:2",
            "answer:1",
          ]);
          expect(events[0]).toMatchObject({ edit: "ignore", keptRev: 1 });
          expect(events[1]?.results).toEqual({ who: "Ada" });
          expect(events[1]?.changes ?? []).toEqual([]);
          expectNoCspProblem(run);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "Reload, losing my work: the line goes, a move is taken, and the answer names revision 2 with that move only",
      async () => {
        const run = await start(lifecycleScenario(plainAsk(), dist));
        const board = await workThenReload(run);
        await line(board, "board").waitFor({ timeout: STEP_TIMEOUT_MS });
        await button(board, "Reload, losing my work").click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await line(board, "board").count()) === 0, "the line to go");
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await eventually(
          async () => (await cardsIn(board, "doing")).join() === "a",
          "a to show in doing",
        );
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        const answer = events.find((event) => event.type === "answer");
        expect(answer).toMatchObject({ rev: 2 });
        expect(answer?.results).toBeUndefined();
        expect(answer?.changes).toEqual([{ op: "set", target: "board.a.column", value: "doing" }]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Tree edited on revision 1 and shown after the reload: read-only with the line, its edit kept, and the answer at revision 1 carries that edit and no derived value",
      async () => {
        const [{ props }] = planAsk.items;
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        const tree = treeGridOf(board);
        await renameUx(run, board);
        await agentChangesSchedule(run);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloaded(board, run);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await button(board, "Keep mine").click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await line(board, "wbs").waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => ((await tree.cell("ux", 0).textContent()) ?? "").includes(NEW_NAME),
          "the Tree to show the edit it held",
        );
        // No further edit is taken: the cell editor does not open and the name stays.
        await tabIntoTree(board, props.text);
        await pressIn(board, "ArrowDown");
        await pressIn(board, "ArrowRight");
        await board.page.keyboard.press("F2");
        await board.page.keyboard.type("Another name");
        await pressIn(board, "Enter");
        expect(await tree.editor.count()).toBe(0);
        expect((await tree.cell("ux", 0).textContent()) ?? "").toContain(NEW_NAME);
        expect((await tree.cell("ux", 0).textContent()) ?? "").not.toContain("Another name");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.changes).toEqual([
          { op: "set", target: "wbs.ux.label", value: NEW_NAME },
        ]);
        // The board computes derived values on the current revision only (design decision 7).
        expect(Object.hasOwn(events[1] ?? {}, "derived")).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "without a reload the page that saw revision 1 shows it: Keep mine, a move is taken and no line shows",
      async () => {
        const run = await start(lifecycleScenario(plainAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Who", { exact: true }).fill("Ada");
        await eventually(
          () => sentDrafts(run).some((record) => draftHolds([record], "plan", "who", "Ada")),
          "the field mirrored to the board page",
        );
        await agentChange(run);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await line(board, "board").count()).toBe(0);
        await button(board, "Keep mine").click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await line(board, "board").count()).toBe(0);
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await eventually(
          async () => (await cardsIn(board, "doing")).join() === "a",
          "a to show in doing",
        );
        expect(await line(board, "board").count()).toBe(0);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        const answer = events.find((event) => event.type === "answer");
        expect(answer).toMatchObject({ rev: 1 });
        expect(answer?.changes).toEqual([{ op: "set", target: "board.a.column", value: "doing" }]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Gantt the agent added after the reload: Keep mine, and the TextField's answer at revision 1 is taken, carrying no derived value",
      async () => {
        const run = await start(lifecycleScenario(plainAsk(), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Who", { exact: true }).fill("Ada");
        await eventually(
          () => sentDrafts(run).some((record) => draftHolds([record], "plan", "who", "Ada")),
          "the field mirrored to the board page",
        );
        await run.session.update([
          {
            action: "change",
            itemId: "plan",
            props: {
              ...kanbanAsk.items[0].props,
              items: [who, kanbanItem(), { ...releaseGantt, id: "sched" }],
            },
          },
        ]);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloaded(board, run);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        // The added Gantt is on the page and reports its derived values for the current revision.
        await ganttOf(board, "sched").grid.waitFor({ timeout: STEP_TIMEOUT_MS });
        await button(board, "Keep mine").click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.results).toEqual({ who: "Ada" });
        expect(Object.hasOwn(events[1] ?? {}, "derived")).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "without a reload, Keep mine on the Tree's rename sends it at revision 1 with no derived value of the agent's schedule",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await renameUx(run, board);
        await agentChangesSchedule(run);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await button(board, "Keep mine").click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.changes).toEqual([
          { op: "set", target: "wbs.ux.label", value: NEW_NAME },
        ]);
        expect(Object.hasOwn(events[1] ?? {}, "derived")).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
