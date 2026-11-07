// The Kanban, in each engine, on the widget host and, for the answer and read-only scenarios, on
// the session process (latex-kanban-timeline, task 5.2; spec view-and-widgets: Kanban columns and
// cards, Kanban moves by drag, Kanban at the keyboard, LaTeX, Kanban and Timeline read-only, LaTeX,
// Kanban and Timeline strings): the columns show their cards and counts in the agent's order; a
// real mouse drag of a card onto another column shows the drop indicator and puts the whole props
// into the draft, with the change highlight, and a drag back clears it; Escape cancels; a drop
// from a Tree in the same question is refused; "Move to…" moves the current card from the keyboard
// and keeps it current; with no current card it is disabled and keeps the focus; an answered Kanban
// is read-only; an Italian board shows it in Italian. No Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import {
  draftProps,
  kanbanAsk,
  kanbanDocument,
  kanbanItem,
  MOVED_A,
  treeAndKanbanDocument,
} from "./fixtures/kanban-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  beginDrag,
  cardOf,
  cardsIn,
  columnOf,
  dragOver,
  expectDrop,
  release,
} from "./harness/kanban-drag.ts";
import {
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const counter = (board: Board) => board.view.locator("[data-kanban-counter]");
const moveTo = (board: Board) =>
  board.view
    .getByRole("toolbar", { name: /Kanban tools|Strumenti del Kanban/ })
    .getByRole("button", { name: /^(Move to…|Sposta in…)$/ });

const counterText = async (board: Board): Promise<string> =>
  ((await counter(board).textContent()) ?? "").trim();

const expectCards = (board: Board, column: string, cards: readonly string[]): Promise<void> =>
  eventually(
    async () => JSON.stringify(await cardsIn(board, column)) === JSON.stringify(cards),
    `${column} to hold ${cards.join(", ") || "no card"}`,
  );

// Waits until the latest draft mirror holds `props` for the Kanban, or none.
const draftIs = (run: WidgetHostRun, props: unknown, what: string): Promise<void> =>
  eventually(() => Bun.deepEquals(draftProps(run), props, true), what);

const countOf = async (board: Board, column: string): Promise<string> =>
  ((await columnOf(board, column).locator("[data-kanban-count]").textContent()) ?? "").trim();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Kanban`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "untouched, it shows its columns with their counts and cards in the agent's order, no change, no draft and Answer disabled",
      async () => {
        const run = await host(dist, kanbanDocument());
        await readyIn(run);
        const { board } = run;
        expect(
          await board.view
            .locator("[data-kanban-column]")
            .evaluateAll((all) => all.map((column) => column.getAttribute("data-kanban-column"))),
        ).toEqual(["todo", "doing", "done"]);
        expect(await cardsIn(board, "todo")).toEqual(["a", "c"]);
        expect(await cardsIn(board, "doing")).toEqual([]);
        expect(await cardsIn(board, "done")).toEqual(["b"]);
        expect([
          await countOf(board, "todo"),
          await countOf(board, "doing"),
          await countOf(board, "done"),
        ]).toEqual(["2", "0", "1"]);
        // The label and the description of a card, and its name with its column.
        expect(await cardOf(board, "a").textContent()).toContain("Fix login");
        expect(await cardOf(board, "a").textContent()).toContain("The redirect loops");
        expect(await board.view.getByRole("option", { name: "Fix login, in To do" }).count()).toBe(
          1,
        );
        expect(await board.view.getByRole("group", { name: "To do, 2 cards" }).count()).toBe(1);
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await counterText(board)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.drafts).toEqual([]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a drag of a card onto another column shows the indicator there, then the card shows in it with the change highlight and the draft holds the props; a drag back clears both",
      async () => {
        const run = await host(dist, kanbanDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await expectDrop(board, "doing", "into");
        expect(await columnOf(board, "todo").getAttribute("data-drop")).toBeNull();
        await release(board);
        await expectCards(board, "doing", ["a"]);
        await expectCards(board, "todo", ["c"]);
        await expectDrop(board, "doing", null);
        expect(await cardOf(board, "a").getAttribute("data-change")).toBe("moved");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(1);
        await draftIs(run, MOVED_A, "the draft to hold the props with a in doing");
        expect(await counterText(board)).toBe("Your changes: 1 moved");
        expect(await board.answer.isEnabled()).toBe(true);
        expect([await countOf(board, "todo"), await countOf(board, "doing")]).toEqual(["1", "1"]);

        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "todo"));
        await expectDrop(board, "todo", "into");
        await release(board);
        await expectCards(board, "todo", ["a", "c"]);
        await draftIs(run, undefined, "the draft to hold no value");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await counterText(board)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a card dropped on its own column moves nothing, and Escape during a drag moves nothing and leaves no draft",
      async () => {
        const run = await host(dist, kanbanDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "todo"));
        expect(await columnOf(board, "todo").getAttribute("data-drop")).toBeNull();
        await release(board);
        await Bun.sleep(QUIET_MS / 3);
        expect(await cardsIn(board, "todo")).toEqual(["a", "c"]);

        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await expectDrop(board, "doing", "into");
        await board.page.keyboard.press("Escape");
        await release(board);
        await eventually(
          async () => (await cardOf(board, "a").getAttribute("data-dragging")) === null,
          "the drag to end",
        );
        expect(await cardsIn(board, "todo")).toEqual(["a", "c"]);
        expect(await cardsIn(board, "doing")).toEqual([]);
        expect(await counterText(board)).toBe("No changes");
        expect(run.drafts).toEqual([]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a row dragged from a Tree in the same question is not taken by a column",
      async () => {
        const run = await host(dist, treeAndKanbanDocument);
        await readyIn(run);
        const { board } = run;
        const grip = board.view.locator('[data-node-id="portal"] [data-drag-handle]');
        await beginDrag(board, grip);
        await dragOver(board, columnOf(board, "doing"));
        await Bun.sleep(QUIET_MS / 3);
        expect(await columnOf(board, "doing").getAttribute("data-drop")).toBeNull();
        await release(board);
        expect(await cardsIn(board, "doing")).toEqual([]);
        expect(await counterText(board)).toBe("No changes");
        expect(draftProps(run)).toBeUndefined();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "from the keyboard the arrow keys make a card current, and Move to… moves it, leaving it current, with the counter reading 1 moved",
      async () => {
        const run = await host(dist, kanbanDocument());
        await readyIn(run);
        const { board } = run;
        const current = (id: string) => cardOf(board, id).getAttribute("aria-current");
        // The cards are one Tab stop: the first card, until one is current.
        expect(await board.view.locator('[data-kanban-card][tabindex="0"]').count()).toBe(1);
        expect(await cardOf(board, "a").getAttribute("tabindex")).toBe("0");
        await cardOf(board, "a").focus();
        await board.page.keyboard.press("ArrowDown");
        await eventually(async () => (await current("c")) === "true", "c to be current");
        await board.page.keyboard.press("ArrowRight");
        await eventually(async () => (await current("b")) === "true", "b to be current");
        await board.page.keyboard.press("ArrowLeft");
        await eventually(async () => (await current("a")) === "true", "a to be current");
        await board.page.keyboard.press("ArrowDown");
        await eventually(async () => (await current("c")) === "true", "c to be current again");
        expect(await board.view.locator('[data-kanban-card][tabindex="0"]').count()).toBe(1);
        // Shift+Tab from the cards lands on the toolbar's stop, "Move to…".
        await board.page.keyboard.press("Shift+Tab");
        await eventually(() => isFocused(moveTo(board)), "focus on Move to…");
        await board.page.keyboard.press("Enter");
        const doing = board.view.getByRole("menuitem", { name: "Doing", exact: true });
        const done = board.view.getByRole("menuitem", { name: "Done", exact: true });
        await done.waitFor({ timeout: STEP_TIMEOUT_MS });
        // The menu lists the other columns only.
        expect(await board.view.getByRole("menuitem", { name: "To do", exact: true }).count()).toBe(
          0,
        );
        expect(await doing.count()).toBe(1);
        await board.page.keyboard.press("ArrowDown");
        await board.page.keyboard.press("ArrowDown");
        await board.page.keyboard.press("Enter");
        await expectCards(board, "done", ["b", "c"]);
        await expectCards(board, "todo", ["a"]);
        await draftIs(
          run,
          {
            ...kanbanItem().props,
            cards: kanbanItem().props.cards.map((card) =>
              card.id === "c" ? { ...card, column: "done" } : card,
            ),
          },
          "the draft to hold the props with c in done",
        );
        expect(await current("c")).toBe("true");
        expect(await counterText(board)).toBe("Your changes: 1 moved");
        expect(await cardOf(board, "c").getAttribute("data-change")).toBe("moved");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with no card current Move to… is disabled and keeps the focus, and Enter on it opens nothing",
      async () => {
        const run = await host(dist, kanbanDocument());
        await readyIn(run);
        const { board } = run;
        expect(await moveTo(board).getAttribute("aria-disabled")).toBe("true");
        expect(await board.view.locator('[aria-current="true"]').count()).toBe(0);
        await moveTo(board).focus();
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.press("ArrowDown");
        await Bun.sleep(QUIET_MS / 3);
        expect(await board.view.getByRole("menu").count()).toBe(0);
        expect(await isFocused(moveTo(board))).toBe(true);
        expect(run.drafts).toEqual([]);
        // A click makes a card current and the tool acts.
        await cardOf(board, "b").click();
        await eventually(
          async () => (await moveTo(board).getAttribute("aria-disabled")) === null,
          "Move to… to turn on",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board shows the tool, the counter, the names and the counts in Italian",
      async () => {
        const run = await host(dist, kanbanDocument("it-IT"));
        await readyIn(run);
        const { board } = run;
        expect(await moveTo(board).count()).toBe(1);
        expect(await moveTo(board).textContent()).toBe("Sposta in…");
        expect(await counterText(board)).toBe("Nessuna modifica");
        expect(
          await board.view.getByRole("option", { name: "Fix login, in Da fare" }).count(),
        ).toBe(1);
        expect(await board.view.getByRole("group", { name: "Da fare, 2 schede" }).count()).toBe(1);
        expect(await board.view.getByRole("group", { name: "Fatto, 1 scheda" }).count()).toBe(1);
        await cardOf(board, "a").click();
        await moveTo(board).click();
        await board.view.getByRole("menuitem", { name: "In corso", exact: true }).click();
        await eventually(
          async () => (await counterText(board)) === "Le tue modifiche: 1 spostata",
          "the Italian counter",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Kanban after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "a moved card is sent as one answer and collected as one set; once the ask closes the cards are read-only and a drag or a key sends nothing",
      async () => {
        const run = await start(lifecycleScenario(kanbanAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await expectCards(board, "doing", ["a"]);
        await eventually(
          () =>
            sentDrafts(run).some((record) => record.questions.plan?.values?.board !== undefined),
          "the draft to hold the value",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.changes).toEqual([
          { op: "set", target: "board.a.column", value: "doing" },
        ]);
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        // Delivered, the question is answered and still open to a revision: cards drag.
        expect(await cardOf(board, "a").getAttribute("draggable")).toBe("true");
        expect(await cardOf(board, "a").getAttribute("data-change")).toBe("moved");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await cardOf(board, "a").getAttribute("draggable")) === null,
          "the cards to stop dragging",
        );
        expect(await moveTo(board).getAttribute("aria-disabled")).toBe("true");
        expect(await cardOf(board, "a").getAttribute("data-change")).toBe("moved");
        const [drafts, acts] = [sentDrafts(run).length, sentActs(run).length];
        await beginDrag(board, cardOf(board, "c"));
        await dragOver(board, columnOf(board, "done"));
        await release(board);
        await moveTo(board).click({ force: true });
        await cardOf(board, "c").focus();
        await board.page.keyboard.press("ArrowDown");
        await board.page.keyboard.press("Enter");
        await Bun.sleep(QUIET_MS);
        expect(await cardsIn(board, "doing")).toEqual(["a"]);
        expect(await cardsIn(board, "todo")).toEqual(["c"]);
        expect(await cardsIn(board, "done")).toEqual(["b"]);
        expect([sentDrafts(run).length, sentActs(run).length]).toEqual([drafts, acts]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
