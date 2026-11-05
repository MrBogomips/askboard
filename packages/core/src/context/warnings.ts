// The `unresolved-pointer` warnings of a send (excerpts, design decision 4, Warnings; FR-8, AD-6):
// one per pointer item its revisions hold unresolved, in item order. The message names the reason in
// plain words: never a path, and never whether a file outside the root exists (design decision 3,
// step 3).

import type {
  BoardQuestionProps,
  UnresolvedPointerWarning,
  UnresolvedReason,
} from "@askboard/contract";

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

/** The warnings of these questions' resolved props, in board order then item order. */
export const unresolvedWarnings = (
  questions: readonly { readonly props: BoardQuestionProps }[],
): UnresolvedPointerWarning[] =>
  questions.flatMap(({ props }) =>
    (props.items ?? []).flatMap((item) => {
      const { props: itemProps } = item;
      if (!("status" in itemProps) || itemProps.status !== "unresolved") return [];
      const { pointer, reason } = itemProps;
      const message = UNRESOLVED_MESSAGES[reason];
      return [{ code: "unresolved-pointer", itemId: item.id, pointer, reason, message }];
    }),
  );
