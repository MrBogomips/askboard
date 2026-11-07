// LaTeX, Kanban and Timeline on the real board page, by the session process, in each engine
// (latex-kanban-timeline, tasks 6.1 and 6.2; spec view-and-widgets: LaTeX, Kanban and Timeline end
// to end; design decision 14): a LaTeX corrected through a parse error is answered, and `collect`
// returns one `set` of its expression and `fetch` the item; a Kanban card dragged and another moved
// with "Move to…" survive a reload of the tab with the leave-page prompt armed and are answered and
// collected as two `set`s. Each real `collect` and `fetch` result passes its schema, the fetched
// item inside the `questionId` wrapper `core` gives it.

import { describe, expect, test } from "bun:test";
import { kanbanAsk, kanbanItem } from "./fixtures/kanban-documents.ts";
import { latexAsk } from "./fixtures/latex-documents.ts";
import { timelineAsk } from "./fixtures/timeline-documents.ts";
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
import { beginDrag, cardOf, cardsIn, columnOf, dragOver, release } from "./harness/kanban-drag.ts";
import {
  actsDone,
  answerOf,
  lifecycleScenario,
  openBoard,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  dragEntry,
  entryOf,
  laneMiddle,
  PER_DAY,
  release as releaseEntry,
  zoomOf,
} from "./harness/timeline-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const source = (board: Board) => board.view.locator("[data-latex-source]");
const preview = (board: Board) => board.view.locator("[data-latex-preview]");
const fieldError = (board: Board) => board.view.locator("[data-latex] [data-latex-error]");
const moveTo = (board: Board) =>
  board.view
    .getByRole("toolbar", { name: "Kanban tools" })
    .getByRole("button", { name: "Move to…", exact: true });

const reloaded = (board: Board, run: Parameters<typeof reloadBoard>[1]) =>
  reloadBoard(board, run, () =>
    board.view
      .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
      .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS }),
  );

const heldCards = async (board: Board) => ({
  todo: await cardsIn(board, "todo"),
  doing: await cardsIn(board, "doing"),
  done: await cardsIn(board, "done"),
});

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: LaTeX, Kanban and Timeline end to end on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a LaTeX corrected through a parse error is answered: collect returns one set of expression and fetch the item",
      async () => {
        const run = await start(lifecycleScenario(latexAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await source(board).fill("\\frac{1}{");
        await eventually(
          async () =>
            ((await fieldError(board).textContent()) ?? "").startsWith(
              "This expression does not render: KaTeX parse error",
            ),
          "the parse error in the field",
        );
        // The error does not stand in the way: the corrected expression draws and clears it.
        await source(board).fill("a^2+b^2=c^2");
        await eventually(
          async () => (await fieldError(board).count()) === 0,
          "the field error to clear",
        );
        await eventually(
          async () => (await preview(board).locator(".katex").count()) === 1,
          "the preview to draw",
        );
        await eventually(
          () =>
            sentDrafts(run).some(
              (record) =>
                (record.questions.plan?.values?.formula as { expression?: string } | undefined)
                  ?.expression === "a^2+b^2=c^2",
            ),
          "the draft to hold the corrected expression",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan", rev: 1 });
        expect(events[0]?.changes).toEqual([
          { op: "set", target: "formula.expression", value: "a^2+b^2=c^2" },
        ]);
        const item = checkedFetchItem(await run.session.fetch("formula"));
        expect(item).toMatchObject({
          type: "latex",
          id: "formula",
          questionId: "plan",
          state: "answered",
          props: { expression: "a^2+b^2=c^2" },
        });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Kanban card dragged and another moved with Move to…, the tab reloaded: both show with the prompt armed, and Answer sends and collect returns the two sets",
      async () => {
        const run = await start(lifecycleScenario(kanbanAsk, dist));
        const board = await openBoard(run, ["plan"]);
        expect(await promptArmed(board)).toBe(false);
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await eventually(
          async () => (await cardsIn(board, "doing")).join() === "a",
          "a to show in doing",
        );
        await cardOf(board, "c").click();
        await eventually(
          async () => (await moveTo(board).getAttribute("aria-disabled")) === null,
          "Move to… to turn on",
        );
        await moveTo(board).click();
        await board.view.getByRole("menuitem", { name: "Done", exact: true }).click();
        await eventually(
          async () => (await cardsIn(board, "done")).join() === "b,c",
          "c to show in done",
        );
        await eventually(
          () =>
            sentDrafts(run).some((record) => {
              const held = record.questions.plan?.values?.board as
                | { cards?: { id: string; column: string }[] }
                | undefined;
              const column = (id: string) => held?.cards?.find((card) => card.id === id)?.column;
              return column("a") === "doing" && column("c") === "done";
            }),
          "the draft to hold both moves",
        );
        await eventually(() => promptArmed(board), "the prompt to be armed");

        await reloaded(board, run);
        await eventually(
          async () => (await cardsIn(board, "doing")).join() === "a",
          "a in doing again",
        );
        expect(await heldCards(board)).toEqual({ todo: [], doing: ["a"], done: ["b", "c"] });
        expect(await cardOf(board, "a").getAttribute("data-change")).toBe("moved");
        expect(await cardOf(board, "c").getAttribute("data-change")).toBe("moved");
        expect(await cardOf(board, "b").getAttribute("data-change")).toBeNull();
        await eventually(() => promptArmed(board), "the prompt to be armed after the reload");
        expect(await answerOf(board, "plan").isEnabled()).toBe(true);
        expect(sentActs(run)).toEqual([]);

        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        const changes = (events[0]?.changes ?? []) as readonly {
          op: string;
          target: string;
          value: unknown;
        }[];
        expect([...changes].sort((x, y) => x.target.localeCompare(y.target))).toEqual([
          { op: "set", target: "board.a.column", value: "doing" },
          { op: "set", target: "board.c.column", value: "done" },
        ]);
        const item = checkedFetchItem(await run.session.fetch("board"));
        expect(item).toMatchObject({ type: "kanban", id: "board", questionId: "plan" });
        const cards = (item.props as { cards: { id: string; column: string }[] }).cards;
        expect(cards.map((card) => [card.id, card.column])).toEqual([
          ["a", "doing"],
          ["b", "done"],
          ["c", "done"],
        ]);
        expect(kanbanItem().props.cards.map((card) => card.id)).toEqual(["a", "b", "c"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Timeline range dragged across a lane and a milestone moved from the keyboard, answered: collect returns the four sets and fetch the entries",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        const zoom = await zoomOf(board);
        await dragEntry(board, "checkout", {
          dx: 7 * PER_DAY[zoom],
          y: await laneMiddle(board, "mobile"),
        });
        await releaseEntry(board);
        await eventually(
          async () => (await entryOf(board, "checkout").getAttribute("data-lane")) === "mobile",
          "checkout to show in mobile",
        );
        await entryOf(board, "launch").focus();
        await board.page.keyboard.press("ArrowDown");
        await board.view
          .getByRole("toolbar", { name: "Timeline tools" })
          .getByRole("button", { name: "Move later", exact: true })
          .click();
        await eventually(
          async () => (await entryOf(board, "launch").getAttribute("data-date")) === "2026-02-09",
          "launch a week later",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        const changes = (events[0]?.changes ?? []) as readonly {
          op: string;
          target: string;
          value: unknown;
        }[];
        expect([...changes].sort((x, y) => x.target.localeCompare(y.target))).toEqual([
          { op: "set", target: "roadmap.checkout.end", value: "2026-01-16" },
          { op: "set", target: "roadmap.checkout.lane", value: "mobile" },
          { op: "set", target: "roadmap.checkout.start", value: "2026-01-12" },
          { op: "set", target: "roadmap.launch.date", value: "2026-02-09" },
        ]);
        const item = checkedFetchItem(await run.session.fetch("roadmap"));
        expect(item).toMatchObject({ type: "timeline", id: "roadmap", questionId: "plan" });
        const entries = (item.props as { entries: Record<string, unknown>[] }).entries;
        expect(entries).toEqual([
          expect.objectContaining({
            id: "checkout",
            lane: "mobile",
            start: "2026-01-12",
            end: "2026-01-16",
          }),
          expect.objectContaining({ id: "launch", lane: "mobile", date: "2026-02-09" }),
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
