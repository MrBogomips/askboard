// Reduced motion, in each engine (answering-flow-guidance, task 10.1; view-and-widgets spec: Reduced
// motion; D12; #168). At 1280x800, under Playwright's `reducedMotion` emulation: after a send with
// "Go to the next" the page is at its new position at once, the arrival mark has no animation, every
// element of the view and of the board page (the reading panel's skeleton open) computes animation
// and transition durations of 0 s, and the More menu, the mode-switch dialog and the board's keys
// panel still open and close. Without a preference, the arrival mark animates. Every scenario runs
// on the session process.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Route } from "playwright";
import { answeringAsk } from "./fixtures/answering-flow-asks.ts";
import { panelAsk, panelFiles } from "./fixtures/context-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  buttonOf,
  headingOf,
  lifecycleScenario,
  menuItem,
  openBoard,
  optionOf,
  viewportBottom,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
type Preference = "reduce" | "no-preference";

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  preference: Preference,
  delivery: "immediate" | "submitted" = "immediate",
) => {
  const run = await start(lifecycleScenario(answeringAsk("sections", "en-US", delivery), dist));
  const board = await openBoard(run, ALL);
  await board.page.emulateMedia({ reducedMotion: preference });
  return { run, board };
};

const answerWithKeys = async (board: Board, id: string): Promise<void> => {
  await optionOf(board, id, "Yes").focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, "Yes").isChecked(), `Yes chosen on ${id}`);
  await answerOf(board, id).focus();
  await board.page.keyboard.press("Enter");
};

const scrollY = (board: Board): Promise<number> =>
  board.view.locator("body").evaluate((body) => body.ownerDocument.defaultView?.scrollY ?? 0);

type Arrival = {
  /** When the act (Enter) was pressed, and when the card's heading took the focus. */
  readonly act?: number;
  readonly focused?: number;
  readonly set?: number;
  readonly removed?: number;
  readonly name?: string;
  readonly duration?: string;
  /** The card's fill and shadow when the mark was set, and the palette's two colours resolved. */
  readonly fill?: string;
  readonly shadow?: string;
  readonly subtle?: string;
  readonly primary?: string;
};

/** One frame at 60 Hz, with the slack a loaded runner needs. */
const FRAME_SLACK_MS = 50;

/** The mark is set within a frame of the move (the focus on the card's heading) and after the act. */
const expectSetWithTheMove = (seen: Arrival): void => {
  expect(seen.set).toBeDefined();
  expect(seen.focused).toBeDefined();
  expect(Math.abs((seen.set ?? 0) - (seen.focused ?? 0))).toBeLessThanOrEqual(FRAME_SLACK_MS);
  expect((seen.set ?? 0) - (seen.act ?? 0)).toBeGreaterThanOrEqual(0);
};

/** The mark at its first sample: the primary-subtle fill, and for a static mark the 4 px primary edge. */
const expectMarkShown = (seen: Arrival, edge: boolean): void => {
  expect(seen.subtle).toBeDefined();
  expect(seen.fill).toBe(seen.subtle ?? "");
  if (!edge) return;
  expect(seen.shadow).toContain(seen.primary ?? "none");
  expect(seen.shadow).toContain("4px 0px 0px 0px");
  expect(seen.shadow).toContain("inset");
};

/** The card starts 8 px (±2) under the header's bottom edge. */
const expectCardAtTop = async (board: Board, id: string): Promise<void> => {
  await eventually(async () => {
    const card = await board.question(id).boundingBox();
    const header = await board.view.getByRole("banner").boundingBox();
    if (card === null || header === null) return false;
    return Math.abs(card.y - (header.y + header.height) - 8) <= 2;
  }, `the ${id} card 8 px under the header`);
};

/** The mark lives 1.2 s: removed between 1,000 and 2,000 ms after it was set (a loaded runner). */
const expectLife = (seen: Arrival): void => {
  const lived = (seen.removed ?? 0) - (seen.set ?? 0);
  expect(lived).toBeGreaterThanOrEqual(1_000);
  expect(lived).toBeLessThanOrEqual(2_000);
};

/**
 * Watches the card's arrival mark from before the act: a `MutationObserver` in the view records
 * when `data-askboard-arrived` is set on it and removed, and the mark's animation when it was set.
 * The mark lives 1.2 s, so a test that looks for it after other waits can miss it.
 */
const watchArrival = (board: Board, id: string): Promise<void> =>
  board.view.locator("body").evaluate((body, questionId) => {
    const doc = body.ownerDocument;
    const record: { -readonly [K in keyof Arrival]: Arrival[K] } = {};
    (doc.defaultView as unknown as { __arrival: Arrival }).__arrival = record;
    doc.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" && record.act === undefined) record.act = performance.now();
      },
      true,
    );
    doc.addEventListener("focusin", (event) => {
      const target = event.target as Element;
      const heading = target.closest(`[data-askboard-question="${questionId}"]`);
      if (heading !== null && target.matches("h2,h3") && record.focused === undefined) {
        record.focused = performance.now();
      }
    });
    new MutationObserver(() => {
      const card = doc.querySelector(`[data-askboard-question="${questionId}"]`);
      if (card === null) return;
      const marked = card.hasAttribute("data-askboard-arrived");
      if (marked && record.set === undefined) {
        const style = getComputedStyle(card);
        record.set = performance.now();
        record.name = style.animationName;
        record.duration = style.animationDuration;
        record.fill = style.backgroundColor;
        record.shadow = style.boxShadow;
        // The palette's colours resolved through a probe, since `var()` does not compute alone.
        const probe = doc.createElement("div");
        probe.style.backgroundColor = "var(--primary-subtle)";
        probe.style.color = "var(--primary)";
        doc.body.appendChild(probe);
        const probed = getComputedStyle(probe);
        record.subtle = probed.backgroundColor;
        record.primary = probed.color;
        probe.remove();
      } else if (!marked && record.set !== undefined && record.removed === undefined) {
        record.removed = performance.now();
      }
    }).observe(doc.body, {
      attributes: true,
      attributeFilter: ["data-askboard-arrived"],
      subtree: true,
    });
  }, id);

const arrivalOf = (board: Board): Promise<Arrival> =>
  board.view
    .locator("body")
    .evaluate(
      (body) => (body.ownerDocument.defaultView as unknown as { __arrival: Arrival }).__arrival,
    );

type Durations = { readonly name: string; readonly animation: string; readonly transition: string };

// Every element of a document, and its two pseudo-elements, whose animation or transition lasts
// longer than 0 s. Runs in the page, so it is self-contained.
const longMotion = (): Durations[] => {
  const offenders: Durations[] = [];
  const lasting = (value: string) => value.split(",").some((each) => Number.parseFloat(each) > 0);
  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      if (lasting(style.animationDuration) || lasting(style.transitionDuration)) {
        offenders.push({
          name: `${element.tagName.toLowerCase()}${pseudo ?? ""}.${element.getAttribute("class") ?? ""}`,
          animation: style.animationDuration,
          transition: style.transitionDuration,
        });
      }
    }
  }
  return offenders;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: reduced motion`, () => {
    const { start } = useEngine(engine);
    const folders: string[] = [];
    afterEach(async () => {
      for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
    });

    test(
      "matchMedia follows the emulation, in both documents",
      async () => {
        const { board } = await open(start, "reduce");
        const query = "(prefers-reduced-motion: reduce)";
        expect(await board.page.evaluate((q) => matchMedia(q).matches, query)).toBe(true);
        expect(
          await board.view.locator("body").evaluate((_b, q) => matchMedia(q).matches, query),
        ).toBe(true);
        await board.page.emulateMedia({ reducedMotion: "no-preference" });
        expect(await board.page.evaluate((q) => matchMedia(q).matches, query)).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "reduce: after a send with Go to the next the page is at its new position at once, and the arrival mark does not animate",
      async () => {
        const { run, board } = await open(start, "reduce");
        await watchArrival(board, "q4");
        await answerWithKeys(board, "q3");
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "q4")), "focus on the q4 heading");
        // Instant: the scroll is done within the time of the smooth move, and nothing moves after it.
        const foot = await viewportBottom(board);
        await expectCardAtTop(board, "q4");
        await Bun.sleep(400);
        const bottom = await headingOf(board, "q4").evaluate(
          (element) => element.getBoundingClientRect().bottom,
        );
        expect(bottom).toBeLessThanOrEqual(foot);
        const at = await scrollY(board);
        await Bun.sleep(400);
        expect(await scrollY(board)).toBe(at);
        // The mark is static, and goes after its time (1.2 s; the bounds allow a loaded runner).
        await eventually(
          async () => (await arrivalOf(board)).removed !== undefined,
          "the mark gone",
        );
        const seen = await arrivalOf(board);
        expect(seen.set).toBeDefined();
        expect(seen.name).toBe("none");
        expect(seen.duration).toBe("0s");
        expectMarkShown(seen, true);
        expectSetWithTheMove(seen);
        expectLife(seen);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "reduce: no element of the view or of the board page computes a motion longer than 0 s, the reading panel's skeleton open",
      async () => {
        const base = await realpath(await mkdtemp(join(tmpdir(), "askboard-e2e-motion-")));
        folders.push(base);
        const outside = join(base, "outside.txt");
        await writeFile(outside, "outside the project\n");
        const run = await start({
          ...lifecycleScenario(panelAsk, dist),
          files: panelFiles(outside),
          projectDir: join(base, "project"),
        });
        const board = await openBoard(run, ["spec", "other"]);
        await board.page.emulateMedia({ reducedMotion: "reduce" });
        // Hold the source's request, so the panel shows its skeleton while the check runs.
        let held: Route | undefined;
        await run.browser.context.route(/\/source/, (route) => {
          held = route;
        });
        await board.view
          .locator('[data-askboard-item="ref-file"]')
          .getByRole("button")
          .first()
          .click();
        const panel = board.page.locator('aside[aria-label="Reading panel"]');
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        const skeleton = panel.locator(".animate-pulse");
        // The panel replaces its skeleton as its states come in: read the one that is there.
        await eventually(async () => (await skeleton.count()) > 0, "the skeleton");
        const durations = await skeleton.evaluateAll((all) =>
          all.map((el) => getComputedStyle(el).animationDuration),
        );
        expect(durations.length).toBeGreaterThan(0);
        expect(durations.every((each) => each === "0s")).toBe(true);
        expect(await board.page.evaluate(longMotion)).toEqual([]);
        const frame = await board.viewFrame();
        expect(await frame.evaluate(longMotion)).toEqual([]);
        await held?.continue();
        await run.browser.context.unroute(/\/source/);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "reduce: the More menu, the mode-switch dialog and the board's keys panel still open and close",
      async () => {
        const { board } = await open(start, "reduce", "submitted");
        await buttonOf(board, "q1", "More").click({ timeout: STEP_TIMEOUT_MS });
        await menuItem(board, "Explain").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await menuItem(board, "Explain").waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        // A held answer makes the switch to One by one ask first.
        await optionOf(board, "q1", "Yes").check({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await board.delivery("immediate").click({ timeout: STEP_TIMEOUT_MS });
        const dialog = board.view.getByRole("alertdialog");
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog.waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        const keys = board.view
          .getByRole("banner")
          .getByRole("button", { name: "Keys", exact: true });
        await keys.click({ timeout: STEP_TIMEOUT_MS });
        const panel = board.view.getByRole("dialog", { name: "Board keys" });
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await panel.waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "no preference: the arrival mark animates",
      async () => {
        const { run, board } = await open(start, "no-preference");
        await watchArrival(board, "q4");
        await answerWithKeys(board, "q3");
        await actsSent(run, 1);
        await eventually(
          async () => (await arrivalOf(board)).removed !== undefined,
          "the mark gone",
        );
        const seen = await arrivalOf(board);
        expect(seen.name).toBe("askboard-arrival");
        expect(seen.duration).toBe("1.2s");
        expectMarkShown(seen, false);
        expectSetWithTheMove(seen);
        expectLife(seen);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
