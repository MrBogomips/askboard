// What the ask lifecycle's browser tests share (ask-lifecycle, tasks 6.1 to 6.8): a scenario that
// sends an ask as it is to the session process, the board's cards and their controls by role and
// name, the act commands and draft records the board page sent, and whether its leave-page prompt
// is armed, which a test reads by dispatching the event the browser would (design, Risks: tests
// cannot read the browser's own prompt).

import type { ActCommand, DraftRecord } from "@askboard/contract";
import type { Locator } from "playwright";
import { actsApplied, type BoardRun, LOAD_TIMEOUT_MS, STEP_TIMEOUT_MS } from "./board-test.ts";
import type { Board, ReceiptKind } from "./dom.ts";
import type { Scenario } from "./session.ts";
import type { ViewBuild } from "./view-build.ts";

/** A scenario of the lifecycle: the ask, sent as it is; the transcript only names it. */
export const lifecycleScenario = (
  ask: { readonly askId: string } & Readonly<Record<string, unknown>>,
  view: ViewBuild,
): Scenario => ({
  ask,
  view,
  transcript: { name: ask.askId, askId: ask.askId, token: "", steps: [] },
});

/** Opens the board in a new tab and waits until each named question has loaded. */
export const openBoard = async (run: BoardRun, ids: readonly string[]): Promise<Board> => {
  const board = await run.openTab();
  for (const id of ids) {
    await board.view
      .locator(`[data-askboard-question="${id}"]:not([aria-busy="true"])`)
      .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
  }
  return board;
};

export const card = (board: Board, id: string): Locator => board.question(id);

/** An option of a card, a radio or a checkbox, by its label. */
export const optionOf = (board: Board, id: string, label: string): Locator =>
  card(board, id)
    .getByRole("radio", { name: label, exact: true })
    .or(card(board, id).getByRole("checkbox", { name: label, exact: true }));

/** A card's primary button, "Answer" in any language. */
export const answerOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-primary]");

/** A card's Postpone button. */
export const postponeOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-postpone]");

/** A card's delivery receipt of a kind. */
export const receiptOf = (board: Board, id: string, kind: ReceiptKind): Locator =>
  card(board, id).locator(`[data-askboard-receipt="${kind}"]`);

/**
 * The card while the board state holds a logged answer or decline of it with that receipt
 * (`data-askboard-logged-receipt`): the probe of delivery where the state line cannot show it (a
 * held answer reads Ready, a decline Declined). It follows the board state, so it turns to
 * `delivered` when the agent's `collect` has returned the answer.
 */
export const loggedReceiptOf = (board: Board, id: string, kind: "sent" | "delivered"): Locator =>
  card(board, id).and(board.view.locator(`[data-askboard-logged-receipt="${kind}"]`));

export const noteOf = (board: Board, id: string): Locator =>
  card(board, id).getByRole("textbox", { name: "Note for the agent (optional)" });

const parsedFrames = (run: BoardRun, dir: "sent" | "received"): unknown[] =>
  run.browser.sockets.flatMap((socket) =>
    socket.frames
      .filter((frame) => frame.dir === dir)
      .map((frame) => {
        try {
          return JSON.parse(frame.text) as unknown;
        } catch {
          return undefined;
        }
      }),
  );

const ofType = <T>(messages: unknown[], type: string): T[] =>
  messages.filter(
    (message): message is T =>
      typeof message === "object" &&
      message !== null &&
      (message as { type?: unknown }).type === type,
  );

/** The act commands the board page sent, on every socket, in order. */
export const sentActs = (run: BoardRun): ActCommand[] => ofType(parsedFrames(run, "sent"), "act");

/** The draft records the board page mirrored, in order. */
export const sentDrafts = (run: BoardRun): DraftRecord[] =>
  ofType<{ record: DraftRecord }>(parsedFrames(run, "sent"), "draft").map(({ record }) => record);

/** Waits for a draft record that passes the check, as the board page mirrors it. */
export const mirrored = async (
  run: BoardRun,
  check: (record: DraftRecord) => boolean,
  what: string,
): Promise<void> => {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (!sentDrafts(run).some(check)) {
    if (Date.now() > deadline) throw new Error(`waited for a draft record with ${what}`);
    await Bun.sleep(50);
  }
};

/** Whether the board page's leave-page prompt is armed: it cancels a `beforeunload` it hears. */
export const promptArmed = (board: Board): Promise<boolean> =>
  board.page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

/** Text in the view, exactly. */
export const viewText = (board: Board, text: string): Locator =>
  board.view.getByText(text, { exact: true });

/** A card's button by its name, exactly. */
export const buttonOf = (board: Board, id: string, name: string): Locator =>
  card(board, id).getByRole("button", { name, exact: true });

/** A card's heading, the question's text. */
export const headingOf = (board: Board, id: string): Locator =>
  card(board, id)
    .getByRole("heading", { level: 2 })
    .or(card(board, id).getByRole("heading", { level: 3 }));

/** A card's own "More", in its head: a widget may carry a "More" of its own. */
export const moreOf = (board: Board, id: string): Locator =>
  card(board, id)
    .locator("[data-askboard-card-head]")
    .getByRole("button", { name: "More", exact: true });

/** An item of the open "More" menu: Explain, or Decline. */
export const menuItem = (board: Board, name: "Explain" | "Decline"): Locator =>
  board.view
    .getByRole("menuitem", { name, exact: true })
    .or(board.view.getByRole("menuitemcheckbox", { name, exact: true }));

/** Chooses an item of a card's "More" menu with the mouse. */
export const chooseFromMore = async (
  board: Board,
  id: string,
  name: "Explain" | "Decline",
): Promise<void> => {
  // The card's own More, in its head: a widget may carry a "More" of its own.
  await moreOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await menuItem(board, name).click({ timeout: STEP_TIMEOUT_MS });
};

/**
 * The controls the bottom action bar held, by name: they now sit in the header (the ask row and the
 * progress row, "Snapshot" and "Select recommended") and in the rail's outbox (the delivery switch,
 * Send and the notices link).
 */
export const barButton = (board: Board, name: string): Locator =>
  board.header.or(board.outbox).getByRole("button", { name, exact: true });

/**
 * A control's own text: what it reads, without the key caps and icons that are hidden from assistive
 * technology (`aria-hidden`) and so are no part of its name (answering-flow-visual, key caps).
 */
export const labelText = (control: Locator): Promise<string> =>
  control.evaluate((element) => {
    const copy = element.cloneNode(true) as Element;
    for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    return (copy.textContent ?? "").trim();
  });

/**
 * The view's viewport bottom, in CSS pixels from its top: the limit below which nothing may sit
 * (there is no bottom bar; answering-flow-visual).
 */
export const viewportBottom = (board: Board): Promise<number> =>
  board.view.locator("body").evaluate((body) => body.ownerDocument.defaultView?.innerHeight ?? 0);

/**
 * Scrolls the view's page by `delta` as the user does: a wheel event on the view's window, then
 * the scroll. The move after an answer treats a scroll with no input of the user's as the
 * browser's own and plans over it (answering-flow-reload-and-reveal, D2), so a test that stands for
 * the user's scroll while a move may still run says so with the input.
 */
export const userScrollBy = (board: Board, delta: number): Promise<void> =>
  board.view.locator("body").evaluate((body, by) => {
    const win = body.ownerDocument.defaultView;
    win?.dispatchEvent(new WheelEvent("wheel", { deltaY: by, bubbles: true, cancelable: true }));
    win?.scrollBy(0, by);
  }, delta);

/** A card's follow-up composer, once its thread is open. */
export const composerOf = (board: Board, id: string): Locator =>
  card(board, id).getByRole("textbox", { name: "Ask the agent a follow-up…" });

/** Waits until the board page has sent `count` act commands. */
export const actsSent = async (run: BoardRun, count: number): Promise<ActCommand[]> => {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (sentActs(run).length < count) {
    if (Date.now() > deadline) {
      throw new Error(`waited for ${count} act commands, saw ${sentActs(run).length}`);
    }
    await Bun.sleep(50);
  }
  return sentActs(run);
};

/** Waits until board-host has applied the first `count` act commands (`actsApplied`). */
export const actsDone = async (run: BoardRun, count: number): Promise<ActCommand[]> => {
  await actsApplied(run, count);
  return sentActs(run);
};

/** The act types of each command the board page sent, in order. */
export const actTypes = (run: BoardRun): string[][] =>
  sentActs(run).map((command) => command.acts.map((act) => act.type));

/** Whether the element is focused in its own document (the view's frame). */
export const focused = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element === element.ownerDocument.activeElement);

/**
 * Presses Tab (or Shift+Tab) until the target has the focus: the keyboard alone, the way a user
 * moves through the board (EXPERIENCE.md, Keyboard core).
 */
export const tabTo = async (
  board: Board,
  target: Locator,
  { backward = false, max = 80 }: { readonly backward?: boolean; readonly max?: number } = {},
): Promise<void> => {
  for (let at = 0; at < max; at += 1) {
    if (await focused(target)) return;
    await board.page.keyboard.press(backward ? "Shift+Tab" : "Tab");
  }
  if (!(await focused(target))) throw new Error(`${max} presses of Tab did not reach ${target}`);
};
