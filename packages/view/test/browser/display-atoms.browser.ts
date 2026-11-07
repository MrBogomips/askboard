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

    // A label of 200 characters, in words and in one unbroken run (review 5.6, S-1).
    const WORDS = `${"label ".repeat(34)}label`.slice(0, 200);
    const RUN = "L".repeat(200);

    for (const [shape, label] of [
      ["words", WORDS],
      ["no spaces", RUN],
    ] as const) {
      for (const width of [1280, 320]) {
        test(
          `a Value, a TextField, a NumberField and a MoneyField labelled with 200 characters (${shape}) wrap inside the card at ${width} px, the figure on screen and the page with no sideways scroll`,
          async () => {
            const items = [
              { type: "value", id: "total", props: { label, kind: "number", value: 1234.5 } },
              { type: "text-field", id: "name", props: { label } },
              { type: "number-field", id: "days", props: { label } },
              { type: "money-field", id: "fee", props: { label, currency: "EUR" } },
            ];
            const run = await host(dist, atomDocument(items));
            await readyIn(run);
            await run.board.page.setViewportSize({ width, height: 800 });
            const measured = await run.board.view.locator("body").evaluate(
              (_body, ids) => {
                const card = document.querySelector("[data-askboard-question]");
                if (card === null) throw new Error("no question card");
                const cardBox = card.getBoundingClientRect();
                const outside = (el: Element) => {
                  const box = el.getBoundingClientRect();
                  return box.left < cardBox.left - 0.5 || box.right > cardBox.right + 0.5;
                };
                const out = ids.map((id) => {
                  const root = document.querySelector(`[data-askboard-item="${id}"]`);
                  const parts = [...(root?.querySelectorAll("dt, dd, label, input, [role]") ?? [])];
                  return { id, parts: parts.length, outside: parts.filter(outside).length };
                });
                const dd = document.querySelector('[data-askboard-item="total"] dd');
                return {
                  out,
                  figureWidth: dd?.getBoundingClientRect().width ?? 0,
                  figureLeft: dd?.getBoundingClientRect().left ?? -1,
                  wrapped:
                    (document
                      .querySelector('[data-askboard-item="total"] dt')
                      ?.getBoundingClientRect().height ?? 0) > 0,
                  sideways: document.documentElement.scrollWidth - window.innerWidth,
                  inner: window.innerWidth,
                };
              },
              ["total", "name", "days", "fee"],
            );
            for (const entry of measured.out) {
              expect(entry.parts, entry.id).toBeGreaterThan(0);
              expect(entry.outside, entry.id).toBe(0);
            }
            expect(measured.figureWidth).toBeGreaterThan(0);
            expect(measured.figureLeft).toBeGreaterThanOrEqual(0);
            expect(measured.sideways).toBeLessThanOrEqual(0);
            expect(run.browser.cspProblems()).toEqual([]);
          },
          TEST_TIMEOUT_MS,
        );
      }
    }

    // A unit of 20 code points, full-width or emoji, beside the input at 320 px (review U-1, 5.14).
    // MoneyField's affix is the three-letter currency code, so only the NumberField carries a long one.
    for (const [shape, unit] of [
      ["full-width", "\uFF37".repeat(20)],
      ["emoji", "\u{1F600}".repeat(20)],
    ] as const) {
      test(
        `a NumberField whose unit is 20 ${shape} characters keeps an input of 4 characters at 320 px, inside the card, with no sideways scroll`,
        async () => {
          const items = [
            { type: "number-field", id: "days", props: { label: "Days", unit } },
            { type: "money-field", id: "fee", props: { label: "Fee", currency: "EUR" } },
          ];
          const run = await host(dist, atomDocument(items));
          await readyIn(run);
          await run.board.page.setViewportSize({ width: 320, height: 800 });
          const measured = await run.board.view.locator("body").evaluate(() => {
            const card = document
              .querySelector("[data-askboard-question]")
              ?.getBoundingClientRect();
            const input = document.querySelector('[data-askboard-item="days"] input');
            if (card === undefined || input === null) throw new Error("no card or input");
            const box = input.getBoundingClientRect();
            const affix = input.parentElement?.querySelector("span")?.getBoundingClientRect();
            const style = getComputedStyle(input);
            const probe = document.createElement("span");
            probe.style.cssText = `font:${style.font};position:absolute;visibility:hidden`;
            probe.textContent = "0000";
            document.body.append(probe);
            const four = probe.getBoundingClientRect().width;
            probe.remove();
            return {
              inputWidth: box.width,
              four,
              inputRight: box.right,
              affixRight: affix?.right ?? Number.POSITIVE_INFINITY,
              cardRight: card.right,
              sideways: document.documentElement.scrollWidth - window.innerWidth,
            };
          });
          expect(measured.inputWidth).toBeGreaterThanOrEqual(measured.four);
          expect(measured.inputRight).toBeLessThanOrEqual(measured.cardRight + 0.5);
          expect(measured.affixRight).toBeLessThanOrEqual(measured.cardRight + 0.5);
          expect(measured.sideways).toBeLessThanOrEqual(0);
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
