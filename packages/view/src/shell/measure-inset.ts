// The reading panel's inset measured in the view's own document (task 6.5): its header and its
// bottom bar, the last `footer`. DOM only, so it is checked in the browser; `insetFrom` holds the
// arithmetic.

import type { ReferenceInset } from "../view-protocol.ts";
import { insetFrom } from "./inset.ts";

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
