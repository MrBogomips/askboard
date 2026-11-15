// Where the board's keys act (board-keys, design decision 2). Pure over an element-like stand-in,
// so a test reaches each case without a DOM.

import { isTextTarget } from "../catalog/keys/press.ts";

/** What the scope reads of an element. */
export type ScopeElement = {
  readonly tagName?: string;
  closest(selector: string): ScopeElement | null;
  getAttribute(name: string): string | null;
};

/**
 * `none`: the key is the control's. `{card}`: the question's own controls. `board`: everywhere
 * else in the view.
 */
export type BoardKeyScope = "none" | "board" | { readonly card: string };

const POPUPS =
  '[role="menu"], [role="listbox"], [role="combobox"], [role="dialog"], [role="alertdialog"], select';
const ITEM = "[data-askboard-item]";
const CARD = "[data-askboard-question]";

export const boardKeyScopeOf = (target: ScopeElement | null | undefined): BoardKeyScope => {
  if (target === null || target === undefined) return "none";
  if (isTextTarget(target) || target.closest(POPUPS) !== null) return "none";
  const card = target.closest(CARD);
  const questionId = card?.getAttribute("data-askboard-question") ?? undefined;
  const item = target.closest(ITEM);
  if (item !== null && item.getAttribute("data-askboard-item") !== questionId) return "none";
  if (card === null || questionId === undefined) return "board";
  if (target.closest("a[href]") !== null || target.closest("[data-askboard-thread]") !== null) {
    return "board";
  }
  return { card: questionId };
};

/**
 * The element a key press is read from: the event's target when it is an element of any kind (HTML,
 * SVG or MathML all have `closest`), else the fallback, the body. A focused SVG or MathML node inside
 * a widget is the widget's, so it is never taken for the body (board-keys, review S-10).
 */
export const scopeTargetOf = <Fallback extends ScopeElement>(
  target: unknown,
  fallback: Fallback,
): ScopeElement | Fallback =>
  typeof target === "object" &&
  target !== null &&
  typeof (target as { closest?: unknown }).closest === "function"
    ? (target as ScopeElement)
    : fallback;
