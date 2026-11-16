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
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import {
  actsSent,
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

/** Chooses Yes and sends, with the keyboard, as a user does. */
const answerWithKeys = async (board: Board, id: string): Promise<void> => {
  await optionOf(board, id, "Yes").focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, "Yes").isChecked(), `Yes chosen on ${id}`);
  await answerOf(board, id).focus();
  await board.page.keyboard.press("Enter");
};

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

    test(
      "the arrival mark: after Go to the next the card is outlined 3 px solid Highlight, and the outline goes after 1.2 s",
      async () => {
        const run = await start(
          lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
        );
        const board = await openBoard(run, ALL);
        await board.page.emulateMedia({ forcedColors: "active" });
        const highlight = await systemColour(board, "Highlight");
        const outline = () =>
          card(board, "q4").evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              marked: element.hasAttribute("data-askboard-arrived"),
              style: style.outlineStyle,
              colour: style.outlineColor,
              width: style.outlineWidth,
            };
          });
        await answerWithKeys(board, "q3");
        await actsSent(run, 1);
        await eventually(async () => (await outline()).marked, "the q4 card marked");
        expect(await outline()).toEqual({
          marked: true,
          style: "solid",
          colour: highlight,
          width: "3px",
        });
        await eventually(async () => !(await outline()).marked, "the mark gone");
        expect((await outline()).style).not.toBe("solid");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one mark at a time: two quick moves leave only the second card marked",
      async () => {
        const run = await start(
          lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
        );
        const board = await openBoard(run, ALL);
        // The most cards marked together, and the last one marked, from before the first act.
        await board.view.locator("body").evaluate((body) => {
          const doc = body.ownerDocument;
          // `atEnter`: which card carried the mark at each Enter, "" for none.
          const seen = { most: 0, last: "", atEnter: [] as string[] };
          (doc.defaultView as unknown as { __marks: typeof seen }).__marks = seen;
          doc.addEventListener(
            "keydown",
            (event) => {
              if (event.key !== "Enter") return;
              const on = doc.querySelector("[data-askboard-arrived]");
              seen.atEnter.push(on?.getAttribute("data-askboard-question") ?? "");
            },
            true,
          );
          new MutationObserver(() => {
            const marked = doc.querySelectorAll("[data-askboard-arrived]");
            seen.most = Math.max(seen.most, marked.length);
            const id = marked[0]?.getAttribute("data-askboard-question");
            if (id !== null && id !== undefined) seen.last = id;
          }).observe(doc.body, {
            attributes: true,
            attributeFilter: ["data-askboard-arrived"],
            subtree: true,
          });
        });
        await answerWithKeys(board, "q1");
        await actsSent(run, 1);
        await answerWithKeys(board, "q2");
        await actsSent(run, 2);
        await card(board, "q3")
          .and(board.view.locator("[data-askboard-arrived]"))
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await card(board, "q2").getAttribute("data-askboard-arrived")).toBeNull();
        const marks = await board.view.locator("body").evaluate(
          (body) =>
            (
              body.ownerDocument.defaultView as unknown as {
                __marks: { most: number; last: string; atEnter: string[] };
              }
            ).__marks,
        );
        // The second send came while q2 still carried the mark: within 1.2 s of the first move.
        expect(marks).toEqual({ most: 1, last: "q3", atEnter: ["", "q2"] });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
