// Keys left to the browser, in each engine on the widget host (keyboard-shortcuts-help, task 2.5;
// spec view-and-widgets: Keys left to the browser, scenarios "Alt with an arrow on a Kanban card",
// "Alt with an arrow on a toolbar" and "Alt with an arrow on a Chart"): a key held with a modifier
// that a widget's table does not name changes nothing and its default is not prevented, seen by a
// listener on the view's window, which runs after the widget's own. Each scenario ends with the
// same key held with no modifier, which the widget takes and prevents, so that the listener is
// shown to see a prevented key. No Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import type { Frame } from "playwright";
import { BAR_PROPS, chartDocument } from "./fixtures/chart-documents.ts";
import { reviewDocument } from "./fixtures/document-review-documents.ts";
import { focusedBox, keysTo } from "./fixtures/gantt-input.ts";
import { barDates, ganttOf, panelFacts, panelOf } from "./fixtures/gantt-view.ts";
import { kanbanDocument } from "./fixtures/kanban-documents.ts";
import { rankingDocument } from "./fixtures/ranking-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, isFocused, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { cardOf } from "./harness/kanban-drag.ts";
import { tool as reviewTool } from "./harness/review-steps.ts";
import { tabIntoGroup } from "./harness/tab-stops.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

type Logged = { readonly key: string; readonly alt: boolean; readonly prevented: boolean };
type Logging = { __keysLog?: Logged[] };

// Records, in the view's document, every keydown as it reaches the window and whether a handler
// before it prevented it. React listens at the root, below the window, so a prevented key shows.
const listen = async (run: WidgetHostRun): Promise<Frame> => {
  const frame = await run.board.viewFrame();
  await frame.evaluate(() => {
    const log: Logged[] = [];
    (window as unknown as Logging).__keysLog = log;
    window.addEventListener("keydown", (event) => {
      log.push({ key: event.key, alt: event.altKey, prevented: event.defaultPrevented });
    });
  });
  return frame;
};

const logged = (frame: Frame): Promise<Logged[]> =>
  frame.evaluate(() => [...((window as unknown as Logging).__keysLog ?? [])]);

// Presses `combo` and gives the last key the window saw.
const press = async (run: WidgetHostRun, frame: Frame, combo: string): Promise<Logged> => {
  const before = (await logged(frame)).length;
  await run.board.page.keyboard.press(combo);
  await eventually(async () => (await logged(frame)).length > before, `${combo} to reach the view`);
  return (await logged(frame)).at(-1) as Logged;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: keys left to the browser`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "Alt with an arrow on a Kanban card changes nothing and is not prevented; the arrow alone moves the current card and is",
      async () => {
        const run = await host(dist, kanbanDocument());
        await readyIn(run);
        const { board } = run;
        const frame = await listen(run);
        await cardOf(board, "a").focus();
        await eventually(() => isFocused(cardOf(board, "a")), "focus on the card a");
        for (const combo of ["Alt+ArrowLeft", "Alt+ArrowRight", "Alt+ArrowDown"]) {
          const seen = await press(run, frame, combo);
          expect(seen).toMatchObject({ alt: true, prevented: false });
          expect(await isFocused(cardOf(board, "a"))).toBe(true);
        }
        const plain = await press(run, frame, "ArrowDown");
        expect(plain.prevented).toBe(true);
        await eventually(() => isFocused(cardOf(board, "c")), "focus on the card c");
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+ArrowRight on a Chart leaves the current point and is not prevented; ArrowRight alone moves it and is",
      async () => {
        const run = await host(dist, chartDocument(BAR_PROPS));
        await readyIn(run);
        const { board } = run;
        const frame = await listen(run);
        const live = board.view.locator("[data-chart-live]");
        const reading = async () => ((await live.textContent()) ?? "").trim();
        await tabIntoGroup(board, plan.props.text, board.view.locator("[data-chart]"));
        await eventually(
          async () => (await reading()) === "Fix A, Failures: 4 runs",
          "the first point",
        );
        for (const combo of ["Alt+ArrowRight", "Alt+End", "Shift+ArrowRight"]) {
          expect(await press(run, frame, combo)).toMatchObject({ prevented: false });
          expect(await reading()).toBe("Fix A, Failures: 4 runs");
        }
        expect((await press(run, frame, "ArrowRight")).prevented).toBe(true);
        await eventually(
          async () => (await reading()) === "Fix B, Failures: 9 runs",
          "the second point",
        );
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+ArrowRight on a Ranking's Move up keeps the focus there and is not prevented; ArrowRight alone moves it on and is",
      async () => {
        const run = await host(dist, rankingDocument());
        await readyIn(run);
        const { board } = run;
        const frame = await listen(run);
        const toolbar = board.view.getByRole("toolbar", {
          name: /Ranking tools|Strumenti della classifica/,
        });
        const moveUp = toolbar.getByRole("button", { name: "Move up", exact: true });
        const moveDown = toolbar.getByRole("button", { name: "Move down", exact: true });
        await moveUp.focus();
        await eventually(() => isFocused(moveUp), "focus on Move up");
        for (const combo of ["Alt+ArrowRight", "Alt+ArrowLeft", "Alt+End"]) {
          expect(await press(run, frame, combo)).toMatchObject({ alt: true, prevented: false });
          expect(await isFocused(moveUp)).toBe(true);
        }
        expect((await press(run, frame, "ArrowRight")).prevented).toBe(true);
        await eventually(() => isFocused(moveDown), "focus on Move down");
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+ArrowRight on a Document review's Comment keeps the focus there and is not prevented; ArrowRight alone moves it on and is",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const frame = await listen(run);
        const comment = reviewTool(view, "Comment");
        const suggest = reviewTool(view, "Suggest edit");
        await comment.focus();
        await eventually(() => isFocused(comment), "focus on Comment");
        for (const combo of ["Alt+ArrowRight", "Alt+ArrowLeft", "Alt+Home"]) {
          expect(await press(run, frame, combo)).toMatchObject({ alt: true, prevented: false });
          expect(await isFocused(comment)).toBe(true);
        }
        expect((await press(run, frame, "ArrowRight")).prevented).toBe(true);
        await eventually(() => isFocused(suggest), "focus on Suggest edit");
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Delete and Backspace in the Gantt's predecessors panel change nothing, are prevented, and leave the page and the focus where they were",
      async () => {
        const run = await opened();
        const { board } = run;
        const gantt = ganttOf(board);
        const panel = panelOf(gantt, "billing");
        const frame = await listen(run);
        await keysTo(board, "billing", "dependencies");
        await board.page.keyboard.press("Enter");
        await panel.waitFor();
        const boxes = await panelFacts(panel);
        const dates = await barDates(gantt);
        const url = board.page.url();
        expect(await focusedBox(board)).toBe("UX design");
        for (const key of ["Delete", "Backspace"]) {
          expect(await press(run, frame, key)).toMatchObject({ key, alt: false, prevented: true });
          expect(await panelFacts(panel)).toEqual(boxes);
          expect(await barDates(gantt)).toEqual(dates);
          expect(await focusedBox(board)).toBe("UX design");
          expect(board.page.url()).toBe(url);
          // The log lives in the view's document: a navigation would have dropped it.
          expect((await logged(frame)).map((entry) => entry.key)).toContain(key);
        }
        expect(await panel.count()).toBe(1);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
