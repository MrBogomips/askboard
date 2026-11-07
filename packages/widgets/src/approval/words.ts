// The words of the summary's values (view-and-widgets spec: The three widgets' strings; design
// decision 8): a switch reads on or off from the view's string tables in the ask's language, so
// an Italian summary reads "attivo" and "disattivo"; nothing reads the glyph "—", which is no
// string (group 4 review S-2). Pure: the lookup is passed in.

import type { Say } from "@askboard/view/catalog";
import type { ValueWords } from "./values.ts";

/** The glyph an empty value shows as, in every language. */
export const NONE_GLYPH = "—";

/** The words `formatValue` needs, from `text`'s language. */
export const valueWordsOf = (text: Say): ValueWords => ({
  on: text("approval.on"),
  off: text("approval.off"),
  none: NONE_GLYPH,
});
