// The Scale, in each engine, on the widget host and, for the read-only scenario, on the session
// process (approval-scale-ranking, task 5.2; spec view-and-widgets: Scale as a slider, Scale as a
// rating, Result widgets read-only, The three widgets' strings): an unset slider shows "Not set"
// with no thumb, takes its first value from a click on the track or from Home, End or an arrow
// key, then Radix's thumbs and keys; a range starts both thumbs at the first value; a rating
// presses and clears; values and the unit read in the ask's locale; "Answer" stays disabled while
// nothing is set; an answered Scale is read-only.

import { describe, expect, test } from "bun:test";
import { scaleAsk, scaleDocument } from "./fixtures/scale-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const SLIDER = { min: 0, max: 100, step: 5 };
const unsetTrack = (board: Board) => board.view.locator("[data-scale-unset]");
const value = (board: Board) => board.view.locator("[data-scale-value]");
const thumbs = (board: Board) => board.view.getByRole("slider");

// Waits until the latest draft record the host page was sent holds `expected` for the Scale.
const draftHolding = (run: WidgetHostRun, expected: unknown, what: string): Promise<void> =>
  eventually(() => draftHolds(run.drafts, "plan", "share", expected), what);

// Clicks the unset track at `fraction` of its width, in page coordinates.
const clickTrackAt = async (board: Board, fraction: number): Promise<void> => {
  const box = await unsetTrack(board).boundingBox();
  if (box === null) throw new Error("the unset track has no box");
  await board.page.mouse.click(box.x + fraction * box.width, box.y + box.height / 2);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Scale`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an unset slider shows Not set and no thumb, leaves Answer disabled and sends nothing",
      async () => {
        const run = await host(dist, scaleDocument(SLIDER));
        await readyIn(run);
        const { board } = run;
        expect(await value(board).textContent()).toBe("Not set");
        expect(await thumbs(board).count()).toBe(1);
        expect(await unsetTrack(board).getAttribute("aria-valuetext")).toBe("Not set");
        expect(await unsetTrack(board).getAttribute("aria-valuenow")).toBeNull();
        expect(await board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.drafts).toEqual([]);
        expect(draftHolds(run.drafts, "plan", "share", undefined)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the first click at 36% of the track sets 35, with a thumb, and Answer is enabled",
      async () => {
        const run = await host(dist, scaleDocument(SLIDER));
        await readyIn(run);
        const { board } = run;
        await clickTrackAt(board, 0.36);
        await eventually(async () => (await value(board).textContent()) === "35", "the value 35");
        expect(await unsetTrack(board).count()).toBe(0);
        expect(await thumbs(board).first().getAttribute("aria-valuenow")).toBe("35");
        expect(await board.answer.isEnabled()).toBe(true);
        await draftHolding(run, { value: 35 }, "the draft to hold 35");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "from unset, End sets the maximum and Home the minimum, the focus moving to the thumb, whose arrow keys then apply",
      async () => {
        const run = await host(dist, scaleDocument(SLIDER));
        await readyIn(run);
        const { board } = run;
        await unsetTrack(board).focus();
        await board.page.keyboard.press("End");
        await eventually(async () => (await value(board).textContent()) === "100", "the maximum");
        await eventually(() => isFocused(thumbs(board).first()), "focus on the thumb");
        await board.page.keyboard.press("ArrowLeft");
        await eventually(async () => (await value(board).textContent()) === "95", "one step down");
        // A second slider, set by Home.
        const other = await host(dist, scaleDocument(SLIDER));
        await readyIn(other);
        await unsetTrack(other.board).focus();
        await other.board.page.keyboard.press("Home");
        await eventually(
          async () => (await value(other.board).textContent()) === "0",
          "the minimum",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a range starts both thumbs at the first value and moves its upper thumb by keys or pointer",
      async () => {
        const run = await host(dist, scaleDocument({ ...SLIDER, range: true }));
        await readyIn(run);
        const { board } = run;
        await clickTrackAt(board, 0.4);
        await eventually(async () => (await value(board).textContent()) === "40 – 40", "40 – 40");
        expect(await thumbs(board).count()).toBe(2);
        await thumbs(board).nth(1).focus();
        for (let step = 0; step < 6; step += 1) await board.page.keyboard.press("ArrowRight");
        await eventually(async () => (await value(board).textContent()) === "40 – 70", "40 – 70");
        await draftHolding(run, { low: 40, high: 70 }, "the draft to hold 40 to 70");
        // The pointer: the upper thumb dragged back toward 50 of 100, to within a step of it.
        const thumb = await thumbs(board).nth(1).boundingBox();
        const track = await board.view.locator("[data-scale]").boundingBox();
        if (thumb === null || track === null) throw new Error("no box");
        await board.page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
        await board.page.mouse.down();
        await board.page.mouse.move(track.x + 0.5 * track.width, thumb.y + thumb.height / 2, {
          steps: 8,
        });
        await board.page.mouse.up();
        await eventually(
          async () => /^40 – (45|50|55)$/.test((await value(board).textContent()) ?? ""),
          "the upper thumb near 50",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a rating presses a step, shows the others unpressed, and pressing it again clears the value",
      async () => {
        const props = { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" };
        const run = await host(dist, scaleDocument(props));
        await readyIn(run);
        const { board } = run;
        const step = (name: string) => board.view.getByRole("radio", { name, exact: true });
        expect(await board.view.getByRole("radio").count()).toBe(5);
        expect(await board.view.getByText("Low", { exact: true }).count()).toBe(1);
        expect(await board.view.getByText("High", { exact: true }).count()).toBe(1);
        for (const name of ["1", "2", "3", "4", "5"]) {
          expect(await step(name).getAttribute("aria-checked")).toBe("false");
        }
        expect(await board.answer.isDisabled()).toBe(true);
        await step("4").click();
        await eventually(
          async () => (await step("4").getAttribute("aria-checked")) === "true",
          "4 to show pressed",
        );
        expect(await step("3").getAttribute("aria-checked")).toBe("false");
        expect(await value(board).textContent()).toBe("4");
        expect(await board.answer.isEnabled()).toBe(true);
        await draftHolding(run, { value: 4 }, "the draft to hold 4");
        await step("4").click();
        await eventually(async () => (await value(board).textContent()) === "Not set", "cleared");
        await draftHolding(run, undefined, "the draft to hold no result after the clear");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(await board.view.getByRole("alert").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "values and the unit read in the ask's locale: 99.5 % in en-US and 99,5 % in it-IT, Non impostato while unset",
      async () => {
        const props = { min: 0, max: 100, step: 0.5, unit: "%" };
        const en = await host(dist, scaleDocument(props));
        await readyIn(en);
        await unsetTrack(en.board).focus();
        await en.board.page.keyboard.press("End");
        await eventually(() => isFocused(thumbs(en.board).first()), "focus on the thumb");
        await en.board.page.keyboard.press("ArrowLeft");
        await eventually(
          async () => (await value(en.board).textContent()) === "99.5 %",
          "99.5 % in en-US",
        );
        const it = await host(dist, scaleDocument(props, "it-IT"));
        await readyIn(it);
        expect(await value(it.board).textContent()).toBe("Non impostato");
        expect(await unsetTrack(it.board).getAttribute("aria-valuetext")).toBe("Non impostato");
        await unsetTrack(it.board).focus();
        await it.board.page.keyboard.press("End");
        await eventually(() => isFocused(thumbs(it.board).first()), "focus on the thumb");
        await it.board.page.keyboard.press("ArrowLeft");
        await eventually(
          async () => (await value(it.board).textContent()) === "99,5 %",
          "99,5 % in it-IT",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Scale after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "once delivered it shows the logged value and stays editable; once the ask closes it is read-only and a click or key sends nothing",
      async () => {
        const run = await start(lifecycleScenario(scaleAsk(SLIDER), dist));
        const board = await openBoard(run, ["plan"]);
        await unsetTrack(board).focus();
        await board.page.keyboard.press("End");
        await eventually(async () => (await value(board).textContent()) === "100", "the maximum");
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "share", { value: 100 }),
          "the draft to hold 100",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ share: { value: 100 } });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        // Delivered, the question is answered and still open to a revision: the thumb works.
        expect(await value(board).textContent()).toBe("100");
        expect(await thumbs(board).first().getAttribute("data-disabled")).toBeNull();
        // The agent closes the ask: the slider is read-only and the value stays.
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await thumbs(board).first().getAttribute("data-disabled")) !== null,
          "the thumb to be disabled",
        );
        const [drafts, acts] = [sentDrafts(run).length, sentActs(run).length];
        await thumbs(board).first().click({ force: true });
        await thumbs(board).first().focus();
        await board.page.keyboard.press("ArrowLeft");
        await board.page.keyboard.press("Home");
        await Bun.sleep(QUIET_MS);
        expect(await value(board).textContent()).toBe("100");
        expect([sentDrafts(run).length, sentActs(run).length]).toEqual([drafts, acts]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
