// The Tabs layout in each engine (layouts, task 3.3; view-and-widgets spec: Tabs inside a question,
// A tab holding a field to correct, Items inside layouts): the arrows, Home, End and Tab, the
// tablist named by the question's text, a Gantt in a hidden panel that counts as visible and draws
// at the panel's width once its tab is selected, a switch that stays possible on a locked and on an
// answered question, a selected tab the agent removes falling back to the first, the mark of a tab
// that holds a field to correct in English and Italian, and, on the session process, a reload that
// shows the first tab again with the fields' text and the mark back.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/tabs.browser.ts

import { describe, expect, test } from "bun:test";
import type { FrameLocator, Locator } from "playwright";
import type { ViewDocument } from "../../src/view-document.ts";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { atomAsk, atomDocument } from "./fixtures/atom-documents.ts";
import { release } from "./fixtures/gantt-documents.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const days = { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 20 } };
const panel = (id: string, title: string, ...items: unknown[]) => ({ id, title, items });
const tabsItem = (id: string, ...panels: unknown[]) => ({
  type: "tabs",
  id,
  props: { tabs: panels },
});

const THREE = tabsItem(
  "sections",
  panel("people", "People", field("who", "Who")),
  panel("effort", "Effort", { type: "group", id: "load", props: { title: "Load", items: [days] } }),
  panel("rest", "Rest", field("note", "Note")),
);

const tabNamed = (view: FrameLocator, name: string | RegExp) => view.getByRole("tab", { name });
const selected = async (tab: Locator) => (await tab.getAttribute("aria-selected")) === "true";
const focused = (locator: Locator) =>
  locator.evaluate((element) => element === element.ownerDocument.activeElement);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tabs layout`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the first tab is selected, the tablist is named by the question's text, every panel is mounted and only the selected one shows",
      async () => {
        const run = await host(dist, atomDocument([THREE]));
        await readyIn(run);
        const { view } = run.board;
        const list = view.getByRole("tablist", { name: plan.props.text });
        expect(await list.count()).toBe(1);
        expect(await list.getByRole("tab").count()).toBe(3);
        expect(await selected(tabNamed(view, "People"))).toBe(true);
        expect(await view.locator('[role="tabpanel"]').count()).toBe(3);
        expect(await view.getByLabel("Who", { exact: true }).isVisible()).toBe(true);
        expect(await view.getByLabel("Days", { exact: true }).isVisible()).toBe(false);
        expect(await run.board.question("plan").getAttribute("aria-busy")).toBe("false");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "ArrowRight selects the second tab, End the last, Tab moves into its panel, and Home goes back to the first",
      async () => {
        const run = await host(dist, atomDocument([THREE]));
        await readyIn(run);
        const { view, page } = run.board;
        await tabNamed(view, "People").focus();
        await page.keyboard.press("ArrowRight");
        await eventually(async () => selected(tabNamed(view, "Effort")), "the second tab selected");
        await page.keyboard.press("End");
        await eventually(async () => selected(tabNamed(view, "Rest")), "the last tab selected");
        await page.keyboard.press("Tab");
        const lastPanel = view.locator('[role="tabpanel"]').nth(2);
        await eventually(() => focused(lastPanel), "focus in the last tab's panel");
        await tabNamed(view, "Rest").focus();
        await page.keyboard.press("Home");
        await eventually(async () => selected(tabNamed(view, "People")), "the first tab selected");
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Gantt in the third tab counts as visible while hidden and draws at the panel's width once its tab is selected",
      async () => {
        const gantt = tabsItem(
          "views",
          panel("a", "A", field("who", "Who")),
          panel("b", "B", field("note", "Note")),
          panel("c", "C", release),
        );
        const run = await host(dist, atomDocument([gantt]));
        await readyIn(run);
        const parts = ganttOf(run.board, release.id);
        expect(await run.board.question("plan").getAttribute("aria-busy")).toBe("false");
        expect(await parts.root.isVisible()).toBe(false);
        await tabNamed(run.board.view, "C").click();
        await eventually(() => parts.chart.isVisible(), "the chart drawn");
        const panelBox = await run.board.view.locator('[role="tabpanel"]').nth(2).boundingBox();
        const rootBox = await parts.root.boundingBox();
        const chartBox = await parts.chart.boundingBox();
        if (panelBox === null || rootBox === null || chartBox === null) throw new Error("no box");
        expect(Math.abs(rootBox.width - panelBox.width)).toBeLessThan(2);
        expect(chartBox.width).toBeGreaterThan(100);
        // The chart's own box may run past the panel inside the Gantt's scroller; the scroller, the
        // Gantt's root and the document stay inside the panel.
        const scrollerBox = await parts.chart.evaluate((chart) => {
          for (let up = chart.parentElement; up !== null; up = up.parentElement) {
            const { overflowX } = getComputedStyle(up);
            if (overflowX === "auto" || overflowX === "scroll") {
              const { left, right } = up.getBoundingClientRect();
              return { left, right };
            }
          }
          return null;
        });
        if (scrollerBox === null) throw new Error("no scroller around the chart");
        expect(scrollerBox.right).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
        expect(rootBox.x + rootBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
        const wider = await run.board.view
          .locator("html")
          .evaluate((root) => root.scrollWidth > root.clientWidth);
        expect(wider).toBe(false);
        expect(await parts.bars.count()).toBeGreaterThan(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an entry in a hidden tab marks that tab, Answer stays disabled, and the mark clears once the field is corrected",
      async () => {
        const run = await host(dist, atomDocument([THREE]));
        await readyIn(run);
        const { view } = run.board;
        await tabNamed(view, "Effort").click();
        await view.getByLabel("Days", { exact: true }).fill("12,5");
        await view.getByLabel("Days", { exact: true }).blur();
        await tabNamed(view, "People").click();
        const marked = tabNamed(view, "Effort needs a correction");
        await eventually(async () => (await marked.count()) === 1, "the mark on the second tab");
        expect(await tabNamed(view, /People/).textContent()).toBe("People");
        expect(await run.board.answer.isDisabled()).toBe(true);
        await marked.click();
        await view.getByLabel("Days", { exact: true }).fill("5");
        await eventually(
          async () => (await tabNamed(view, "Effort needs a correction").count()) === 0,
          "the mark to clear",
        );
        await eventually(() => run.board.answer.isEnabled(), "Answer enabled");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board shows the mark as da correggere",
      async () => {
        const run = await host(dist, atomDocument([THREE], "it-IT"));
        await readyIn(run);
        const { view } = run.board;
        await tabNamed(view, "Effort").click();
        await view.getByLabel("Days", { exact: true }).fill("abc");
        await view.getByLabel("Days", { exact: true }).blur();
        await tabNamed(view, "People").click();
        await eventually(
          async () => (await tabNamed(view, "Effort da correggere").count()) === 1,
          "the Italian mark",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the tabs still switch once the board is locked",
      async () => {
        const document = atomDocument([THREE]);
        const run = await host(dist, document);
        await readyIn(run);
        await run.update({
          type: "state",
          state: openStateOf(document),
          lock: "moved",
        } as ViewUpdate);
        const { view } = run.board;
        await eventually(
          async () =>
            (await view.getByLabel("Who", { exact: true }).getAttribute("readonly")) !== null,
          "the field read-only",
        );
        expect(await tabNamed(view, "Effort").isEnabled()).toBe(true);
        await tabNamed(view, "Effort").click();
        await eventually(async () => selected(tabNamed(view, "Effort")), "the tab selected");
        expect(await view.getByLabel("Days", { exact: true }).isVisible()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a selected tab the agent removes falls back to the first",
      async () => {
        const document = atomDocument([THREE]);
        const run = await host(dist, document);
        await readyIn(run);
        const { view } = run.board;
        await tabNamed(view, "Rest").click();
        await eventually(async () => selected(tabNamed(view, "Rest")), "the last tab selected");
        const [question] = document.items;
        const fewer = tabsItem(
          "sections",
          panel("people", "People", field("who", "Who")),
          panel("effort", "Effort", {
            type: "group",
            id: "load",
            props: { title: "Load", items: [days] },
          }),
        );
        const next = {
          ...document,
          items: [
            {
              ...question,
              rev: 2,
              props: { ...question.props, items: [fewer] },
            },
          ],
        } as unknown as ViewDocument;
        await run.update({ type: "state", state: openStateOf(next), document: next } as ViewUpdate);
        await eventually(async () => (await view.getByRole("tab").count()) === 2, "two tabs");
        expect(await selected(tabNamed(view, "People"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    // A cut tab title shows in full on keyboard focus as on hover (EXPERIENCE, Agent-written labels;
    // review S-4), and a 200-character title widens neither the document nor its card.
    test(
      "a 200-character tab title is cut with its full text on hover, shown in full on keyboard focus, and widens nothing",
      async () => {
        const title = "T".repeat(200);
        const tabs = tabsItem(
          "sections",
          panel("long", title, field("who", "Who")),
          panel("short", "Short", field("note", "Note")),
        );
        const run = await host(dist, atomDocument([tabs]));
        await readyIn(run);
        const { view, page } = run.board;
        await page.setViewportSize({ width: 1280, height: 800 });
        const label = tabNamed(view, title).locator("span[title]");
        const cut = () => label.evaluate((span) => span.scrollWidth > span.clientWidth);
        expect(await label.getAttribute("title")).toBe(title);
        await tabNamed(view, "Short").focus();
        await eventually(cut, "the title cut while the tab has no focus");
        const wider = () =>
          view.locator("html").evaluate((root) => root.scrollWidth > root.clientWidth);
        expect(await wider()).toBe(false);
        await tabNamed(view, "Short").focus();
        await page.keyboard.press("ArrowLeft");
        await eventually(
          async () => !(await cut()),
          "the full title shown while the tab has keyboard focus",
        );
        expect(await wider()).toBe(false);
        await page.keyboard.press("ArrowRight");
        await eventually(cut, "the title cut again once the focus leaves");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Tabs layout on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a reload shows the first tab again with the fields' text back and the mark on the tab that holds an entry; an answered question's tabs still switch",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([THREE]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        await view.getByLabel("Who", { exact: true }).fill("Ada");
        await tabNamed(view, "Effort").click();
        await view.getByLabel("Days", { exact: true }).fill("abc");
        await view.getByLabel("Days", { exact: true }).blur();
        await eventually(
          () => sentDrafts(run).some((record) => JSON.stringify(record).includes('"days":"abc"')),
          "the entry mirrored to the board page",
        );
        const reload = () =>
          reloadBoard(board, run, () =>
            view.getByRole("tab", { name: /People/ }).waitFor({ timeout: STEP_TIMEOUT_MS }),
          );
        await reload();
        expect(await selected(tabNamed(view, /^People/))).toBe(true);
        expect(await view.getByLabel("Who", { exact: true }).inputValue()).toBe("Ada");
        await eventually(
          async () => (await tabNamed(view, "Effort needs a correction").count()) === 1,
          "the mark back after the reload",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await tabNamed(view, "Effort needs a correction").click();
        const field = view.getByLabel("Days", { exact: true });
        await eventually(async () => (await field.inputValue()) === "abc", "the entry restored");
        await field.fill("5");
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "days", 5),
          "the draft to hold 5 under days",
        );
        await reload();
        await tabNamed(view, "Effort").click();
        await eventually(async () => (await field.inputValue()) === "5", "the value 5 restored");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan" });
        expect(events[0]?.results).toEqual({ who: "Ada", days: 5 });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await tabNamed(view, "Rest").click();
        await eventually(
          async () => selected(tabNamed(view, "Rest")),
          "the tab switch on an answered question",
        );
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
