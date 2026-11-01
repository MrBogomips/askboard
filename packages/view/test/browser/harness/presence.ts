// What the browser reports when the board's tab loses focus or is hidden (tasks 5.3 and 13.6).
// Headless engines report every page focused and visible whatever the test does, so these change
// what the board page reads, `document.hasFocus()` or `visibilityState`, then send the event the
// browser would send. Test code: it runs through the browser's debugging protocol, which no CSP
// governs.
//
// When the browser window loses or regains the focus, the `blur` or `focus` goes to the window
// whose document holds the focus, and to no other: the view's window when the focus is inside the
// view, whose frame is then the board page's active element, else the board page's window.

import type { Frame } from "playwright";
import type { Board } from "./dom.ts";

/** The window whose document holds the focus: the board page's, or the view's. */
export type FocusHolder = "page" | "view";

const holderOf = async (board: Board): Promise<FocusHolder> =>
  (await board.page.evaluate(() => document.activeElement?.tagName === "IFRAME")) ? "view" : "page";

const targetOf = async (board: Board, holder: FocusHolder): Promise<Frame> =>
  holder === "view" ? board.viewFrame() : board.page.mainFrame();

const setFocusLost = async (frame: Frame, lost: boolean): Promise<void> =>
  frame.evaluate((value) => {
    if (value)
      Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
    else Reflect.deleteProperty(document, "hasFocus");
  }, lost);

const dispatch = (frame: Frame, type: "blur" | "focus"): Promise<void> =>
  frame.evaluate((name) => {
    window.dispatchEvent(new FocusEvent(name));
  }, type);

// Both documents lose or regain the focus; only the holder's window hears of it.
const changeFocus = async (board: Board, lost: boolean): Promise<FocusHolder> => {
  const holder = await holderOf(board);
  const frames = [board.page.mainFrame(), await board.viewFrame()];
  await Promise.all(frames.map((frame) => setFocusLost(frame, lost)));
  await dispatch(await targetOf(board, holder), lost ? "blur" : "focus");
  return holder;
};

/** The window lost the focus to another window or application; says which window heard the blur. */
export const loseFocus = (board: Board): Promise<FocusHolder> => changeFocus(board, true);

/** The window has the focus again; says which window heard the focus. */
export const regainFocus = (board: Board): Promise<FocusHolder> => changeFocus(board, false);

/** The tab is hidden, as when the user switches to another tab. */
export const hideTab = (board: Board): Promise<void> =>
  board.page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
