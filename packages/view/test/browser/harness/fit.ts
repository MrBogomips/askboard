// The fit measure of the frame, shared by the files that check that no label is clipped
// (answering-flow-visual; palettes). Not a test file.

import type { Board } from "./dom.ts";

/**
 * The elements of the view whose text is wider than their box: inside the outbox every one counts,
 * ellipsis included (its labels are the board's own); elsewhere in the header and the rail only
 * those that do not end in an ellipsis on purpose (agent text).
 */
export const clipped = (board: Board): Promise<string[]> =>
  board.view.locator("body").evaluate((body) => {
    const doc = body.ownerDocument;
    const view = doc.defaultView;
    if (view === null) return [];
    const wide = (element: Element) => element.scrollWidth > element.clientWidth + 1;
    const named = (element: Element) =>
      `${element.tagName.toLowerCase()}[${(element.textContent ?? "").trim().slice(0, 30)}]`;
    const found: string[] = [];
    for (const element of doc.querySelectorAll(
      "[data-askboard-outbox], [data-askboard-outbox] *",
    )) {
      if (wide(element)) found.push(`outbox ${named(element)}`);
    }
    const scoped = ["header", "header *", "[data-askboard-rail]", "[data-askboard-rail] *"];
    for (const element of doc.querySelectorAll(scoped.join(", "))) {
      if (element.closest("[data-askboard-outbox]") !== null) continue;
      const style = view.getComputedStyle(element);
      // An inline box (the ask row's `bdi`, which isolates agent text) has no client width by CSSOM
      // and Firefox gives it a scroll width: the pill around it, which carries the ellipsis, is
      // what is measured (#239).
      if (style.display === "inline") continue;
      const scrolls = style.overflowX === "auto" || style.overflowX === "scroll";
      if (wide(element) && style.textOverflow !== "ellipsis" && !scrolls) {
        found.push(`frame ${named(element)}`);
      }
    }
    return found;
  });
