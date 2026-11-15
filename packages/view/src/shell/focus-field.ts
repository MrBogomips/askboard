// Takes the user from the reason beside a blocked "Answer" to the field it names (answering-flow-
// fixes, design decision 7; #185). A field in an inactive tab of a Tabs layout first gets its tab:
// focusing the tab selects it (Radix Tabs' automatic activation, as the layout uses it), and one
// animation frame later the field is revealed clear of the bars and focused (decision 2). DOM only,
// so it is checked in the browser.

import { revealAndFocus } from "./reveal.ts";

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// A panel nested in a panel needs one frame per tab; no layout nests deeper than this.
const MAX_TABS = 4;

const itemOf = (card: ParentNode, itemId: string): Element | undefined =>
  [...card.querySelectorAll("[data-askboard-item]")].find(
    (element) => element.getAttribute("data-askboard-item") === itemId,
  );

// The tab of the outermost inactive panel that holds `element`, if any.
const hiddenTabOf = (element: Element): HTMLElement | undefined => {
  let tab: HTMLElement | undefined;
  for (let at = element.closest('[role="tabpanel"]'); at !== null; ) {
    const labelledBy = at.getAttribute("aria-labelledby");
    if (at.getAttribute("data-state") === "inactive" && labelledBy !== null)
      tab = at.ownerDocument.getElementById(labelledBy) ?? tab;
    at = at.parentElement?.closest('[role="tabpanel"]') ?? null;
  }
  return tab;
};

/**
 * Moves focus to the first focusable element of the item `itemId` inside `card`, selecting the
 * tab that holds it first. Does nothing when the card has no such item or the item has no field.
 */
export const focusField = (card: ParentNode, itemId: string, depth = 0): void => {
  const item = itemOf(card, itemId);
  const target = item?.querySelector<HTMLElement>(FOCUSABLE);
  if (item === undefined || target === null || target === undefined) return;
  const tab = hiddenTabOf(item);
  if (tab === undefined) {
    revealAndFocus(target);
    return;
  }
  if (depth >= MAX_TABS) return;
  tab.focus();
  requestAnimationFrame(() => focusField(card, itemId, depth + 1));
};
