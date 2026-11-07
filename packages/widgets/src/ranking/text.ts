// The Ranking's counter (view-and-widgets spec: Ranking at the keyboard; ux-update-draft block 2):
// "No changes" until the user gives an order, "Order kept" for the order as sent, "Your changes: N
// moved" otherwise. Pure: the string lookup is passed in.

import type { Say } from "@askboard/view/catalog";

/** The counter's text for a Ranking that holds an order (`held`) with `moved` rows off the agent's place. */
export const counterText = (held: boolean, moved: number, text: Say): string => {
  if (!held) return text("widget.noChanges");
  return moved === 0 ? text("ranking.counterKept") : text("ranking.counterMoved", { count: moved });
};
