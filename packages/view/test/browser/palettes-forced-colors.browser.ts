// Forced colours on a board, in the browser (palettes, task 4.1, design decision D9; view-and-
// widgets spec: Forced colours): under `forcedColors: active` the focus ring and the selected
// segment are drawn in `Highlight`, each answer state's stripe is `CanvasText` and keeps its dashed
// or solid line beside its badge's text and icon, and the Chart's host keeps its colours. Chromium
// only: the emulation is Chromium's (the change's Chromium-only rule). Task 0.2's probe P2 is what
// this rests on: the system colour keywords resolve inside the sandboxed view.

import { describe, expect, test } from "bun:test";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import { answeringAsk } from "./fixtures/answering-flow-asks.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import {
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
  receiptOf,
} from "./harness/lifecycle-test.ts";
import { enginesFor } from "./harness/suites.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];

/** What a system colour keyword resolves to in the view, as `rgb(...)`, by a probe element. */
const systemColour = (board: Board, keyword: "Highlight" | "CanvasText" | "GrayText") =>
  board.view.locator("body").evaluate((body, name) => {
    const probe = body.ownerDocument.createElement("span");
    probe.style.color = name;
    body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, keyword);

const stripeOf = (board: Board, id: string) =>
  card(board, id).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      line: style.borderLeftStyle,
      colour: style.borderLeftColor,
      state: element.getAttribute("data-askboard-stripe"),
    };
  });

for (const engine of enginesFor(import.meta.path)) {
  describe(`${engine}: forced colours`, () => {
    const { start } = useEngine(engine);

    test(
      "focus and selection: the ring of a focused segment and the selected segment are Highlight",
      async () => {
        const run = await start(
          lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
        );
        const board = await openBoard(run, ALL);
        await board.page.emulateMedia({ forcedColors: "active" });
        const highlight = await systemColour(board, "Highlight");
        await board.themeControl.click({ timeout: STEP_TIMEOUT_MS });
        const group = board.view.getByRole("radiogroup", { name: "Theme" });
        await group.waitFor({ timeout: STEP_TIMEOUT_MS });
        const selected = group.getByRole("radio", { checked: true });
        await board.page.keyboard.press("Shift");
        await selected.focus();
        const drawn = await selected.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            style: style.outlineStyle,
            colour: style.outlineColor,
            width: style.outlineWidth,
          };
        });
        expect(drawn).toEqual({ style: "solid", colour: highlight, width: "2px" });
        // With the focus elsewhere, the selected segment keeps its own 2 px Highlight outline.
        await selected.evaluate((element) => (element as HTMLElement).blur());
        const resting = await selected.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            focused: element === element.ownerDocument.activeElement,
            style: style.outlineStyle,
            colour: style.outlineColor,
            width: style.outlineWidth,
          };
        });
        expect(resting).toEqual({
          focused: false,
          style: "solid",
          colour: highlight,
          width: "2px",
        });
        const other = group.getByRole("radio", { checked: false }).first();
        const unselected = await other.evaluate(
          (element) => getComputedStyle(element).outlineStyle,
        );
        expect(unselected).not.toBe("solid");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "answer states: each stripe is CanvasText and keeps its line, and the badge keeps its text and icon",
      async () => {
        const run = await start(
          lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
        );
        const board = await openBoard(run, ALL);
        await board.page.emulateMedia({ forcedColors: "active" });
        const text = await systemColour(board, "CanvasText");
        expect(await stripeOf(board, "q1")).toEqual({ line: "solid", colour: text, state: "todo" });
        await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await stripeOf(board, "q1")).toEqual({
          line: "dashed",
          colour: text,
          state: "sent",
        });
        const badge = card(board, "q1").locator("[data-askboard-card-head] [data-askboard-state]");
        expect(((await badge.textContent()) ?? "").trim().length).toBeGreaterThan(0);
        expect(await badge.locator("svg, [data-askboard-marker]").count()).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "data keeps its colour: the Chart's host opts out of the adjustment, and the page's controls do not",
      async () => {
        const [BAR] = CHART_FIXTURE_ITEMS;
        const run = await start(
          lifecycleScenario(
            {
              askId: "chart-forced-p4c1",
              title: "Forced colours",
              items: [{ type: "question", id: "plan", props: { ...plan.props, items: [BAR] } }],
            },
            dist,
          ),
        );
        const board = await openBoard(run, ["plan"]);
        await board.page.emulateMedia({ forcedColors: "active" });
        const adjust = (selector: string) =>
          board.view
            .locator(selector)
            .first()
            .evaluate((element) => getComputedStyle(element).forcedColorAdjust);
        expect(await adjust("[data-chart]")).toBe("none");
        expect(await adjust("button")).toBe("auto");
        // The change fill is matched by its class, wherever a widget draws it.
        const fill = await board.view.locator("body").evaluate((body) => {
          const mark = body.ownerDocument.createElement("span");
          mark.className = "bg-change-subtle";
          body.append(mark);
          const found = getComputedStyle(mark).forcedColorAdjust;
          mark.remove();
          return found;
        });
        expect(fill).toBe("none");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
