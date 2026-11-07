// What the LaTeX bounds' scenarios on a board share (latex-kanban-timeline, task 6.8): a board of
// LaTeX items on the widget host, where an expression typed into a source field is timed from the
// input to the preview or the field error it gives, the page's own work is counted, and a key press
// is timed to its answer. Not a test file.

import type { Frame } from "playwright";
import type { Board } from "./dom.ts";

export { watching } from "./latex-watch.ts";

/** The most time an expression of at most 2,000 code points may take to show a preview or an error. */
export const SHOW_BOUND_MS = 2_000;

/** The source field and the item of the LaTeX at `at`. */
export const sourceAt = (board: Board, at: number) =>
  board.view.locator("[data-latex-source]").nth(at);

/** What an item shows: its field error's text, or null, and its preview's markup. */
export type Shown = { readonly error: string | null; readonly markup: string };

export const shownAt = async (board: Board, at: number): Promise<Shown> =>
  (await frameOf(board)).evaluate((index) => {
    const item = document.querySelectorAll("[data-latex]")[index] as Element;
    const element = item.querySelector("[data-latex-error]");
    return {
      error: element === null ? null : (element.textContent ?? "").trim(),
      markup: (item.querySelector("[data-latex-preview]") as Element).innerHTML,
    };
  }, at);

/** How an expression settled: the time from the input to the change, and what the item shows. */
export type Settled = {
  readonly ms: number;
  readonly error: string | null;
  readonly drawn: boolean;
  /** MathML elements the page created while it settled. */
  readonly created: number;
};

// The view's frame, found once per board: looking it up takes about 170 ms a call.
const frames = new WeakMap<Board, Promise<Frame>>();
const frameOf = (board: Board): Promise<Frame> => {
  const known = frames.get(board);
  if (known !== undefined) return known;
  const found = board.viewFrame();
  frames.set(board, found);
  return found;
};

const mathmlCount = async (board: Board): Promise<number> =>
  (await frameOf(board)).evaluate(() => (window as never as { __mathml: number }).__mathml);

/**
 * Types `expression` into the field `at`, which shows `baseline` (its preview's markup and field
 * error), and waits for the item to show another preview or another field error, polling inside the
 * frame so that the time is the page's, not the test's poll interval. Gives up after ten seconds,
 * reporting the time. The same error twice in a row shows no change: `typedAfterClearing` is for it.
 */
export const typeAndSettle = async (
  board: Board,
  at: number,
  expression: string,
  baseline: Shown,
): Promise<Settled> => {
  const frame = await frameOf(board);
  const before = await mathmlCount(board);
  // The value is set through the textarea's own setter and one `input` event, which is all a
  // `fill` does, without Playwright's actionability waits, which took 400 ms an expression.
  const settled = await frame.evaluate(
    ([index, base, baseError, text]) =>
      new Promise<{ ms: number; error: string | null; drawn: boolean }>((resolve) => {
        const item = document.querySelectorAll("[data-latex]")[index as number] as Element;
        const field = item.querySelector("[data-latex-source]") as HTMLTextAreaElement;
        const started = performance.now();
        const poll = () => {
          const element = item.querySelector("[data-latex-error]");
          const error = element === null ? null : (element.textContent ?? "").trim();
          const markup = (item.querySelector("[data-latex-preview]") as Element).innerHTML;
          const timedOut = performance.now() - started > 10_000;
          if (error !== baseError || markup !== base || timedOut) {
            clearInterval(timer);
            resolve({
              ms: performance.now() - started,
              error,
              drawn: markup !== base && markup !== "",
            });
          }
        };
        const timer = setInterval(poll, 4);
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        set?.call(field, text as string);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }),
    [at, baseline.markup, baseline.error, expression] as const,
  );
  return { ...settled, created: (await mathmlCount(board)) - before };
};

/**
 * Types a letter after the field's text and times the page's answer: the field holds it. A field
 * at the 2,000 code points' limit takes no more, so a Backspace is pressed instead.
 */
export const keyAnswered = async (board: Board, at: number, letter: string): Promise<number> => {
  const field = sourceAt(board, at);
  const held = await field.inputValue();
  const full = [...held].length >= 2_000;
  const key = full ? "Backspace" : letter;
  const wanted = full ? [...held].slice(0, -1).join("") : `${held}${key}`;
  await field.focus();
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(element.value.length, element.value.length);
  });
  const started = performance.now();
  await board.page.keyboard.press(key);
  while ((await field.inputValue()) !== wanted) {
    if (performance.now() - started > 10_000) throw new Error("the field never took the key");
    await Bun.sleep(5);
  }
  return performance.now() - started;
};

/** What the item shows with no field error, by typing a valid expression if it shows one. */
export const cleared = async (board: Board, at: number, sentinel: string): Promise<Shown> => {
  const shown = await shownAt(board, at);
  if (shown.error === null) return shown;
  await typeAndSettle(board, at, sentinel, shown);
  return shownAt(board, at);
};

/** The longest lag the frame's timer saw since `resetLag`, in milliseconds. */
export const resetLag = async (board: Board): Promise<void> => {
  await (await frameOf(board)).evaluate(() => {
    (window as never as { __lag: number }).__lag = 0;
  });
};
export const lagOf = async (board: Board): Promise<number> =>
  (await frameOf(board)).evaluate(() => (window as never as { __lag: number }).__lag);

/** What the page logged: a preview drawn, with the source KaTeX wrote into it, and an input. */
export type DrawLog = {
  readonly events: readonly { t: number; tex: string; at: number }[];
  readonly inputs: readonly { t: number; value: string }[];
};

export const drawLog = async (board: Board): Promise<DrawLog> =>
  (await frameOf(board)).evaluate(() => {
    const page = window as never as { __events: DrawLog["events"]; __inputs: DrawLog["inputs"] };
    return { events: [...page.__events], inputs: [...page.__inputs] };
  });
