// How the browser tests measure the group question's layout (wbs-gantt-consistency, review 3.3 S-1;
// view spec, "The group question's layout"): the boxes of the question's paragraph, its name, its
// two buttons and the toolbar row, read in the view as the page lays them out.

import { expect } from "bun:test";
import type { Board } from "./dom.ts";

export type GroupLayout = {
  /** Every client rect of the leaf's name lies inside the paragraph's box. */
  readonly nameInside: boolean;
  /** The name is not cut: its content fits its own box (an inline name has no box of its own). */
  readonly nameWhole: boolean;
  /** The paragraph's content fits its width: nothing is cut or overflows. */
  readonly paragraphFits: boolean;
  /** Both buttons start at or below the paragraph's bottom edge: they sit on a line under it. */
  readonly buttonsUnder: boolean;
  /** The paragraph's text rects that intersect a button's box. */
  readonly underButtons: number;
  /** The paragraph, the buttons and everything else the toolbar row holds lie inside its box. */
  readonly insideToolbar: boolean;
  /** The toolbar row's width in pixels. */
  readonly toolbarWidth: number;
  /** The paragraph's text lines, as the rects `Range` gives for its text. */
  readonly lines: number;
};

/** Runs in the view: reads the layout of the group question that is showing. */
const measure = (): GroupLayout | undefined => {
  const words = /becomes a group:|diventa un gruppo:/;
  const fieldset = [...document.querySelectorAll("fieldset[aria-labelledby]")].find((candidate) =>
    words.test(
      document.getElementById(candidate.getAttribute("aria-labelledby") ?? "")?.textContent ?? "",
    ),
  );
  const paragraph = document.getElementById(fieldset?.getAttribute("aria-labelledby") ?? "");
  const toolbar = fieldset?.parentElement;
  const name = paragraph?.firstElementChild;
  if (fieldset === undefined || paragraph === null || toolbar == null || !name) return undefined;
  const EPS = 0.5;
  type Box = { left: number; right: number; top: number; bottom: number };
  const inside = (box: Box, outer: Box): boolean =>
    box.left >= outer.left - EPS &&
    box.right <= outer.right + EPS &&
    box.top >= outer.top - EPS &&
    box.bottom <= outer.bottom + EPS;
  const meets = (a: Box, b: Box): boolean =>
    a.left < b.right - EPS &&
    a.right > b.left + EPS &&
    a.top < b.bottom - EPS &&
    a.bottom > b.top + EPS;
  const box = paragraph.getBoundingClientRect();
  const toolbarBox = toolbar.getBoundingClientRect();
  const buttons = [...fieldset.querySelectorAll("button")].map((button) =>
    button.getBoundingClientRect(),
  );
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const text = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
  const everything = [...toolbar.querySelectorAll("*")].map((element) =>
    element.getBoundingClientRect(),
  );
  return {
    nameInside: [...name.getClientRects()].every((rect) => inside(rect, box)),
    nameWhole: name.scrollWidth <= name.clientWidth + 1,
    paragraphFits: paragraph.scrollWidth <= paragraph.clientWidth,
    buttonsUnder: buttons.length === 2 && buttons.every((button) => button.top >= box.bottom - EPS),
    underButtons: text.filter((rect) => buttons.some((button) => meets(rect, button))).length,
    insideToolbar:
      inside(box, toolbarBox) &&
      buttons.every((button) => inside(button, toolbarBox)) &&
      everything.every((rect) => rect.width === 0 || inside(rect, toolbarBox)),
    toolbarWidth: toolbarBox.width,
    lines: new Set(text.map((rect) => Math.round(rect.top))).size,
  };
};

/** The layout of the group question that is showing in the view. */
export const groupLayout = async (board: Board): Promise<GroupLayout> => {
  const layout = await (await board.viewFrame()).evaluate(measure);
  if (layout === undefined) throw new Error("no group question is showing");
  return layout;
};

/**
 * The question's sentence wraps and stays whole: the name inside its paragraph, no text under a
 * button, nothing past the toolbar row (view spec, "At the viewport floor").
 */
export const expectWrapped = (layout: GroupLayout): void => {
  expect(layout.nameInside).toBe(true);
  expect(layout.nameWhole).toBe(true);
  expect(layout.paragraphFits).toBe(true);
  expect(layout.buttonsUnder).toBe(true);
  expect(layout.underButtons).toBe(0);
  expect(layout.insideToolbar).toBe(true);
};

/**
 * Runs in the view: whether the question reads in order on the page: the opening quote and the
 * closing quote of the name, each before every character of AskBoard's words, which follow in
 * order with the period last. A character comes after another when it is on a later line, or on
 * the same line and further right. React renders `“{label}”` as three text nodes, so the opening
 * quote is the last character of the name's first text node (its only one) and the closing quote
 * is the last character of its last text node; a name whose last text node does not end in the
 * closing quote reads wrong. A quote that is not the character it should be is reported, not read.
 */
const readOrder = (): boolean | undefined => {
  const fieldset = [...document.querySelectorAll("fieldset[aria-labelledby]")].find((candidate) =>
    /becomes a group:|diventa un gruppo:/.test(candidate.textContent ?? ""),
  );
  const paragraph = document.getElementById(fieldset?.getAttribute("aria-labelledby") ?? "");
  const nameBox = paragraph?.firstElementChild;
  const opening = nameBox?.firstChild;
  const closing = nameBox?.lastChild;
  const words = paragraph?.lastElementChild?.firstChild;
  if (
    opening?.nodeType !== Node.TEXT_NODE ||
    closing?.nodeType !== Node.TEXT_NODE ||
    words?.nodeType !== Node.TEXT_NODE
  ) {
    return undefined;
  }
  const rectOf = (node: Node, index: number): DOMRect => {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    return range.getBoundingClientRect();
  };
  const text = words.textContent ?? "";
  if (text.at(-1) !== ".") return false;
  if (!(opening.textContent ?? "").startsWith("\u201C")) return false;
  const closingText = closing.textContent ?? "";
  if (opening === closing || !closingText.endsWith("\u201D")) return false;
  const spoken: DOMRect[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index]?.trim() !== "") spoken.push(rectOf(words, index));
  }
  const after = (before: DOMRect, rect: DOMRect): boolean =>
    Math.abs(before.top - rect.top) < 2 ? before.left <= rect.left : before.top < rect.top;
  const inOrder = (rects: readonly DOMRect[]): boolean =>
    rects.every((rect, index) => {
      const before = rects[index - 1];
      return before === undefined || after(before, rect);
    });
  // Each quote first, then each visible character of the words in turn.
  return (
    inOrder([rectOf(opening, 0), ...spoken]) &&
    inOrder([rectOf(closing, closingText.length - 1), ...spoken])
  );
};

/**
 * Moves the closing quote out of the name and after AskBoard's words: the markup change that
 * puts only that quote after them (review 3.15 S-1). Runs in the view; returns false when the
 * question's markup is not as expected.
 */
export const moveClosingQuoteAfterWords = async (board: Board): Promise<boolean> =>
  (await board.viewFrame()).evaluate(() => {
    const fieldset = [...document.querySelectorAll("fieldset[aria-labelledby]")].find((candidate) =>
      /becomes a group:|diventa un gruppo:/.test(candidate.textContent ?? ""),
    );
    const paragraph = document.getElementById(fieldset?.getAttribute("aria-labelledby") ?? "");
    const quote = paragraph?.firstElementChild?.lastChild;
    if (!paragraph || quote?.nodeType !== Node.TEXT_NODE || quote.textContent !== "\u201D") {
      return false;
    }
    paragraph.append(quote);
    return true;
  });

/** Whether the group question's own words read left to right, whatever the leaf's name holds. */
export const wordsReadLeftToRight = async (board: Board): Promise<boolean> => {
  const order = await (await board.viewFrame()).evaluate(readOrder);
  if (order === undefined) throw new Error("no group question is showing");
  return order;
};
