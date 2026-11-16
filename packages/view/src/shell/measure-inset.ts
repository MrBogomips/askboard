// The reading panel's inset measured in the view's own document (task 6.5): its header and its
// bottom bar, the last `footer`. DOM only, so it is checked in the browser; `insetFrom` holds the
// arithmetic.

import type { ReferenceInset } from "../view-protocol.ts";
import { boardInsetFrom, insetFrom } from "./inset.ts";

/** The inset of the view's document as it stands now. */
export const measureInset = (doc: Document = document): ReferenceInset => {
  const header = doc.querySelector("header");
  const footers = doc.querySelectorAll("footer");
  const footer = footers.item(footers.length - 1);
  return insetFrom({
    ...(header === null ? {} : { headerBottom: header.getBoundingClientRect().bottom }),
    ...(footer === null ? {} : { footerTop: footer.getBoundingClientRect().top }),
    viewportHeight: doc.defaultView?.innerHeight ?? 0,
  });
};

/** The strip of tabs a board with areas as tabs shows under its header (`TabsBody`). */
export const TAB_STRIP = "[data-askboard-tab-strip]";

/**
 * The inset a move on the board clears: `measureInset` and the sticky strip of tabs, when there is
 * one. The reading panel keeps `measureInset`: it sits between the header and the bottom bar.
 */
export const measureBoardInset = (doc: Document = document): ReferenceInset => {
  const header = doc.querySelector("header");
  const footers = doc.querySelectorAll("footer");
  const footer = footers.item(footers.length - 1);
  const strip = doc.querySelector(TAB_STRIP);
  return boardInsetFrom({
    ...(header === null ? {} : { headerBottom: header.getBoundingClientRect().bottom }),
    ...(footer === null ? {} : { footerTop: footer.getBoundingClientRect().top }),
    ...(strip === null ? {} : { stripBottom: strip.getBoundingClientRect().bottom }),
    viewportHeight: doc.defaultView?.innerHeight ?? 0,
  });
};
