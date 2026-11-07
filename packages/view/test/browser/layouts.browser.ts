// The Stack, the Row and the Group in each engine (layouts, task 3.2; view-and-widgets spec: Items
// inside layouts, Stack and Group, Row): a Group is a group named by its title around its fields, a
// Row sits side by side by weight while its items get 240 px and stacks below that, a field inside
// layouts goes into the draft by its own ID and comes back in the answer, each layout is ready and
// its question visible, and no layout takes a `style` attribute or raises a CSP report.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/layouts.browser.ts

import { describe, expect, test } from "bun:test";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const CONTACT = {
  type: "group",
  id: "contact",
  props: {
    title: "Contact",
    description: "How we reach you.",
    items: [field("phone", "Phone"), field("email", "Email")],
  },
};
const SPLIT = {
  type: "row",
  id: "split",
  props: { items: [field("left", "Left"), field("right", "Right")], widths: { left: 2 } },
};
const NESTED = {
  type: "stack",
  id: "stacked",
  props: {
    items: [
      {
        type: "group",
        id: "effort",
        props: {
          title: "Effort",
          items: [
            {
              type: "row",
              id: "pair",
              props: {
                items: [
                  { type: "number-field", id: "hours", props: { label: "Hours", min: 0, max: 40 } },
                  field("owner", "Owner"),
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
const ITEMS = [CONTACT, SPLIT, NESTED];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Stack, the Row and the Group`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "each layout is ready, its question visible, and no layout takes a style attribute or raises a CSP report",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const { view } = run.board;
        for (const id of ["contact", "split", "stacked", "effort", "pair", "hours", "left"]) {
          expect(await view.locator(`[data-askboard-item="${id}"]`).count()).toBe(1);
        }
        expect(await run.board.question("plan").getAttribute("aria-busy")).toBe("false");
        const styled = await view
          .locator(
            '[role="group"][style], [data-askboard-row][style], [data-askboard-row] > [style]',
          )
          .count();
        expect(styled).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Group is a group named by its title around both fields, its description and titles shown as text",
      async () => {
        const hostile = { ...CONTACT, props: { ...CONTACT.props, title: "<b>Contact</b>" } };
        const run = await host(dist, atomDocument([hostile]));
        await readyIn(run);
        const { view } = run.board;
        const group = view.getByRole("group", { name: "<b>Contact</b>" });
        expect(await group.count()).toBe(1);
        expect(await group.getByLabel("Phone", { exact: true }).count()).toBe(1);
        expect(await group.getByLabel("Email", { exact: true }).count()).toBe(1);
        expect(await group.getByText("How we reach you.").isVisible()).toBe(true);
        expect(await group.locator("b").count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Row of weights 2 and 1 sits side by side with the first twice as wide, then stacks when narrow",
      async () => {
        const run = await host(dist, atomDocument([SPLIT]));
        await readyIn(run);
        const { view, page } = run.board;
        const row = view.locator("[data-askboard-row]");
        const left = view.locator('[data-askboard-item="left"]');
        const right = view.locator('[data-askboard-item="right"]');
        await page.setViewportSize({ width: 1280, height: 800 });
        await eventually(
          async () => (await row.getAttribute("data-askboard-row")) === "side-by-side",
          "the Row to sit side by side",
        );
        const [a, b] = [await left.boundingBox(), await right.boundingBox()];
        if (a === null || b === null) throw new Error("no box");
        expect(Math.abs(a.y - b.y)).toBeLessThan(2);
        expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
        expect(Math.abs(a.width / b.width - 2)).toBeLessThan(0.05);
        await page.setViewportSize({ width: 560, height: 800 });
        await eventually(
          async () => (await row.getAttribute("data-askboard-row")) === "column",
          "the Row to stack",
          STEP_TIMEOUT_MS,
        );
        const [c, d] = [await left.boundingBox(), await right.boundingBox()];
        if (c === null || d === null) throw new Error("no box");
        expect(d.y).toBeGreaterThanOrEqual(c.y + c.height - 1);
        expect(Math.abs(c.x - d.x)).toBeLessThan(2);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a NumberField in a Group in a Row in a Stack goes into the draft by its own ID and comes back in the answer",
      async () => {
        const run = await host(dist, atomDocument([NESTED]));
        await readyIn(run);
        const { view } = run.board;
        const hours = view.getByLabel("Hours", { exact: true });
        await hours.fill("12");
        await hours.blur();
        await eventually(
          () => draftHolds(run.drafts, "plan", "hours", 12),
          "the draft to hold 12 under hours",
        );
        expect(await run.board.answer.isEnabled()).toBe(true);
        await run.board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => run.messages.some((message) => message.type === "answer"),
          "the answer message",
        );
        const sent = run.messages.find((message) => message.type === "answer");
        expect(sent).toMatchObject({ type: "answer", itemId: "plan", results: { hours: 12 } });
        expect(Object.keys((sent as { results?: object }).results ?? {})).toEqual(["hours"]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
