// The `unresolved-pointer` warnings of a send (excerpts, design decision 4, Warnings; FR-8, AD-6):
// one per pointer item its revisions hold unresolved, in item order. The message names the reason in
// plain words: never a path, and never whether a file outside the root exists (design decision 3,
// step 3).

import type {
  BoardQuestionProps,
  UnresolvedPointerWarning,
  UnresolvedReason,
} from "@askboard/contract";
import { boundedWarnings } from "../warning-bound.ts";

export const UNRESOLVED_MESSAGES: Readonly<Record<UnresolvedReason, string>> = {
  "no-root":
    "The session has no project folder (CLAUDE_PROJECT_DIR is not set), so no pointer is read.",
  "invalid-pointer":
    "The pointer is not a relative project path with an anchor that suits the item: an excerpt needs one, an image takes none.",
  "outside-root": "The pointer leads outside the project folder, so it is not read.",
  "not-found": "The pointer names no file in the project folder.",
  "not-a-file": "The pointer names something that is not a regular file, such as a folder.",
  "anchor-not-found": "The file holds no heading or line range matching the anchor.",
  "not-text": "The file is not UTF-8 text.",
  "not-image": "The file is not a PNG, JPEG, GIF or WebP image.",
  "too-large": "The file, the excerpt or the ask's images are over AskBoard's size limits.",
  timeout: "The file was not read within the send's time budget.",
};

/**
 * The most characters the JSON text of an ask's or update's `unresolved-pointer` warnings may take:
 * a third of `RESULT_MAX_CHARS` (AD-6), beside the `formula` warnings' third, which leaves the rest
 * of a result its room (result-bound, design decision 1).
 */
export const UNRESOLVED_WARNINGS_MAX_CHARS = 10_000;

/**
 * The closing warning for `first`, the first warning left out, with `left` warnings after it: its
 * item, pointer and reason, and fixed words that count the rest and point to `fetch`, which returns
 * every pointer's reason. The words name the item and the reason, never a path (AD-12).
 */
export const closingUnresolvedWarning = (
  first: UnresolvedPointerWarning,
  left: number,
): UnresolvedPointerWarning => {
  const { itemId, pointer, reason } = first;
  const head = `The pointer of ${itemId} did not resolve (${reason})`;
  const message =
    left === 1
      ? `${head}, and 1 more unresolved pointer is left out: fetch its question to read its reason.`
      : `${head}, and ${left} more unresolved pointers are left out: fetch their questions to read each one's reason.`;
  return { code: "unresolved-pointer", itemId, pointer, reason, message };
};

/**
 * The warnings within `max` characters of JSON text, measured as `JSON.stringify` writes them,
 * ended by the closing warning `closing` builds. A list within `max` is returned as it is. Past it,
 * the warnings kept in order leave room for the longest closing warning any warning of the list
 * could give and the comma before it: `closing` measured with the list's length as its count (the
 * cut's largest) and with a count of 1 (its other words), whichever is longer, so the bound holds
 * whatever the singular and plural words. One closing warning stands for the first warning left out and counts the
 * rest, so that the kept, the closing one and the count make up the list. Pure, plain ECMAScript.
 */
export const boundedUnresolvedWith = (
  closing: (first: UnresolvedPointerWarning, left: number) => UnresolvedPointerWarning,
  warnings: readonly UnresolvedPointerWarning[],
  max: number,
): readonly UnresolvedPointerWarning[] =>
  boundedWarnings(warnings, {
    max,
    // The longest closing warning, plus the comma that comes before it in the list.
    room:
      1 +
      warnings.reduce(
        (most, warning) =>
          Math.max(
            most,
            JSON.stringify(closing(warning, warnings.length)).length,
            JSON.stringify(closing(warning, 1)).length,
          ),
        0,
      ),
    closing,
  });

/** The warnings within `max` characters of JSON text, closed by `closingUnresolvedWarning`. */
export const boundedUnresolvedWarnings = (
  warnings: readonly UnresolvedPointerWarning[],
  max: number,
): readonly UnresolvedPointerWarning[] =>
  boundedUnresolvedWith(closingUnresolvedWarning, warnings, max);

/**
 * The warnings of these questions' resolved props, in board order then item order, within
 * `UNRESOLVED_WARNINGS_MAX_CHARS` of JSON text: past it, one closing warning counts the rest. The
 * board document still marks every unresolved item.
 */
export const unresolvedWarnings = (
  questions: readonly { readonly props: BoardQuestionProps }[],
): readonly UnresolvedPointerWarning[] =>
  boundedUnresolvedWarnings(
    questions.flatMap(({ props }) =>
      (props.items ?? []).flatMap((item): UnresolvedPointerWarning[] => {
        const { props: itemProps } = item;
        if (!("status" in itemProps) || itemProps.status !== "unresolved") return [];
        const { pointer, reason } = itemProps;
        const message = UNRESOLVED_MESSAGES[reason];
        return [{ code: "unresolved-pointer", itemId: item.id, pointer, reason, message }];
      }),
    ),
    UNRESOLVED_WARNINGS_MAX_CHARS,
  );
