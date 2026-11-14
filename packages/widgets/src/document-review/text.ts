// The Document review's words (view-and-widgets spec: Commenting on a passage, Passages the board
// does not anchor; ux-update-draft.md block 1): the counter, a pin's name and the message that
// says why a passage was not anchored. Pure: the string lookup is passed in, so every text is in
// the view's tables in both languages (FR-34).

import type { DocumentReviewAnnotation } from "@askboard/contract";
import type { Say } from "@askboard/view/catalog";
import type { Refusal } from "./model.ts";

/** Whether the annotation is a suggested edit: its body holds a `replacement`, an empty one included. */
export const isSuggestion = (annotation: DocumentReviewAnnotation): boolean =>
  typeof annotation.body?.replacement === "string";

/**
 * The counter: "No comments yet", or "Your changes: 2 comments, 1 suggested edit", each count
 * left out while it is zero.
 */
export const counterText = (annotations: readonly DocumentReviewAnnotation[], say: Say): string => {
  if (annotations.length === 0) return say("documentReview.counterNone");
  const edits = annotations.filter(isSuggestion).length;
  const comments = annotations.length - edits;
  const parts = [
    ...(comments > 0 ? [say("documentReview.counterComments", { count: comments })] : []),
    ...(edits > 0 ? [say("documentReview.counterEdits", { count: edits })] : []),
  ];
  return say("documentReview.counter", { changes: parts.join(", ") });
};

/** A pin's name, and its card's header: "Comment 1" or "Suggested edit 2". */
export const pinLabel = (suggested: boolean, number: number, say: Say): string =>
  say(suggested ? "documentReview.pinEdit" : "documentReview.pinComment", { number });

/**
 * Why a passage was not anchored, as the message beside the toolbar. A passage too long is worded
 * for the block the keyboard anchored (`fromBlock`) differently from a selection the user made.
 */
export const refusalText = (refusal: Refusal, fromBlock: boolean, say: Say): string => {
  switch (refusal.code) {
    case "blank":
      return say("documentReview.refuseBlank");
    case "too-long":
      return say(fromBlock ? "documentReview.refuseBlock" : "documentReview.refuseTooLong");
    case "repeated":
      return say("documentReview.refuseRepeated");
    case "limit":
      return say("documentReview.refuseLimit");
    case "outside":
      return say("documentReview.refuseNone");
    case "several-ranges":
      return say("documentReview.refuseSeveral");
    case "overlaps":
      return say("documentReview.refuseOverlaps", { number: refusal.pin });
  }
};
