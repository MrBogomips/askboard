// The DateField in each engine (atoms, task 5.5; view-and-widgets spec: Number, amount and date entry
// in the fields, The DateField's calendar, An entry blocks Answer, Atom strings): the calendar opens in
// a non-modal popover from a button after the field, a day picked is the day the calendar shows at UTC-10
// and at UTC+14, the calendar works from the keyboard and Escape returns the focus to its button, the
// item's `min` and `max` disable days, a typed date and a picked one agree, the caption and the weeks
// follow the ask's language, and the calendar is still drawn with `Intl.DateTimeFormat` and
// `toLocaleDateString` throwing in the view, under the view's policy with no violation.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/date-atom.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { eventually, isFocused, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const DECEMBER = {
  type: "date-field",
  id: "due",
  props: { label: "Due", min: "2026-12-01", max: "2026-12-31" },
};
const OPEN = { type: "date-field", id: "start", props: { label: "Start" } };

const holding = (run: WidgetHostRun, itemId: string, expected: unknown, what: string) =>
  eventually(() => draftHolds(run.drafts, "plan", itemId, expected), what);

const buttonOf = (run: WidgetHostRun, name = "Choose a date"): Locator =>
  run.board.view.getByRole("button", { name, exact: true });
const dayOf = (run: WidgetHostRun, name: string): Locator =>
  run.board.view.getByRole("button", { name, exact: true });

// Throws from the runtime's formatting, in the view's own frame only, as a stub the page cannot miss.
const THROWING_INTL = () => {
  if (location.href !== "about:srcdoc") return;
  const refuse = () => {
    throw new Error("the runtime's date formatting was used");
  };
  Intl.DateTimeFormat = refuse as never;
  Date.prototype.toLocaleDateString = refuse;
  Date.prototype.toLocaleString = refuse;
  Date.prototype.toLocaleTimeString = refuse;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the DateField's calendar`, () => {
    const { host } = useWidgetHost(engine);

    for (const [zone, label] of [
      ["Pacific/Honolulu", "UTC-10"],
      ["Pacific/Kiritimati", "UTC+14"],
    ] as const) {
      test(
        `a day picked at ${label} is the day the calendar shows: 9 December 2026 gives 2026-12-09`,
        async () => {
          const run = await host(dist, atomDocument([DECEMBER]), { timezoneId: zone });
          await readyIn(run);
          expect(
            await run.board.page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
          ).toBe(zone);
          await buttonOf(run).click();
          await dayOf(run, "Wed, Dec 9, 2026").click();
          await holding(run, "due", "2026-12-09", "the draft to hold 2026-12-09");
          expect(await run.board.view.getByLabel("Due", { exact: true }).inputValue()).toBe(
            "12/9/2026",
          );
          expect(await dayOf(run, "Wed, Dec 9, 2026").count()).toBe(0);
          // Reopened, the selected day is the same day, and it is the cell the calendar marks selected.
          await buttonOf(run).click();
          const selected = run.board.view.locator("td[data-selected] button");
          expect(await selected.getAttribute("aria-label")).toBe("Wed, Dec 9, 2026");
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "from the keyboard: Enter opens the calendar, the arrow keys move, Enter picks and fills the field, and Escape closes a second opening with the focus back on the button",
      async () => {
        const run = await host(dist, atomDocument([DECEMBER]));
        await readyIn(run);
        const button = buttonOf(run);
        await button.focus();
        await run.board.page.keyboard.press("Enter");
        const focusedDay = () =>
          run.board
            .viewFrame()
            .then((frame) =>
              frame.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""),
            );
        await eventually(
          async () => (await focusedDay()).includes("2026") === true,
          "a day to take the focus",
        );
        const first = await focusedDay();
        await run.board.page.keyboard.press("ArrowRight");
        await eventually(
          async () => (await focusedDay()) !== first,
          "the focus to move to the next day",
        );
        const second = await focusedDay();
        await run.board.page.keyboard.press("ArrowDown");
        await eventually(
          async () => (await focusedDay()) !== second,
          "the focus to move a week on",
        );
        const third = await focusedDay();
        await run.board.page.keyboard.press("Enter");
        // The picked day is the one that had the focus, written in en-US's form.
        const [, month, day] =
          (await Promise.resolve(third)).match(/^\w+, (\w+) (\d+), (\d{4})$/) ?? [];
        expect(month).toBe("Dec");
        const field = run.board.view.getByLabel("Due", { exact: true });
        await eventually(
          async () => (await field.inputValue()) === `12/${day}/2026`,
          `the field to read 12/${day}/2026`,
        );
        await holding(
          run,
          "due",
          `2026-12-${String(day).padStart(2, "0")}`,
          "the draft to hold the day",
        );
        // The popover closed and the focus is on its button.
        await eventually(() => isFocused(button), "the focus back on the button");
        expect(await run.board.view.locator("td[data-day]").count()).toBe(0);
        // A second opening: Escape closes it, the focus back on the button.
        await run.board.page.keyboard.press("Enter");
        await eventually(
          async () => (await focusedDay()).includes("2026") === true,
          "a day to take the focus",
        );
        await run.board.page.keyboard.press("Escape");
        await eventually(
          async () => (await run.board.view.locator("td[data-day]").count()) === 0,
          "the popover to close",
        );
        await eventually(() => isFocused(button), "the focus back on the button after Escape");
        // Closing left the draft as it was.
        await holding(run, "due", `2026-12-${String(day).padStart(2, "0")}`, "the draft unchanged");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "min and max disable the days outside them; a disabled day is not picked and nothing is put into the draft",
      async () => {
        const bounded = {
          type: "date-field",
          id: "due",
          props: { label: "Due", min: "2026-12-05", max: "2026-12-20" },
        };
        const run = await host(dist, atomDocument([bounded]));
        await readyIn(run);
        await buttonOf(run).click();
        expect(await dayOf(run, "Fri, Dec 4, 2026").isDisabled()).toBe(true);
        expect(await dayOf(run, "Mon, Dec 21, 2026").isDisabled()).toBe(true);
        expect(await dayOf(run, "Sat, Dec 5, 2026").isEnabled()).toBe(true);
        expect(await dayOf(run, "Sun, Dec 20, 2026").isEnabled()).toBe(true);
        await dayOf(run, "Fri, Dec 4, 2026").click({ force: true });
        await Bun.sleep(300);
        expect(draftHolds(run.drafts, "plan", "due", undefined)).toBe(true);
        expect(await run.board.view.getByLabel("Due", { exact: true }).inputValue()).toBe("");
        // The calendar offers no month past the range either.
        expect(
          await run.board.view
            .getByRole("button", { name: "Next month", exact: true })
            .isDisabled(),
        ).toBe(true);
        expect(
          await run.board.view
            .getByRole("button", { name: "Previous month", exact: true })
            .isDisabled(),
        ).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a typed date and a picked one agree: the typed day is the selected day, and the picked one is written back in the typed form",
      async () => {
        const run = await host(dist, atomDocument([DECEMBER]));
        await readyIn(run);
        const field = run.board.view.getByLabel("Due", { exact: true });
        await field.fill("12/9/2026");
        await holding(run, "due", "2026-12-09", "the typed day in the draft");
        expect(await run.board.view.locator('[id="due:note"]').textContent()).toBe(
          "= Wed, Dec 9, 2026",
        );
        await buttonOf(run).click();
        expect(
          await run.board.view.locator("td[data-selected] button").getAttribute("aria-label"),
        ).toBe("Wed, Dec 9, 2026");
        await dayOf(run, "Thu, Dec 10, 2026").click();
        await holding(run, "due", "2026-12-10", "the picked day in the draft");
        await eventually(
          async () => (await field.inputValue()) === "12/10/2026",
          "the field to read 12/10/2026",
        );
        // Typing a date outside the range is an entry with the range's error, and Answer is disabled.
        await field.fill("1/5/2027");
        await eventually(
          async () =>
            (await run.board.view.locator('[id="due:error"]').textContent()) ===
            "On or before 12/31/2026.",
          "the range error",
        );
        expect(await run.board.answer.isDisabled()).toBe(true);
        await holding(run, "due", undefined, "no result for an entry");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board has an Italian caption, Monday first and Italian weekday names; an English one Sunday first",
      async () => {
        const it = await host(dist, atomDocument([DECEMBER], "it-IT"));
        await readyIn(it);
        await buttonOf(it, "Scegli una data").click();
        expect(
          await it.board.view.getByText("dicembre 2026", { exact: true }).count(),
        ).toBeGreaterThan(0);
        const headers = it.board.view.locator("th");
        expect((await headers.allTextContents()).map((text) => text.trim())).toEqual([
          "lun",
          "mar",
          "mer",
          "gio",
          "ven",
          "sab",
          "dom",
        ]);
        expect(await dayOf(it, "mer 9 dic 2026").count()).toBe(1);
        expect(
          await it.board.view.getByRole("button", { name: "Mese successivo", exact: true }).count(),
        ).toBe(1);
        expect(
          await it.board.view.getByRole("button", { name: "Mese precedente", exact: true }).count(),
        ).toBe(1);
        const en = await host(dist, atomDocument([DECEMBER]));
        await readyIn(en);
        await buttonOf(en).click();
        expect(
          await en.board.view.getByText("December 2026", { exact: true }).count(),
        ).toBeGreaterThan(0);
        expect(
          (await en.board.view.locator("th").allTextContents()).map((text) => text.trim()),
        ).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with Intl.DateTimeFormat and toLocaleDateString throwing in the view the calendar is still drawn and a day is picked, with no violation",
      async () => {
        const run = await host(dist, atomDocument([DECEMBER, OPEN]), {
          prepare: async (context) => {
            await context.addInitScript(THROWING_INTL);
          },
        });
        await readyIn(run);
        await buttonOf(run).first().click();
        expect(
          await run.board.view.getByText("December 2026", { exact: true }).count(),
        ).toBeGreaterThan(0);
        await dayOf(run, "Wed, Dec 9, 2026").click();
        await holding(run, "due", "2026-12-09", "the day in the draft");
        expect(await run.board.view.getByRole("alert").count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the calendar is styled from the tokens: a selected day on the primary fill, a disabled one dimmed, a popover with a border and a shadow",
      async () => {
        const run = await host(dist, atomDocument([DECEMBER]));
        await readyIn(run);
        await run.board.view.getByLabel("Due", { exact: true }).fill("12/9/2026");
        await buttonOf(run).click();
        const look = (locator: Locator) =>
          locator.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              background: style.backgroundColor,
              opacity: style.opacity,
              shadow: style.boxShadow,
              border: style.borderTopWidth,
            };
          });
        const selected = await look(run.board.view.locator("td[data-selected] button"));
        const plain = await look(dayOf(run, "Thu, Dec 10, 2026"));
        expect(selected.background).not.toBe(plain.background);
        expect(selected.background).not.toBe("rgba(0, 0, 0, 0)");
        const popover = await look(run.board.view.locator('[role="dialog"]'));
        expect(popover.border).toBe("1px");
        expect(popover.shadow).not.toBe("none");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
