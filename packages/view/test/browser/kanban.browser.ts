// The Kanban, in each engine, on the widget host and, for the answer and read-only scenarios, on
// the session process (latex-kanban-timeline, task 5.2; spec view-and-widgets: Kanban columns and
// cards, Kanban moves by drag, Kanban at the keyboard, LaTeX, Kanban and Timeline read-only, LaTeX,
// Kanban and Timeline strings): the columns show their cards and counts in the agent's order; a
// real mouse drag of a card onto another column shows the drop indicator and puts the whole props
// into the draft, with the change highlight, and a drag back clears it; Escape cancels; a drop
// from a Tree in the same question is refused; "Move to…" moves the current card from the keyboard
// and keeps it current; with no current card it is disabled and keeps the focus; an answered Kanban
// is read-only; an Italian board shows it in Italian. No Content Security Policy violation occurs.
// The order within a column (kanban-order, task 3.4; spec view-and-widgets: Kanban moves by drag,
// Kanban at the keyboard, Kanban columns and cards): a drag drops the card at the place under the
// pointer, in its own column or another, with a line where it would land and none where it changes
// nothing; Alt+Shift with Up, Down, Home and End and Ctrl or Cmd with Shift and Up and Down move
// the current card and keep the focus, other holds do nothing, and a bound key at an edge is
// prevented; the four tools act from the keyboard and turn off at the edges; each card gives its
// place in its column.

import { describe, expect, test } from "bun:test";
import {
  draftProps,
  kanbanAsk,
  kanbanDocument,
  kanbanItem,
  MOVED_A,
  orderDocument,
  orderItem,
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
  dragOverCard,
  expectDrop,
  expectLine,
  lineCount,
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

const tool = (board: Board, name: string) =>
  board.view
    .getByRole("toolbar", { name: /Kanban tools|Strumenti del Kanban/ })
    .getByRole("button", { name, exact: true });

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

        // Back above `c`, where the agent put it: nothing is left to send.
        await beginDrag(board, cardOf(board, "a"));
        await dragOverCard(board, cardOf(board, "c"), "upper");
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
        // Over its own place: the pointer on `a`, above the middle of `c`.
        await beginDrag(board, cardOf(board, "a"));
        await dragOverCard(board, cardOf(board, "c"), "upper");
        expect(await columnOf(board, "todo").getAttribute("data-drop")).toBeNull();
        expect(await lineCount(board)).toBe(0);
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
        // Shift+Tab from the cards lands on the toolbar's stop, its first tool that can act: "c"
        // is the last of its column, so "Move up"; the arrow keys then reach "Move to…".
        await board.page.keyboard.press("Shift+Tab");
        await eventually(() => isFocused(tool(board, "Move up")), "focus on Move up");
        await board.page.keyboard.press("End");
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
        const names = await board.view
          .getByRole("toolbar", { name: "Strumenti del Kanban" })
          .getByRole("button")
          .allTextContents();
        expect(names).toEqual(["Sposta su", "Sposta giù", "In cima", "In fondo", "Sposta in…"]);
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

  describe(`${engine}: the Kanban's order`, () => {
    const { host } = useWidgetHost(engine);

    // The cards `a`, `c`, `d` in `todo` and `b` in `done`, as the order document sends them.
    const cardsOf = (...ids: string[]) => {
      const all = orderItem().props.cards;
      return ids.map((id) => all.find((card) => card.id === id));
    };
    const spy = (board: Board) =>
      board.view.locator("[data-kanban]").evaluate((element) => {
        const frame = element.ownerDocument.defaultView as unknown as {
          pressed: [string, boolean][];
        } & Window;
        frame.pressed = [];
        frame.addEventListener("keydown", (event) => {
          if (!["Shift", "Alt", "Control", "Meta"].includes(event.key)) {
            frame.pressed.push([event.key, event.defaultPrevented]);
          }
        });
      });
    const pressed = (board: Board) =>
      board.view.locator("[data-kanban]").evaluate((element) => {
        const frame = element.ownerDocument.defaultView as unknown as {
          pressed: [string, boolean][];
        };
        return frame.pressed;
      });
    const current = (board: Board, id: string) => cardOf(board, id).getAttribute("aria-current");

    test(
      "a drag within the column shows the line where the card would land, drops it there with the highlight on the moved card, and a drag back clears both",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, cardOf(board, "c"));
        await dragOverCard(board, cardOf(board, "a"), "upper");
        await expectLine(board, "a", "before");
        expect(await lineCount(board)).toBe(1);
        // Within its own column the outline is not drawn: the card does not change column.
        expect(await columnOf(board, "todo").getAttribute("data-drop")).toBeNull();
        await release(board);
        await expectCards(board, "todo", ["c", "a", "d"]);
        await expectLine(board, "a", null);
        expect(await lineCount(board)).toBe(0);
        expect(await cardOf(board, "c").getAttribute("data-change")).toBe("moved");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(1);
        expect(await counterText(board)).toBe("Your changes: 1 moved");
        await draftIs(
          run,
          { ...orderItem().props, cards: [...cardsOf("c", "a", "b", "d")] },
          "the draft to hold the props with c first",
        );
        expect(await board.answer.isEnabled()).toBe(true);

        await beginDrag(board, cardOf(board, "c"));
        await dragOverCard(board, cardOf(board, "a"), "lower");
        await expectLine(board, "d", "before");
        await release(board);
        await expectCards(board, "todo", ["a", "c", "d"]);
        await draftIs(run, undefined, "the draft to hold no value");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await counterText(board)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the line is after the last card for a drop below it, and none where the drop would change nothing",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, cardOf(board, "a"));
        await dragOverCard(board, cardOf(board, "d"), "lower");
        await expectLine(board, "d", "after");
        // Back over its own place: the pointer on `a` itself, above the middle of `c`.
        await dragOverCard(board, cardOf(board, "a"), "lower");
        await expectLine(board, "d", null);
        expect(await lineCount(board)).toBe(0);
        await release(board);
        await Bun.sleep(QUIET_MS / 3);
        expect(await cardsIn(board, "todo")).toEqual(["a", "c", "d"]);
        expect(run.drafts).toEqual([]);
        expect(await counterText(board)).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a drag to another column drops it above or below that column's cards, with the outline and the line during the drag",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, cardOf(board, "c"));
        await dragOverCard(board, cardOf(board, "b"), "lower");
        await expectDrop(board, "done", "into");
        await expectLine(board, "b", "after");
        await release(board);
        await expectCards(board, "done", ["b", "c"]);
        await expectCards(board, "todo", ["a", "d"]);
        expect(await cardOf(board, "c").getAttribute("data-change")).toBe("moved");
        await draftIs(
          run,
          {
            ...orderItem().props,
            cards: cardsOf("a", "b", "c", "d").map((card) =>
              card?.id === "c" ? { ...card, column: "done" } : card,
            ),
          },
          "the draft to hold the props with c in done",
        );
        expect(await counterText(board)).toBe("Your changes: 1 moved");

        // Placed above `b` it is the first of `done`, and the Kanban shows it so.
        await beginDrag(board, cardOf(board, "c"));
        await dragOverCard(board, cardOf(board, "b"), "upper");
        await expectLine(board, "b", "before");
        await release(board);
        await expectCards(board, "done", ["c", "b"]);
        expect(await counterText(board)).not.toBe("No changes");
        expect(await board.view.locator('[data-change="moved"]').count()).toBeGreaterThan(0);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape during a drag over a place in the column moves nothing and leaves no line",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, cardOf(board, "d"));
        await dragOverCard(board, cardOf(board, "a"), "upper");
        await expectLine(board, "a", "before");
        await board.page.keyboard.press("Escape");
        await release(board);
        await eventually(
          async () => (await cardOf(board, "d").getAttribute("data-dragging")) === null,
          "the drag to end",
        );
        expect(await lineCount(board)).toBe(0);
        expect(await cardsIn(board, "todo")).toEqual(["a", "c", "d"]);
        expect(run.drafts).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+Shift with Up and Down moves the current card one place and keeps it current and focused, and moving it back leaves no draft",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await cardOf(board, "c").focus();
        await board.page.keyboard.press("Alt+Shift+ArrowUp");
        await expectCards(board, "todo", ["c", "a", "d"]);
        expect(await isFocused(cardOf(board, "c"))).toBe(true);
        expect(await current(board, "c")).toBe("true");
        expect(await cardOf(board, "c").getAttribute("aria-posinset")).toBe("1");
        expect(await counterText(board)).toBe("Your changes: 1 moved");
        await draftIs(
          run,
          { ...orderItem().props, cards: [...cardsOf("c", "a", "b", "d")] },
          "the draft to hold c first",
        );
        await board.page.keyboard.press("Alt+Shift+ArrowDown");
        await expectCards(board, "todo", ["a", "c", "d"]);
        expect(await isFocused(cardOf(board, "c"))).toBe(true);
        await draftIs(run, undefined, "the draft to hold no value");
        expect(await counterText(board)).toBe("No changes");
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+Shift with Home and End, and Ctrl and Cmd with Shift and Up and Down, put the current card at the top or the bottom, keeping the focus",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        const keep = async (keys: string, order: string[]) => {
          await board.page.keyboard.press(keys);
          await expectCards(board, "todo", order);
          expect(await isFocused(cardOf(board, "c"))).toBe(true);
          expect(await current(board, "c")).toBe("true");
        };
        await cardOf(board, "c").focus();
        await keep("Alt+Shift+End", ["a", "d", "c"]);
        await keep("Alt+Shift+Home", ["c", "a", "d"]);
        await keep("Control+Shift+ArrowDown", ["a", "d", "c"]);
        await keep("Control+Shift+ArrowUp", ["c", "a", "d"]);
        await keep("Meta+Shift+ArrowDown", ["a", "d", "c"]);
        await keep("Meta+Shift+ArrowUp", ["c", "a", "d"]);
        // Put back in the agent's place: the draft holds nothing and no card is marked.
        await keep("Alt+Shift+ArrowDown", ["a", "c", "d"]);
        await draftIs(run, undefined, "the draft to hold no value");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Shift+Up and Alt+Up act on nothing and keep their default; at the edge a bound key changes nothing, scrolls nothing and is prevented",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await cardOf(board, "c").focus();
        await spy(board);
        const place = () =>
          board.page.evaluate(() => [location.href, window.scrollX, window.scrollY]);
        const before = await place();
        await board.page.keyboard.press("Shift+ArrowUp");
        await board.page.keyboard.press("Alt+ArrowUp");
        await Bun.sleep(QUIET_MS / 3);
        expect(await current(board, "c")).toBe("true");
        expect(await cardsIn(board, "todo")).toEqual(["a", "c", "d"]);
        expect(run.drafts).toEqual([]);
        expect(await pressed(board)).toEqual([
          ["ArrowUp", false],
          ["ArrowUp", false],
        ]);
        // `c` is not first: put the first card current, and press the keys that cannot act.
        await cardOf(board, "a").focus();
        await board.page.keyboard.press("Alt+Shift+ArrowUp");
        await board.page.keyboard.press("Alt+Shift+Home");
        await board.page.keyboard.press("Control+Shift+ArrowUp");
        await Bun.sleep(QUIET_MS / 3);
        expect(await cardsIn(board, "todo")).toEqual(["a", "c", "d"]);
        expect(await current(board, "a")).toBe("true");
        expect(run.drafts).toEqual([]);
        expect((await pressed(board)).slice(2)).toEqual([
          ["ArrowUp", true],
          ["Home", true],
          ["ArrowUp", true],
        ]);
        expect(await place()).toEqual(before);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "each card gives its place in its column and the column's size, and the tools turn off at the column's edges without losing the focus",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        const places = async () =>
          board.view
            .locator("[data-kanban-card]")
            .evaluateAll((all) =>
              all.map((card) => [
                card.getAttribute("data-kanban-card"),
                card.getAttribute("aria-posinset"),
                card.getAttribute("aria-setsize"),
              ]),
            );
        expect(await places()).toEqual([
          ["a", "1", "3"],
          ["c", "2", "3"],
          ["d", "3", "3"],
          ["b", "1", "1"],
        ]);
        const state = async () =>
          Promise.all(
            ["Move up", "Move down", "To top", "To bottom", "Move to…"].map(async (name) =>
              (await tool(board, name).getAttribute("aria-disabled")) === "true" ? "off" : "on",
            ),
          );
        // No card is current: every tool is off.
        expect(await state()).toEqual(["off", "off", "off", "off", "off"]);
        await cardOf(board, "a").click();
        await eventually(async () => (await state())[1] === "on", "the tools to turn on");
        expect(await state()).toEqual(["off", "on", "off", "on", "on"]);
        await cardOf(board, "c").click();
        await eventually(async () => (await state())[0] === "on", "Move up to turn on");
        expect(await state()).toEqual(["on", "on", "on", "on", "on"]);
        await cardOf(board, "d").click();
        await eventually(async () => (await state())[1] === "off", "Move down to turn off");
        expect(await state()).toEqual(["on", "off", "on", "off", "on"]);
        await cardOf(board, "b").click();
        await eventually(async () => (await state())[0] === "off", "Move up to turn off");
        expect(await state()).toEqual(["off", "off", "off", "off", "on"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "each tool acts from the keyboard on the current card, which stays current, and a tool that turns off under the focus keeps it",
      async () => {
        const run = await host(dist, orderDocument());
        await readyIn(run);
        const { board } = run;
        await cardOf(board, "c").click();
        await eventually(
          async () => (await tool(board, "Move up").getAttribute("aria-disabled")) === null,
          "Move up to turn on",
        );
        await tool(board, "Move up").focus();
        await board.page.keyboard.press("Enter");
        await expectCards(board, "todo", ["c", "a", "d"]);
        expect(await current(board, "c")).toBe("true");
        // `c` is now first: Move up turned off under the focus and keeps it; Enter does nothing.
        await eventually(
          async () => (await tool(board, "Move up").getAttribute("aria-disabled")) === "true",
          "Move up to turn off",
        );
        expect(await isFocused(tool(board, "Move up"))).toBe(true);
        await board.page.keyboard.press("Enter");
        expect(await cardsIn(board, "todo")).toEqual(["c", "a", "d"]);
        await tool(board, "To bottom").focus();
        await board.page.keyboard.press("Enter");
        await expectCards(board, "todo", ["a", "d", "c"]);
        await tool(board, "Move down").focus();
        expect(await tool(board, "Move down").getAttribute("aria-disabled")).toBe("true");
        await tool(board, "To top").focus();
        await board.page.keyboard.press("Enter");
        await expectCards(board, "todo", ["c", "a", "d"]);
        await tool(board, "Move down").focus();
        await board.page.keyboard.press("Enter");
        await expectCards(board, "todo", ["a", "c", "d"]);
        await draftIs(run, undefined, "the draft to hold no value");
        expect(await counterText(board)).toBe("No changes");
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
