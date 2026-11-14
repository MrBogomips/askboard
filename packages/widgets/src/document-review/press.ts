// What "Comment" and "Suggest edit" do (view-and-widgets spec: Commenting on a passage, Suggesting
// an edit, Passages the board does not anchor, A Document review at the keyboard; design decisions
// 4 and 9): which passage they act on, and the card they open or the refusal they give. Pure.

import type { AnnotationPlace, DocumentReviewAnnotation } from "@askboard/contract";
import { anchorPassage, type Card, nextId, type Refusal } from "./model.ts";
import type { Selected } from "./reading.ts";

/** The passage a press acts on: a range of the reading text, and whether the keyboard chose it. */
export type Passage = { readonly start: number; readonly end: number; readonly fromBlock: boolean };

export type Passaged =
  | ({ readonly ok: true } & Passage)
  | { readonly ok: false; readonly refusal: Refusal };

/**
 * The passage to act on: the user's selection while there is one; else, with no text selected,
 * the current block's trimmed text. Several ranges or a selection outside the document are
 * refused, whatever the block, and so is a press with no block to take.
 */
export const passageOf = (
  selected: Selected | undefined,
  blocks: readonly { readonly start: number; readonly end: number }[],
  current: number,
): Passaged => {
  if (selected?.ok === true) {
    return { ok: true, start: selected.start, end: selected.end, fromBlock: false };
  }
  if (selected?.reason === "several-ranges" || selected?.reason === "outside") {
    return { ok: false, refusal: { code: selected.reason } };
  }
  const block = blocks[current];
  return block === undefined
    ? { ok: false, refusal: { code: "outside" } }
    : { ok: true, start: block.start, end: block.end, fromBlock: true };
};

export type Started =
  | { readonly ok: true; readonly card: Card }
  | { readonly ok: false; readonly refusal: Refusal; readonly fromBlock: boolean };

/**
 * The card a press opens for `passage` of `text`: empty for a comment, and for a suggested edit
 * with the passage's text as its replacement (design decision 9); or the refusal `anchorPassage`
 * gives. The new ID is the lowest `u-` number no held annotation has.
 */
export const startCard = (
  kind: Card["kind"],
  text: string,
  annotations: readonly DocumentReviewAnnotation[],
  places: readonly AnnotationPlace[],
  passage: Passage,
): Started => {
  const anchored = anchorPassage(text, annotations, places, passage.start, passage.end);
  if (!anchored.ok) {
    return { ok: false, refusal: anchored.refusal, fromBlock: passage.fromBlock };
  }
  const id = nextId(annotations);
  const { quote } = anchored;
  return {
    ok: true,
    card:
      kind === "comment"
        ? { id, quote, kind, text: "" }
        : { id, quote, kind, text: "", replacement: quote.exact },
  };
};
