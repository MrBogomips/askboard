// The Timeline, in each engine, on the widget host and, for the answer and read-only scenarios, on
// the session process (latex-kanban-timeline, task 5.3; spec view-and-widgets: Timeline layout,
// Timeline moves by drag, Timeline at the keyboard, LaTeX, Kanban and Timeline read-only, LaTeX,
// Kanban and Timeline strings): the lanes are rows labelled at the left, the entries named whole; a
// real mouse drag of an entry moves it by whole days and into the lane under the pointer, with the
// change outline and a draft holding the whole props, only at the drop; Escape cancels; a press
// under the threshold makes it current and changes nothing; a milestone on the first day draws
// whole inside the chart's left edge; the keyboard moves the current entry and the toolbar moves it
// by a step; "Move later" is disabled at the last day and keeps the focus; an answered Timeline is
// read-only; an Italian board shows it in Italian. No Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import {
  documentWith,
  draftProps,
  LONG_LANE,
  lastDayItem,
  longLaneItem,
  MOVED_CHECKOUT,
  timelineAsk,
  timelineDocument,
  timelineItem,
  yearItem,
} from "./fixtures/timeline-documents.ts";
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
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  boxOf,
  dragEntry,
  entryOf,
  laneMiddle,
  PER_DAY,
  release,
  shapeOf,
  zoomOf,
} from "./harness/timeline-drag.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** The room left of the origin day, `TIMELINE_LEFT_INSET`: half a milestone's width. */
const INSET = 7;

const counter = (board: Board) => board.view.locator("[data-timeline-counter]");
const tool = (board: Board, name: string) =>
  board.view
    .getByRole("toolbar", { name: /Timeline tools|Strumenti della timeline/ })
    .getByRole("button", { name, exact: true });

const counterText = async (board: Board): Promise<string> =>
  ((await counter(board).textContent()) ?? "").trim();

const days = async (board: Board, id: string) => {
  const entry = entryOf(board, id);
  return {
    date: await entry.getAttribute("data-date"),
    start: await entry.getAttribute("data-start"),
    end: await entry.getAttribute("data-end"),
    lane: await entry.getAttribute("data-lane"),
  };
};

const expectDays = (board: Board, id: string, expected: Record<string, string | null>) =>
  eventually(
    async () => Bun.deepEquals(await days(board, id), expected, true),
    `${id} to read ${JSON.stringify(expected)}`,
  );

const draftIs = (run: WidgetHostRun, props: unknown, what: string): Promise<void> =>
  eventually(() => Bun.deepEquals(draftProps(run), props, true), what);

const CHECKOUT = { date: null, start: "2026-01-05", end: "2026-01-09", lane: "web" };
const LATER = { date: null, start: "2026-01-12", end: "2026-01-16", lane: "mobile" };

// Drags `checkout` a week later and onto `mobile`, and releases.
const dragCheckoutToMobile = async (board: Board): Promise<void> => {
  const zoom = await zoomOf(board);
  await dragEntry(board, "checkout", {
    dx: 7 * PER_DAY[zoom],
    y: await laneMiddle(board, "mobile"),
  });
  await release(board);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Timeline`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "untouched, it shows its lanes labelled at the left and its entries named whole, no change, no draft and Answer disabled",
      async () => {
        const run = await host(dist, timelineDocument());
        await readyIn(run);
        const { board } = run;
        expect(await zoomOf(board)).toBe("week");
        expect(
          await board.view
            .locator("[data-timeline-lane-label]")
            .evaluateAll((labels) => labels.map((label) => label.firstChild?.textContent?.trim())),
        ).toEqual(["Web", "Mobile"]);
        expect(
          await board.view
            .getByRole("option", { name: "Checkout, Jan 5 to Jan 9, 2026, Web" })
            .count(),
        ).toBe(1);
        expect(
          await board.view
            .getByRole("option", { name: "Launch, milestone, Feb 2, 2026, Mobile" })
            .count(),
        ).toBe(1);
        expect(await days(board, "checkout")).toEqual(CHECKOUT);
        expect(await entryOf(board, "launch").getAttribute("data-kind")).toBe("milestone");
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
      "a drag of a range a week later and onto another lane moves it only at the drop, with the change outline and a draft holding the whole props; a drag back clears both",
      async () => {
        const run = await host(dist, timelineDocument());
        await readyIn(run);
        const { board } = run;
        const zoom = await zoomOf(board);
        const before = await boxOf(shapeOf(board, "checkout"));
        await dragEntry(board, "checkout", {
          dx: 7 * PER_DAY[zoom],
          y: await laneMiddle(board, "mobile"),
        });
        // While the pointer is down the entry is drawn at the preview, and nothing is in the draft.
        expect(await entryOf(board, "checkout").getAttribute("data-dragging")).toBe("");
        const during = await boxOf(shapeOf(board, "checkout"));
        expect(Math.round(during.x - before.x)).toBe(7 * PER_DAY[zoom]);
        expect(during.y).toBeGreaterThan(before.y);
        await Bun.sleep(QUIET_MS / 3);
        expect(run.drafts).toEqual([]);
        expect(await days(board, "checkout")).toEqual(CHECKOUT);
        await release(board);
        await expectDays(board, "checkout", LATER);
        await draftIs(run, MOVED_CHECKOUT, "the draft to hold the props with checkout moved");
        expect(await entryOf(board, "checkout").getAttribute("data-change")).toBe("moved");
        expect(await board.view.locator("[data-timeline-change]").count()).toBe(1);
        expect(await entryOf(board, "checkout").getAttribute("aria-current")).toBe("true");
        expect(await counterText(board)).toBe("Your changes: 1 moved");
        expect(await board.answer.isEnabled()).toBe(true);
        // Its name follows it.
        expect(
          await board.view
            .getByRole("option", { name: "Checkout, Jan 12 to Jan 16, 2026, Mobile" })
            .count(),
        ).toBe(1);

        await dragEntry(board, "checkout", {
          dx: -7 * PER_DAY[zoom],
          y: await laneMiddle(board, "web"),
        });
        await release(board);
        await expectDays(board, "checkout", CHECKOUT);
        await draftIs(run, undefined, "the draft to hold no value");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await counterText(board)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape during a drag puts the entry back and leaves the draft as it was",
      async () => {
        const run = await host(dist, timelineDocument());
        await readyIn(run);
        const { board } = run;
        const before = await boxOf(shapeOf(board, "checkout"));
        await dragEntry(board, "checkout", { dx: 7 * PER_DAY[await zoomOf(board)] });
        expect(await entryOf(board, "checkout").getAttribute("data-dragging")).toBe("");
        await board.page.keyboard.press("Escape");
        await eventually(
          async () => (await entryOf(board, "checkout").getAttribute("data-dragging")) === null,
          "the drag to end",
        );
        await release(board);
        await Bun.sleep(QUIET_MS / 3);
        expect(await boxOf(shapeOf(board, "checkout"))).toEqual(before);
        expect(await days(board, "checkout")).toEqual(CHECKOUT);
        expect(await counterText(board)).toBe("No changes");
        expect(run.drafts).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a press under the threshold makes the entry current and changes nothing",
      async () => {
        const run = await host(dist, timelineDocument());
        await readyIn(run);
        const { board } = run;
        expect(await board.view.locator('[aria-current="true"]').count()).toBe(0);
        const box = await boxOf(shapeOf(board, "launch"));
        const { mouse } = board.page;
        await mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await mouse.down();
        await mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
        await mouse.up();
        await eventually(
          async () => (await entryOf(board, "launch").getAttribute("aria-current")) === "true",
          "launch to be current",
        );
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await counterText(board)).toBe("No changes");
        await Bun.sleep(QUIET_MS / 3);
        expect(run.drafts).toEqual([]);
        expect(await board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a year opens at month zoom, a milestone on the first day draws whole inside the chart's left edge, and the axis and lanes start the inset in",
      async () => {
        const run = await host(dist, documentWith(yearItem()));
        await readyIn(run);
        const { board } = run;
        expect(await zoomOf(board)).toBe("month");
        const chart = await boxOf(board.view.locator("[data-timeline-chart]"));
        const diamond = await boxOf(shapeOf(board, "kickoff"));
        expect(diamond.x).toBeGreaterThanOrEqual(chart.x);
        expect(Math.round(diamond.width)).toBe(14);
        // The axis's days start the inset in, and its first month tick lands on the origin day.
        expect(await board.view.locator("[data-axis-days]").getAttribute("transform")).toBe(
          `translate(${INSET} 0)`,
        );
        const gridline = await boxOf(board.view.locator("[data-axis-days] line").first());
        expect(Math.abs(gridline.x - chart.x - INSET)).toBeLessThan(2);
        // The diamond is centred in its day: its left edge is the inset plus half a day less 7.
        expect(Math.round(diamond.x - chart.x)).toBe(INSET + PER_DAY.month / 2 - 7);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "from the keyboard the entry keys make an entry current and Move later moves the milestone a week, leaving it current",
      async () => {
        const run = await host(dist, timelineDocument());
        await readyIn(run);
        const { board } = run;
        const current = (id: string) => entryOf(board, id).getAttribute("aria-current");
        // The entries are one Tab stop: the first, until one is current.
        expect(await board.view.locator('[data-timeline-entry][tabindex="0"]').count()).toBe(1);
        expect(await entryOf(board, "checkout").getAttribute("tabindex")).toBe("0");
        await entryOf(board, "checkout").focus();
        await board.page.keyboard.press("ArrowDown");
        await eventually(async () => (await current("launch")) === "true", "launch current");
        await board.page.keyboard.press("ArrowUp");
        await eventually(async () => (await current("checkout")) === "true", "checkout current");
        await board.page.keyboard.press("End");
        await eventually(async () => (await current("launch")) === "true", "End to launch");
        await board.page.keyboard.press("Home");
        await eventually(async () => (await current("checkout")) === "true", "Home to checkout");
        await board.page.keyboard.press("End");
        await eventually(async () => (await current("launch")) === "true", "launch again");
        expect(await board.view.locator('[data-timeline-entry][tabindex="0"]').count()).toBe(1);
        expect(await zoomOf(board)).toBe("week");
        // Shift+Tab lands on the toolbar's stop, "Move earlier"; Right goes to "Move later".
        await board.page.keyboard.press("Shift+Tab");
        await eventually(() => isFocused(tool(board, "Move earlier")), "focus on Move earlier");
        await board.page.keyboard.press("ArrowRight");
        await eventually(() => isFocused(tool(board, "Move later")), "focus on Move later");
        await board.page.keyboard.press("Enter");
        await expectDays(board, "launch", {
          date: "2026-02-09",
          start: null,
          end: null,
          lane: "mobile",
        });
        await draftIs(
          run,
          {
            ...timelineItem().props,
            entries: timelineItem().props.entries.map((entry) =>
              entry.id === "launch" ? { ...entry, date: "2026-02-09" } : entry,
            ),
          },
          "the draft to hold the milestone a week later",
        );
        expect(await current("launch")).toBe("true");
        expect(await counterText(board)).toBe("Your changes: 1 moved");
        expect(await entryOf(board, "launch").getAttribute("data-change")).toBe("moved");
        // Move earlier twice takes it a week back, then another week: it is no longer moved at once.
        await tool(board, "Move earlier").click();
        await expectDays(board, "launch", {
          date: "2026-02-02",
          start: null,
          end: null,
          lane: "mobile",
        });
        expect(await counterText(board)).toBe("No changes");
        await draftIs(run, undefined, "the draft to hold no value");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Move to lane… lists the other lanes and moves the current entry, which stays current; with a single lane it is disabled",
      async () => {
        const run = await host(dist, timelineDocument());
        await readyIn(run);
        const { board } = run;
        const lane = tool(board, "Move to lane…");
        expect(await lane.getAttribute("aria-disabled")).toBe("true");
        await entryOf(board, "launch").focus();
        await eventually(async () => (await lane.getAttribute("aria-disabled")) === null, "on");
        await lane.click();
        const web = board.view.getByRole("menuitem", { name: "Web", exact: true });
        await web.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(
          await board.view.getByRole("menuitem", { name: "Mobile", exact: true }).count(),
        ).toBe(0);
        await web.click();
        await expectDays(board, "launch", {
          date: "2026-02-02",
          start: null,
          end: null,
          lane: "web",
        });
        expect(await entryOf(board, "launch").getAttribute("aria-current")).toBe("true");
        expect(await counterText(board)).toBe("Your changes: 1 moved");

        const single = await host(dist, documentWith(lastDayItem()));
        await readyIn(single);
        await entryOf(single.board, "end").focus();
        expect(await tool(single.board, "Move to lane…").getAttribute("aria-disabled")).toBe(
          "true",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "on the last day Move later is disabled and keeps the focus, and Enter on it moves nothing",
      async () => {
        const run = await host(dist, documentWith(lastDayItem()));
        await readyIn(run);
        const { board } = run;
        await entryOf(board, "end").focus();
        expect(await tool(board, "Move earlier").getAttribute("aria-disabled")).toBeNull();
        expect(await tool(board, "Move later").getAttribute("aria-disabled")).toBe("true");
        await tool(board, "Move later").focus();
        await board.page.keyboard.press("Enter");
        await Bun.sleep(QUIET_MS / 3);
        expect(await isFocused(tool(board, "Move later"))).toBe(true);
        expect((await days(board, "end")).date).toBe("9999-12-31");
        expect(run.drafts).toEqual([]);
        // One step earlier, a day at day zoom, which this Timeline opens at: the tool follows the day.
        expect(await zoomOf(board)).toBe("day");
        await tool(board, "Move earlier").click();
        await expectDays(board, "end", { date: "9999-12-30", start: null, end: null, lane: "web" });
        await eventually(
          async () => (await tool(board, "Move later").getAttribute("aria-disabled")) === null,
          "Move later to turn on",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a lane label too long for the column is cut with an ellipsis and whole in its title",
      async () => {
        const run = await host(dist, documentWith(longLaneItem()));
        await readyIn(run);
        const { board } = run;
        const label = board.view.locator('[data-timeline-lane-label="web"]');
        const shown = (await label.evaluate((node) => node.firstChild?.textContent ?? "")).trim();
        expect(shown).toContain("…");
        expect(LONG_LANE.startsWith(shown.split("…")[0] ?? "x")).toBe(true);
        expect(await label.locator("title").textContent()).toBe(LONG_LANE);
        const column = await boxOf(board.view.locator("[data-timeline-lanes]"));
        const text = await boxOf(label);
        expect(text.x + text.width).toBeLessThanOrEqual(column.x + column.width);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board shows the tools, the counter and the entries' names in Italian",
      async () => {
        const run = await host(dist, timelineDocument(timelineItem("it-IT"), "it-IT"));
        await readyIn(run);
        const { board } = run;
        for (const name of ["Sposta prima", "Sposta dopo", "Sposta nella corsia…"]) {
          expect(await tool(board, name).count()).toBe(1);
        }
        expect(await counterText(board)).toBe("Nessuna modifica");
        expect(
          await board.view
            .getByRole("option", { name: "Checkout, dal 5 gen al 9 gen 2026, Web" })
            .count(),
        ).toBe(1);
        expect(
          await board.view
            .getByRole("option", { name: "Lancio, traguardo, 2 feb 2026, Mobile" })
            .count(),
        ).toBe(1);
        await entryOf(board, "launch").focus();
        await tool(board, "Sposta dopo").click();
        await eventually(
          async () => (await counterText(board)) === "Le tue modifiche: 1 spostato",
          "the Italian counter",
        );
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Timeline after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "a moved range is sent as one answer and collected as sets; once the ask closes the entries are read-only and a drag or a key sends nothing",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await dragCheckoutToMobile(board);
        await expectDays(board, "checkout", LATER);
        await eventually(
          () =>
            sentDrafts(run).some((record) => record.questions.plan?.values?.roadmap !== undefined),
          "the draft to hold the value",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        const changes = (events[0]?.changes ?? []) as readonly {
          readonly op: string;
          readonly target: string;
          readonly value: unknown;
        }[];
        expect([...changes].sort((a, b) => a.target.localeCompare(b.target))).toEqual([
          { op: "set", target: "roadmap.checkout.end", value: "2026-01-16" },
          { op: "set", target: "roadmap.checkout.lane", value: "mobile" },
          { op: "set", target: "roadmap.checkout.start", value: "2026-01-12" },
        ]);
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await days(board, "checkout")).toEqual(LATER);
        expect(await entryOf(board, "checkout").getAttribute("data-change")).toBe("moved");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await tool(board, "Move later").getAttribute("aria-disabled")) === "true",
          "the tools to turn off",
        );
        expect(await entryOf(board, "checkout").getAttribute("data-change")).toBe("moved");
        const [drafts, acts] = [sentDrafts(run).length, sentActs(run).length];
        await dragEntry(board, "launch", { dx: 7 * PER_DAY[await zoomOf(board)] });
        await release(board);
        await tool(board, "Move later").click({ force: true });
        await entryOf(board, "launch").focus();
        await board.page.keyboard.press("ArrowUp");
        await board.page.keyboard.press("Enter");
        await Bun.sleep(QUIET_MS);
        expect((await days(board, "launch")).date).toBe("2026-02-02");
        expect(await entryOf(board, "launch").getAttribute("data-dragging")).toBeNull();
        expect([sentDrafts(run).length, sentActs(run).length]).toEqual([drafts, acts]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
