// The hover and focus audit of the board's controls, in each engine, on the widget host
// (widget-editing-plus task 7.1; spec, "Hover and focus feedback", "Hover cursors and looks" and
// "No hover feedback where nothing responds"), on the controls this change added and the ones the
// shared layer of task 1.1 could miss: a button, an editable cell, a disabled control, the drag
// handle, the column edge and a Gantt bar, in the light and the dark scheme, and the read-only
// widgets; since approval-scale-ranking (task 6.7), the controls of the Approval, the Scale and
// the Ranking; and, since latex-kanban-timeline (task 6.5), those of the LaTeX, the Kanban and the
// Timeline. `hover-layer.browser.ts` holds the first layer's own scenarios.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewDocument } from "../../src/view-document.ts";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { approvalDocument } from "./fixtures/approval-documents.ts";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { chooseWeek, planGantt } from "./fixtures/gantt-plan.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { kanbanDocument } from "./fixtures/kanban-documents.ts";
import { latexDocument } from "./fixtures/latex-documents.ts";
import { rankingDocument } from "./fixtures/ranking-documents.ts";
import { scaleDocument } from "./fixtures/scale-documents.ts";
import { tableDocument } from "./fixtures/table-documents.ts";
import { timelineDocument } from "./fixtures/timeline-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { cardOf } from "./harness/kanban-drag.ts";
import { tabIntoGroup } from "./harness/tab-stops.ts";
import { cellOf, tableGridOf, toolOf } from "./harness/table-grid.ts";
import { entryOf, shapeOf } from "./harness/timeline-drag.ts";
import { handleOf } from "./harness/tree-drag.ts";
import { enabledTools, pressIn, treeGridOf } from "./harness/tree-grid.ts";
import { focusPortal, readyIn, typeIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
const ADJUST = "Adjust by %…";

/** The computed cursor and hover look of an element. */
const lookOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      cursor: style.cursor,
      background: style.backgroundColor,
      border: style.borderTopColor,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    };
  });

const hovered = async (locator: Locator) => {
  await locator.hover();
  return lookOf(locator);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme: a disabled "Adjust by %…" shows not-allowed and no change, an enabled one the pointer and the hover pair, the drag handle grab, the column edge col-resize with the strong outline, and a bar grab`,
        async () => {
          const run = await host(dist, ganttPlanBoardDocument, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const gantt = ganttOf(board, planGantt.id);
          await chooseWeek(gantt);
          // A disabled control: nothing selected, so the adjustment is not offered.
          const resting = await lookOf(tree.tool(ADJUST));
          const disabled = await hovered(tree.tool(ADJUST));
          expect(disabled.cursor).toBe("not-allowed");
          expect(disabled.background).toBe(resting.background);
          expect(disabled.border).toBe(resting.border);
          // The same button, enabled by a selection: the pointer, the strong border, the card fill.
          await tree.row("portal").locator("[data-select]").click();
          const button = await hovered(tree.tool(ADJUST));
          expect(button.cursor).toBe("pointer");
          expect(button.border).toBe(tokenColor("border-strong", scheme));
          expect(button.background).toBe(tokenColor("card", scheme));
          // The drag handle shows on the row's hover, with the grab cursor.
          await tree.row("billing").hover();
          expect((await lookOf(handleOf(tree, "billing"))).cursor).toBe("grab");
          // The column edge: the resize cursor and the hover outline; the focus ring is not its hover.
          const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
          const edgeLook = await hovered(edge);
          expect(edgeLook.cursor).toBe("col-resize");
          expect(edgeLook.outline).toBe(`1px solid ${tokenColor("border-strong", scheme)}`);
          // A bar of a plan takes the grab cursor, and its end the horizontal resize one.
          expect((await hovered(gantt.bar("portal"))).cursor).toBe("grab");
          const grip = gantt.root.locator('[data-gantt-handle="portal"]');
          expect((await hovered(grip)).cursor).toBe("ew-resize");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a read-only plan and Tree show no handle, no grab on a bar, no text cursor on a cell and no hover change on a tool; the column edge still resizes",
      async () => {
        const run = await host(dist, ganttPlanBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        await chooseWeek(gantt);
        const update: ViewUpdate = { type: "state", state: openStateOf(ganttPlanBoardDocument) };
        await run.update({ ...update, lock: "moved" });
        await eventually(
          async () => (await enabledTools(tree.tools)).length === 0,
          "every tool disabled",
        );
        expect(await tree.grid.locator("[data-drag-handle]").count()).toBe(0);
        expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
        expect((await hovered(gantt.bar("portal"))).cursor).not.toBe("grab");
        const cell = await hovered(tree.cell("portal", 1));
        expect(cell.cursor).not.toBe("text");
        expect(cell.outline).not.toContain("1px solid");
        const tool = await hovered(tree.tool("Move down"));
        expect(tool.cursor).toBe("not-allowed");
        const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
        expect((await hovered(edge)).cursor).toBe("col-resize");
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// A control that responds: the pointer cursor, `border-strong` and the `card` fill while hovered,
// and no focus ring from hover alone. Returns nothing; the look is the layer's, not the widget's.
const expectResponds = async (control: Locator, scheme: "light" | "dark") => {
  const look = await hovered(control);
  expect(look.cursor).toBe("pointer");
  expect(look.border).toBe(tokenColor("border-strong", scheme));
  expect(look.background).toBe(tokenColor("card", scheme));
  expect(look.outline).not.toContain("2px solid");
};

// A control that does not respond: not-allowed, and no change of look under the pointer.
const expectInert = async (run: WidgetHostRun, control: Locator, cursor = true) => {
  await run.board.page.mouse.move(0, 0);
  const resting = await lookOf(control);
  const look = await hovered(control);
  if (cursor) expect(look.cursor).toBe("not-allowed");
  expect(look.background).toBe(resting.background);
  expect(look.border).toBe(resting.border);
  expect(look.outline).toBe(resting.outline);
};

// The control holds the keyboard focus and shows the ring, which hover alone never gives.
const expectRing = async (control: Locator) => {
  expect(await control.evaluate((el) => el === el.ownerDocument.activeElement)).toBe(true);
  expect((await lookOf(control)).outline).toContain("2px solid");
};

// The widget host's state for the document with the lock the board page sends (`moved`).
const lock = (run: WidgetHostRun, document: ViewDocument) =>
  run.update({ type: "state", state: openStateOf(document), lock: "moved" } as ViewUpdate);

const decisionIn = (run: WidgetHostRun, name: string) =>
  run.board.view.getByRole("radio", { name, exact: true });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the Approval, the Scale and the Ranking`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, the Approval's decisions respond, a disabled one and a locked board's do not, and the keyboard focus shows the ring`,
        async () => {
          const document = approvalDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          // An edit beside the Approval disables "Approve", whose hover changes nothing.
          const tree = treeGridOf(board);
          await focusPortal(run, tree);
          await typeIn(run, tree, "Enter", "Customer portal: accounts");
          await pressIn(board, "Enter");
          await eventually(() => decisionIn(run, "Approve").isDisabled(), "Approve to be disabled");
          await expectInert(run, decisionIn(run, "Approve"));
          await board.page.mouse.move(0, 0);
          await expectResponds(decisionIn(run, "Approve with changes"), scheme);
          await expectResponds(decisionIn(run, "Reject"), scheme);
          // Tab into the group: the first enabled decision takes the ring.
          await board.page.mouse.move(0, 0);
          const group = board.view.locator("[data-approval]").getByRole("radiogroup");
          await tabIntoGroup(board, plan.props.text, group);
          await expectRing(decisionIn(run, "Approve with changes"));
          // A locked board: every decision disabled, none responding.
          await lock(run, document);
          for (const name of ["Approve", "Approve with changes", "Reject"]) {
            await eventually(() => decisionIn(run, name).isDisabled(), `${name} to be disabled`);
            await expectInert(run, decisionIn(run, name));
          }
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        `in the ${scheme} scheme, the Scale's rating steps respond and the slider's unset track points, its thumb takes the ring from the keyboard, and a locked board's show nothing`,
        async () => {
          const rating = scaleDocument({ min: 1, max: 5, display: "rating" });
          const run = await host(dist, rating, { colorScheme: scheme });
          await readyIn(run);
          const step = (name: string) => decisionIn(run, name);
          await expectResponds(step("3"), scheme);
          await lock(run, rating);
          await eventually(() => step("3").isDisabled(), "the steps to be disabled");
          for (const name of ["1", "3", "5"]) await expectInert(run, step(name));

          const slider = scaleDocument({ min: 0, max: 100, step: 5 });
          const other = await host(dist, slider, { colorScheme: scheme });
          await readyIn(other);
          const track = other.board.view.locator("[data-scale-unset]");
          expect((await hovered(track)).cursor).toBe("pointer");
          await track.focus();
          await other.board.page.keyboard.press("End");
          const thumb = other.board.view.getByRole("slider").first();
          await eventually(
            () => thumb.evaluate((el) => el === el.ownerDocument.activeElement),
            "focus on the thumb",
          );
          await expectRing(thumb);
          // The thumb is a drag handle: grab on an open board (task 6.11).
          expect((await hovered(thumb)).cursor).toBe("grab");
          await lock(other, slider);
          await eventually(
            async () => (await thumb.getAttribute("data-disabled")) !== null,
            "the thumb to be disabled",
          );
          // A locked board's thumb is disabled: not-allowed, and no look change.
          await expectInert(other, thumb);
          expect(run.browser.errors).toEqual([]);
          expect(other.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        `in the ${scheme} scheme, the Ranking's tools respond or stay inert, its handle grabs, its list takes the ring from the keyboard, and a locked board's show no handle and inert tools`,
        async () => {
          const document = rankingDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const row = (id: string) => board.view.locator(`[data-ranking-row="${id}"]`);
          const tool = (name: string) =>
            board.view
              .getByRole("toolbar", { name: "Ranking tools" })
              .getByRole("button", { name, exact: true });
          await expectResponds(tool("Keep this order"), scheme);
          // The first row is current, so it cannot move up: that tool is disabled and inert.
          await expectInert(run, tool("Move up"));
          await board.view.locator('[data-ranking-row="cost"]').hover();
          expect(
            (await lookOf(board.view.locator('[data-ranking-row="cost"] [data-drag-handle]')))
              .cursor,
          ).toBe("grab");
          // A row is an option row: the pointer cursor from the shared layer (spec review U-2).
          expect((await hovered(row("speed"))).cursor).toBe("pointer");
          await board.page.mouse.move(0, 0);
          const list = board.view.getByRole("listbox");
          await tabIntoGroup(board, plan.props.text, list);
          await expectRing(board.view.locator('[data-ranking-row="speed"]'));
          await lock(run, document);
          await eventually(
            async () => (await board.view.locator("[data-drag-handle]").count()) === 0,
            "the handles to go",
          );
          for (const name of ["Move up", "Move down", "Keep this order"]) {
            await expectInert(run, tool(name));
          }
          // A locked board's row still answers the pointer by becoming the current row, which is
          // view state and no edit: its pointer cursor is honest, and nothing else changes.
          expect((await hovered(row("speed"))).cursor).toBe("pointer");
          await row("speed").click();
          await eventually(
            async () => (await row("speed").getAttribute("aria-current")) === "true",
            "the pressed row to become current",
          );
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}

// The LaTeX, the Kanban and the Timeline (latex-kanban-timeline, task 6.5): their tools respond or
// stay inert, a draggable card and a movable entry take the grab cursor, the source field takes the
// text cursor and the ring from the keyboard, and a locked board's show nothing.
for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the LaTeX, the Kanban and the Timeline`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, the Kanban's tools are inert until a card is current, then those that can act respond; a card grabs, takes the ring from the keyboard, and a locked board's show nothing`,
        async () => {
          const document = kanbanDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const tools = (...names: string[]) =>
            names.map((name) =>
              board.view
                .getByRole("toolbar", { name: "Kanban tools" })
                .getByRole("button", { name, exact: true }),
            );
          const all = tools("Move up", "Move down", "To top", "To bottom", "Move to…");
          const [moveUp, , toTop, , tool] = all as [Locator, Locator, Locator, Locator, Locator];
          // No card is current: every tool is disabled and inert.
          for (const control of all) await expectInert(run, control);
          expect((await hovered(cardOf(board, "a"))).cursor).toBe("grab");
          await cardOf(board, "a").click();
          await eventually(
            async () => (await tool.getAttribute("aria-disabled")) === null,
            "Move to… to turn on",
          );
          // `a` is the first card of `todo`: what moves it down or elsewhere responds, what moves
          // it up is inert.
          await board.page.mouse.move(0, 0);
          for (const control of tools("Move down", "To bottom", "Move to…")) {
            await expectResponds(control, scheme);
            await board.page.mouse.move(0, 0);
          }
          for (const control of [moveUp, toTop]) await expectInert(run, control);
          await cardOf(board, "c").focus();
          await board.page.keyboard.press("ArrowUp");
          await expectRing(cardOf(board, "a"));
          await lock(run, document);
          await eventually(
            async () => (await tool.getAttribute("aria-disabled")) === "true",
            "the tool to turn off",
          );
          for (const control of all) await expectInert(run, control);
          expect((await hovered(cardOf(board, "a"))).cursor).not.toBe("grab");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        `in the ${scheme} scheme, the Timeline's tools respond once an entry is current and are inert when none is or the board is locked, an entry's shape grabs and takes the ring from the keyboard`,
        async () => {
          const document = timelineDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const tool = (name: string) =>
            board.view
              .getByRole("toolbar", { name: "Timeline tools" })
              .getByRole("button", { name, exact: true });
          await expectInert(run, tool("Move later"));
          expect((await hovered(shapeOf(board, "checkout"))).cursor).toBe("grab");
          await entryOf(board, "launch").focus();
          await board.page.keyboard.press("ArrowUp");
          // The entry holds the focus; its ring is the 2px stroke of the current mark, in `ring`.
          expect(
            await entryOf(board, "checkout").evaluate(
              (el) => el === el.ownerDocument.activeElement,
            ),
          ).toBe(true);
          const ring = await entryOf(board, "checkout")
            .locator("[data-timeline-current]")
            .evaluate((el) => {
              const style = getComputedStyle(el);
              return { stroke: style.stroke, width: style.strokeWidth };
            });
          expect(ring).toEqual({ stroke: tokenColor("ring", scheme), width: "2px" });
          await eventually(
            async () => (await tool("Move later").getAttribute("aria-disabled")) === null,
            "Move later to turn on",
          );
          await board.page.mouse.move(0, 0);
          await expectResponds(tool("Move later"), scheme);
          await board.page.mouse.move(0, 0);
          await expectResponds(tool("Move to lane…"), scheme);
          await lock(run, document);
          for (const name of ["Move earlier", "Move later", "Move to lane…"]) {
            await eventually(
              async () => (await tool(name).getAttribute("aria-disabled")) === "true",
              `${name} to turn off`,
            );
            await expectInert(run, tool(name));
          }
          expect((await hovered(shapeOf(board, "checkout"))).cursor).not.toBe("grab");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        `in the ${scheme} scheme, the LaTeX's source takes the text cursor and the ring from the keyboard, its preview shows no pointer, and a locked board's field changes no look under the pointer`,
        async () => {
          const document = latexDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const field = board.view.locator("[data-latex-source]");
          // The text cursor is the field's own: Chromium computes `text`, WebKit `auto`.
          expect(["text", "auto"]).toContain((await hovered(field)).cursor);
          expect((await hovered(board.view.locator("[data-latex-preview]"))).cursor).not.toBe(
            "pointer",
          );
          await board.page.mouse.move(0, 0);
          await field.focus();
          await board.page.keyboard.press("ArrowRight");
          await eventually(
            async () => (await lookOf(field)).outline.includes("2px solid"),
            "the ring on the field",
          );
          await expectRing(field);
          await lock(run, document);
          await eventually(
            async () => (await field.getAttribute("readonly")) !== null,
            "the field to turn read-only",
          );
          // A read-only field still selects text, so its cursor stays honest; its look does not change.
          await expectInert(run, field, false);
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}

// The atoms (atoms, task 6.4; spec, Hover cursors and looks): a field takes the text cursor and the
// ring from the keyboard, the Toggle, "Clear", the calendar's button, a currency's segment and a day
// respond with the pointer and the hover token pair, and a locked board's atoms show no change under
// the pointer.
const ATOM_ITEMS = [
  { type: "text-field", id: "name", props: { label: "Name" } },
  { type: "toggle", id: "notify", props: { label: "Notify" } },
  { type: "number-field", id: "days", props: { label: "Days" } },
  { type: "money-field", id: "price", props: { label: "Price", currencies: ["EUR", "USD"] } },
  { type: "date-field", id: "due", props: { label: "Due", min: "2026-12-01", max: "2026-12-31" } },
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the atoms`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, a field takes the text cursor and the ring from the keyboard; the Toggle and Clear point, the calendar button and a currency respond, a day takes the muted fill; a locked board's atoms change no look under the pointer`,
        async () => {
          const document = atomDocument(ATOM_ITEMS);
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { view, page } = run.board;
          const name = view.getByLabel("Name", { exact: true });
          // A text input's own cursor: `text` in Chromium, `auto` in WebKit.
          expect(["text", "auto"]).toContain((await hovered(name)).cursor);
          await page.mouse.move(0, 0);
          await name.focus();
          await expectRing(name);
          await page.mouse.move(0, 0);
          const toggle = view.getByRole("switch", { name: "Notify" });
          expect((await hovered(toggle)).cursor).toBe("pointer");
          await toggle.click();
          const clear = view.getByRole("button", { name: "Clear", exact: true });
          await clear.waitFor();
          await page.mouse.move(0, 0);
          // "Clear" is a text button: the pointer and an underline, no border or fill of its own.
          await clear.hover();
          expect(
            await clear.evaluate((el) => {
              const style = getComputedStyle(el);
              return [style.cursor, style.textDecorationLine];
            }),
          ).toEqual(["pointer", "underline"]);
          await page.mouse.move(0, 0);
          await expectResponds(view.getByRole("radio", { name: "USD", exact: true }), scheme);
          await page.mouse.move(0, 0);
          const choose = view.getByRole("button", { name: "Choose a date", exact: true });
          await expectResponds(choose, scheme);
          await choose.click();
          await page.mouse.move(0, 0);
          // A day rests on the popover's card: it takes the `muted` fill, the layer's `hover.on-card`.
          const day = view.getByRole("button", { name: "Wed, Dec 9, 2026" });
          const resting = await lookOf(day);
          const over = await hovered(day);
          expect(over.cursor).toBe("pointer");
          expect(over.background).toBe(tokenColor("muted", scheme));
          expect(over.background).not.toBe(resting.background);
          await page.keyboard.press("Escape");
          // A locked board: the atoms respond to nothing.
          await lock(run, document);
          await eventually(() => toggle.isDisabled(), "the Toggle to be disabled");
          await expectInert(run, toggle);
          await eventually(
            async () => (await name.getAttribute("readonly")) !== null,
            "the field to turn read-only",
          );
          await expectInert(run, name, false);
          await expectInert(run, view.getByLabel("Days", { exact: true }), false);
          expect(await view.getByRole("button", { name: "Clear", exact: true }).count()).toBe(0);
          expect(await choose.count()).toBe(0);
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}

// The Tabs layout's triggers (layouts, task 3.3): buttons with the role of a tab, so the shared layer
// gives them the pointer, the keyboard focus shows the ring, and a locked board's stay enabled.
for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the Tabs layout`, () => {
    const { host } = useWidgetHost(engine);
    const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
    const tabs = {
      type: "tabs",
      id: "sections",
      props: {
        tabs: [
          { id: "a", title: "First", items: [field("one", "One")] },
          { id: "b", title: "Second", items: [field("two", "Two")] },
        ],
      },
    };

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, a tab shows the pointer under the cursor, takes the ring from the keyboard, and a locked board's tabs still respond`,
        async () => {
          const document = atomDocument([tabs]);
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const second = board.view.getByRole("tab", { name: "Second" });
          expect((await hovered(second)).cursor).toBe("pointer");
          await board.page.mouse.move(0, 0);
          await board.view.getByRole("tab", { name: "First" }).focus();
          await board.page.keyboard.press("ArrowRight");
          await expectRing(second);
          await lock(run, document);
          await eventually(
            async () => (await board.view.getByLabel("One").getAttribute("readonly")) !== null,
            "the field to turn read-only",
          );
          expect(await second.isEnabled()).toBe(true);
          expect((await hovered(second)).cursor).toBe("pointer");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}

// The PickField (form-widget, task 3.3; spec, Hover cursors and looks): an option row takes the
// pointer and the `muted` fill, "Clear" points with an underline, the filter takes the text cursor and the ring from
// the keyboard, the first radio takes the ring on Tab, and a locked board's rows change no look.
const PICK_ITEMS = [
  {
    type: "pick-field",
    id: "country",
    props: {
      label: "Country",
      options: Array.from({ length: 12 }, (_, at) => ({ id: `c${at}`, label: `Country ${at}` })),
    },
  },
  {
    type: "pick-field",
    id: "tags",
    props: {
      label: "Tags",
      multiple: true,
      options: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    },
  },
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the PickField`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, an option row and a checkbox respond, Clear points with an underline, the filter takes the text cursor and the ring, Tab gives the first radio the ring, and a locked board's rows show no change`,
        async () => {
          const document = atomDocument(PICK_ITEMS);
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { view, page } = run.board;
          const row = view.getByRole("radio", { name: "Country 3", exact: true });
          const checkbox = view.getByRole("checkbox", { name: "Alpha", exact: true });
          // An option row, as the Choice's: the pointer and the `muted` fill, the border as it was.
          for (const control of [row, checkbox]) {
            await page.mouse.move(0, 0);
            const resting = await lookOf(control);
            const over = await hovered(control);
            expect(over.cursor).toBe("pointer");
            expect(over.background).toBe(tokenColor("muted", scheme));
            expect(over.background).not.toBe(resting.background);
            expect(over.border).toBe(resting.border);
            expect(over.outline).not.toContain("2px solid");
          }
          await page.mouse.move(0, 0);
          // A text input's own cursor: `text` in Chromium, `auto` in WebKit.
          const filter = view.getByLabel("Filter the options");
          expect(["text", "auto"]).toContain((await hovered(filter)).cursor);
          await page.mouse.move(0, 0);
          await filter.focus();
          await expectRing(filter);
          await page.mouse.move(0, 0);
          await row.click();
          const clear = view.getByRole("button", { name: "Clear", exact: true });
          await clear.waitFor();
          await page.mouse.move(0, 0);
          await clear.hover();
          expect(
            await clear.evaluate((el) => {
              const style = getComputedStyle(el);
              return [style.cursor, style.textDecorationLine];
            }),
          ).toEqual(["pointer", "underline"]);
          await page.mouse.move(0, 0);
          await clear.click();
          await eventually(async () => (await clear.count()) === 0, "Clear to leave");
          await page.mouse.move(0, 0);
          // Tab into the group: the first radio takes the ring.
          const group = view.getByRole("radiogroup", { name: "Country" });
          await tabIntoGroup(run.board, plan.props.text, group);
          await expectRing(view.getByRole("radio", { name: "Country 0", exact: true }));
          // A locked board: the rows are disabled and respond to nothing, the filter is gone.
          await lock(run, document);
          await eventually(() => row.isDisabled(), "the radios to be disabled");
          await expectInert(run, row);
          await expectInert(run, checkbox);
          expect(await view.getByLabel("Filter the options").count()).toBe(0);
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}

// The Table (table-widget, task 6.2): its tools respond once a row is current and are inert before;
// an input cell takes the text cursor and the strong outline, a computed cell none; the keyboard
// focus on a cell shows the ring; a locked board's Table shows nothing that responds.
for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the Table`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, Delete row is inert until a row is current, then responds; an input cell takes the text cursor and outline, a computed cell does not, the keyboard shows the ring, and a locked Table's cells show no edit cursor`,
        async () => {
          const document = tableDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const table = tableGridOf(board);
          const remove = toolOf(table, "Delete row");
          await expectInert(run, remove);
          await expectResponds(toolOf(table, "Add row"), scheme);
          await board.page.mouse.move(0, 0);
          const editable = await hovered(cellOf(table, "dev", "days"));
          expect(editable.cursor).toBe("text");
          expect(editable.outline).toBe(`1px solid ${tokenColor("border-strong", scheme)}`);
          const computed = await hovered(cellOf(table, "dev", "amount"));
          expect(computed.cursor).not.toBe("text");
          expect(computed.outline).not.toContain("1px solid");
          await cellOf(table, "dev", "days").click();
          await eventually(
            async () => (await remove.getAttribute("aria-disabled")) === null,
            "Delete row to turn on",
          );
          await board.page.mouse.move(0, 0);
          await expectResponds(remove, scheme);
          await board.page.mouse.move(0, 0);
          await cellOf(table, "pm", "role").focus();
          await board.page.keyboard.press("ArrowDown");
          await expectRing(cellOf(table, "dev", "role"));
          await lock(run, document);
          await eventually(async () => (await table.tools.count()) === 0, "the tools to go");
          expect((await hovered(cellOf(table, "dev", "days"))).cursor).not.toBe("text");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
