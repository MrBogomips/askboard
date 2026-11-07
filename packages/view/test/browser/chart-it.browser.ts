// A Chart on an Italian board, in each engine, on the widget host (chart-widget, task 6.6; spec
// view-and-widgets: The Chart's strings, A Chart's points read aloud, Chart tooltips, scenario
// "A tooltip in Italian"): a board in it-IT holding a bar chart whose labels are the agent's own
// shows "Nessun punto evidenziato", "1 punto evidenziato", "2 punti evidenziati", reads each point
// aloud in Italian with the value as "1.234,5 €", names itself "grafico", and shows none of the
// board's English strings, in the text and in the accessible names; the tooltip drawn on the canvas
// reads "1.234,5 €" too (read in Chromium and WebKit, which draw it as text; Firefox's draw is
// not recorded here) and is drawn in the library's default 12px sans-serif, not the theme's font, which settles review U-2; tabbing to the chart takes the focus ring and draws the first point's tooltip (review U-1).

import { describe, expect, test } from "bun:test";
import { chartDocument } from "./fixtures/chart-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import {
  CANVAS_TEXT_KEY,
  drawnTexts,
  recordCanvasText,
  visibleText,
} from "./harness/canvas-text.ts";
import { type BarRig, barOf, chartOf, clickBar, counterIs, liveIs } from "./harness/chart-steps.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { tabIntoGroup } from "./harness/tab-stops.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

// The agent's labels are Italian, so an English word on the item is the board's own.
const PROPS = {
  kind: "bar",
  title: "Costo per correzione",
  categories: [
    { id: "a", label: "Correzione A" },
    { id: "b", label: "Correzione B" },
  ],
  series: [{ id: "cost", label: "Costo", values: [1234.5, 800] }],
  unit: "€",
} as const;
// One series, so no legend; the value axis ends at 1250 (1234.5 plus the round step of 250).
const RIG: BarRig = {
  layout: { categories: 2, series: 1, axisMax: 1250 },
  values: [[1234.5, 800]],
};

// The chrome of the Chart in English, as the string tables write it.
const ENGLISH = [
  "No points highlighted",
  "point highlighted",
  "points highlighted",
  "Arrow keys",
  "Space highlights",
  "highlighted",
] as const;

// What the chart's block shows and names: its text, the hidden hint and live region included, and
// every accessible label, role description and title in it.
const shownIn = (board: Board): Promise<string[]> =>
  board.view
    .locator("[data-chart-widget]")
    .evaluate((block) => [
      block.textContent ?? "",
      ...[...block.querySelectorAll("[aria-label], [title], [aria-roledescription]")].flatMap(
        (element) => [
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? "",
          element.getAttribute("aria-roledescription") ?? "",
        ],
      ),
    ]);

const expectNoEnglish = async (board: Board): Promise<string> => {
  const shown = (await shownIn(board)).join("\n");
  for (const english of ENGLISH)
    expect({ english, shown: shown.includes(english) }).toEqual({ english, shown: false });
  return shown;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Chart on an Italian board`, () => {
    const { host } = useWidgetHost(engine);
    const open = (document = chartDocument(PROPS, "it-IT")) =>
      host(dist, document, {
        prepare: async (context) => {
          await context.addInitScript(recordCanvasText, CANVAS_TEXT_KEY);
        },
      });

    test(
      "the counter, the live region and the role description are Italian, no English string of the board shows, and the value reads 1.234,5 €",
      async () => {
        const run = await open();
        await readyIn(run);
        const { board } = run;
        expect(await board.view.locator("[data-chart-counter]").textContent()).toBe(
          "Nessun punto evidenziato",
        );
        expect(await chartOf(board).getAttribute("aria-roledescription")).toBe("grafico");
        const idle = await expectNoEnglish(board);
        expect(idle).toContain("Le frecce spostano tra i punti. Spazio evidenzia.");
        await clickBar(board, RIG, 0, 0);
        await counterIs(board, "1 punto evidenziato");
        await clickBar(board, RIG, 0, 1);
        await counterIs(board, "2 punti evidenziati");
        // The keyboard reads each point: category, series, the value in the ask's locale, its state.
        await tabIntoGroup(board, plan.props.text, chartOf(board));
        await liveIs(board, "Correzione A, Costo: 1.234,5 €, evidenziato");
        await board.page.keyboard.press("ArrowRight");
        await liveIs(board, "Correzione B, Costo: 800 €, evidenziato");
        await board.page.keyboard.press("Space");
        await liveIs(board, "Correzione B, Costo: 800 €");
        await counterIs(board, "1 punto evidenziato");
        const shown = await expectNoEnglish(board);
        expect(shown).not.toMatch(/\bchart\b/);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    // WebKit and Chromium draw the tooltip's lines as text; the record holds each with its font.
    test(
      "the tooltip drawn on the canvas reads the category, the series and 1.234,5 €, in the library's default font",
      async () => {
        const run = await open();
        await readyIn(run);
        const { board } = run;
        const frame = await board.viewFrame();
        const { box, centre } = await barOf(board, RIG, 0, 0);
        // The record holds every text drawn since load, the axis labels among them, "Correzione A"
        // included: only what is drawn after the hover, in the tooltip's own fill (the popover
        // foreground; the axis labels use the muted one), is the tooltip (review S-2, task 7.5).
        const theme = await chartOf(board).evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            size: style.getPropertyValue("--fs-badge").trim(),
            foreground: style.getPropertyValue("--popover-foreground").trim(),
            muted: style.getPropertyValue("--muted-foreground").trim(),
          };
        });
        expect(theme.foreground.toLowerCase()).not.toBe(theme.muted.toLowerCase());
        const beforeHover = (await drawnTexts(frame)).length;
        await board.page.mouse.move(box.x + centre.x - 6, box.y + centre.y);
        await board.page.mouse.move(box.x + centre.x, box.y + centre.y, { steps: 4 });
        const tip = async () =>
          (await drawnTexts(frame))
            .slice(beforeHover)
            .map((each) => ({ ...each, text: visibleText(each.text) }))
            .filter(({ fill }) => fill.toLowerCase() === theme.foreground.toLowerCase());
        await eventually(
          async () => (await tip()).some(({ text }) => text.includes("1.234,5")),
          "the tooltip's value on the canvas",
        );
        const drawn = await tip();
        const lines = drawn.map(({ text }) => text);
        expect(lines.join("|")).toContain("Costo: 1.234,5 €");
        expect(lines).toContain("Correzione A");
        // Review U-2, read: ECharts' rich-text tooltip never applies `textStyle`'s font (its
        // `TooltipRichContent.setContent` sets the fill, the padding and the shadow only), so the
        // line is drawn in the library's default, "12px sans-serif", in Chromium and in WebKit,
        // not in the theme's 11.5px badge size and font stack; its colour is the theme's
        // popover-foreground. The assertion states what is drawn: a change of either the library
        // or the option that makes the font follow the theme fails it, and is then the news.
        const value = drawn.find(({ text }) => text.includes("1.234,5") && text.includes("Costo"));
        if (value === undefined) throw new Error("no tooltip line holds the value");
        expect(theme.size).toBe("11.5px");
        expect(value.font).toBe("12px sans-serif");
        expect(value.fill.toLowerCase()).toBe(theme.foreground.toLowerCase());
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "tabbing to the chart takes the focus ring and draws the first point's tooltip, with no hover",
      async () => {
        const run = await open();
        await readyIn(run);
        const { board } = run;
        const frame = await board.viewFrame();
        const outline = () =>
          chartOf(board).evaluate((element) => {
            const style = getComputedStyle(element);
            return { style: style.outlineStyle, width: style.outlineWidth };
          });
        const tipLines = async () =>
          (await drawnTexts(frame)).filter(({ text }) =>
            visibleText(text).includes("Costo: 1.234,5 €"),
          );
        expect((await outline()).style).toBe("none");
        expect(await tipLines()).toEqual([]);
        await tabIntoGroup(board, plan.props.text, chartOf(board));
        await liveIs(board, "Correzione A, Costo: 1.234,5 €");
        await eventually(async () => (await tipLines()).length > 0, "the tooltip on focus");
        expect(await outline()).toEqual({ style: "solid", width: "2px" });
        // Moving to the second category moves the tooltip to its value.
        await board.page.keyboard.press("ArrowRight");
        await eventually(
          async () =>
            (await drawnTexts(frame)).some(({ text }) =>
              visibleText(text).includes("Costo: 800 €"),
            ),
          "the second point's tooltip",
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
