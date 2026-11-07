// The display atoms in each engine (atoms, task 5.2; view-and-widgets spec: Display atoms, Atom
// strings; design decision 8): Values formatted in the ask's locale, en-US and it-IT, the Divider's
// rule, neither taking focus, both ready, and a figure like 5e-324 wrapping within its card instead
// of laying out as one 326-character line (checkpoint 1.8 U-3).
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/display-atoms.browser.ts

import { describe, expect, test } from "bun:test";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const VALUES = [
  { type: "value", id: "number", props: { label: "Weight", kind: "number", value: 1234.5 } },
  { type: "value", id: "percent", props: { label: "Margin", kind: "percent", value: 0.185 } },
  {
    type: "value",
    id: "money",
    props: { label: "Budget", kind: "money", amount: "12480", currency: "EUR" },
  },
  { type: "value", id: "date", props: { label: "Due", kind: "date", date: "2026-12-09" } },
  { type: "value", id: "duration", props: { label: "Effort", kind: "duration", days: 12 } },
] as const;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the display atoms`, () => {
    const { host } = useWidgetHost(engine);
    const figure = (run: Awaited<ReturnType<typeof host>>, id: string) =>
      run.board.view.locator(`[data-askboard-item="${id}"] dd`);

    test(
      "an it-IT board reads 1.234,5, 18,5%, € 12.480,00, mer 9 dic 2026 and 12 giorni",
      async () => {
        const run = await host(dist, atomDocument(VALUES, "it-IT"));
        await readyIn(run);
        const texts = await Promise.all(VALUES.map(({ id }) => figure(run, id).textContent()));
        expect(texts.map((text) => text?.replaceAll(" ", " "))).toEqual([
          "1.234,5",
          "18,5%",
          "€ 12.480,00",
          "mer 9 dic 2026",
          "12 giorni",
        ]);
        expect(await run.board.view.getByText("Margin", { exact: true }).count()).toBe(1);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an en-US board reads 1,234.5, 18.5%, €12,480.00, Wed, Dec 9, 2026 and 12 days; a label is text",
      async () => {
        const items = [
          ...VALUES,
          {
            type: "value",
            id: "markup",
            props: { label: "<b>Total</b>", kind: "number", value: 3 },
          },
        ];
        const run = await host(dist, atomDocument(items));
        await readyIn(run);
        const texts = await Promise.all(VALUES.map(({ id }) => figure(run, id).textContent()));
        expect(texts).toEqual(["1,234.5", "18.5%", "€12,480.00", "Wed, Dec 9, 2026", "12 days"]);
        const markup = run.board.view.locator('[data-askboard-item="markup"]');
        expect(await markup.locator("dt").textContent()).toBe("<b>Total</b>");
        expect(await markup.locator("b").count()).toBe(0);
        // The label in the label type, the figure in the code type, right-aligned.
        const styles = await run.board.view
          .locator('[data-askboard-item="number"]')
          .evaluate((root) => {
            const [dt, dd] = [root.querySelector("dt"), root.querySelector("dd")];
            if (dt === null || dd === null) throw new Error("no definition");
            const [label, code] = [getComputedStyle(dt), getComputedStyle(dd)];
            return {
              labelTransform: label.textTransform,
              labelSize: label.fontSize,
              codeFamily: code.fontFamily,
              codeAlign: code.textAlign,
            };
          });
        expect(styles.labelTransform).toBe("uppercase");
        expect(styles.codeFamily).toMatch(/mono/i);
        expect(styles.codeAlign).toBe("right");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Divider is a separator rule in the divider colour; neither atom takes focus, and both are ready",
      async () => {
        const items = [VALUES[0], { type: "divider", id: "rule", props: {} }, VALUES[4]];
        const run = await host(dist, atomDocument(items));
        await readyIn(run);
        const { view } = run.board;
        const rule = view.locator('[data-askboard-item="rule"] hr');
        expect(await view.getByRole("separator").count()).toBe(1);
        const rendered = await rule.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            width: style.borderTopWidth,
            style: style.borderTopStyle,
            color: style.borderTopColor,
            above: style.marginTop,
            below: style.marginBottom,
          };
        });
        expect(rendered.width).toBe("1px");
        expect(rendered.style).toBe("solid");
        expect(rendered.above).toBe(rendered.below);
        expect(rendered.above).not.toBe("0px");
        // Neither atom holds a focusable element, and ten Tabs never land inside one.
        for (const id of ["number", "rule", "duration"]) {
          expect(
            await view
              .locator(
                `[data-askboard-item="${id}"] :is(a, button, input, select, textarea, [tabindex]:not([tabindex="-1"]))`,
              )
              .count(),
            id,
          ).toBe(0);
        }
        for (let press = 0; press < 10; press += 1) {
          await run.board.page.keyboard.press("Tab");
          const inside = await run.board
            .viewFrame()
            .then((frame) =>
              frame.evaluate(() =>
                document.activeElement
                  ?.closest("[data-askboard-item]")
                  ?.getAttribute("data-askboard-item"),
              ),
            );
          expect(["number", "rule", "duration"]).not.toContain(inside);
        }
        // Ready: no loading block remains over them.
        expect(await view.getByText("Loading", { exact: false }).count()).toBe(0);
        expect(await view.getByRole("alert").count()).toBe(0);
        expect(run.messages[0]).toEqual({ type: "ready", itemId: "plan" });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a figure like 5e-324 wraps within its card: no horizontal overflow, several lines (U-3)",
      async () => {
        const tiny = {
          type: "value",
          id: "tiny",
          props: { label: "Tiny", kind: "number", value: 5e-324 },
        };
        const run = await host(dist, atomDocument([tiny]));
        await readyIn(run);
        const dd = run.board.view.locator('[data-askboard-item="tiny"] dd');
        expect((await dd.textContent())?.length).toBe(326);
        const measured = await dd.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const card = el.closest("[data-askboard-question]")?.getBoundingClientRect();
          const line = Number.parseFloat(getComputedStyle(el).lineHeight);
          return {
            right: box.right,
            cardRight: card?.right ?? 0,
            lines: Math.round(box.height / line),
            overflow: el.scrollWidth - el.clientWidth,
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        expect(measured.right).toBeLessThanOrEqual(measured.cardRight);
        expect(measured.overflow).toBeLessThanOrEqual(0);
        expect(measured.page).toBeLessThanOrEqual(0);
        expect(measured.lines).toBeGreaterThan(1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
