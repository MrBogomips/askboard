// The inset measured in the view's own document (task 6.5; answering-flow-visual, design decisions
// 11 and 12): its header, and for a move on the board the strip of tabs and the feedback tray. DOM
// only, so it is checked in the browser; `insetFrom` and `boardInsetFrom` hold the arithmetic.

import type { ReferenceInset } from "../view-protocol.ts";
import { boardInsetFrom, insetFrom } from "./inset.ts";

const bottomOf = (doc: Document, selector: string): number | undefined =>
  doc.querySelector(selector)?.getBoundingClientRect().bottom;

/** The inset of the view's document as it stands now: the header's bottom edge. */
export const measureInset = (doc: Document = document): ReferenceInset => {
  const header = bottomOf(doc, "header");
  return insetFrom(header === undefined ? {} : { headerBottom: header });
};

/** The strip of tabs a board with areas as tabs shows under its header (`TabsBody`). */
export const TAB_STRIP = "[data-askboard-tab-strip]";

/** The feedback tray, while it holds a message (`FeedbackTray`). */
export const TRAY = "[data-askboard-tray-box]";

/**
 * The inset a move on the board clears: `measureInset`, the sticky strip of tabs and the tray, when
 * there are any. The panels keep `measureInset`: they sit under the header.
 */
export const measureBoardInset = (doc: Document = document): ReferenceInset => {
  const header = bottomOf(doc, "header");
  const strip = bottomOf(doc, TAB_STRIP);
  const tray = bottomOf(doc, TRAY);
  return boardInsetFrom({
    ...(header === undefined ? {} : { headerBottom: header }),
    ...(strip === undefined ? {} : { stripBottom: strip }),
    ...(tray === undefined ? {} : { trayBottom: tray }),
  });
};
