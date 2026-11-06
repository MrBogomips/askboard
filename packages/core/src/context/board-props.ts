// A question revision's props as the board document holds them (excerpts, design decision 4,
// Storage; proposal B8): each pointer item merged with what its send resolved, a web reference given
// its kind, and an agent-written excerpt as written. The revision's own props stay as the agent sent
// them, for the resend rule and the kept revisions (AD-20).

import {
  type BoardQuestionItem,
  type BoardQuestionProps,
  type QuestionContentItem,
  type QuestionProps,
  webReferenceKind,
} from "@askboard/contract";
import type {
  ExcerptResolution,
  ImageResolution,
  ReferenceResolution,
  UnresolvedPointer,
} from "./ports.ts";
import type { QuestionContext } from "./resolve.ts";

// Every revision a send creates is resolved before it is stored, so a pointer the revision holds no
// resolution for was not read for it: unresolved, as when the budget ends.
const NOT_READ: UnresolvedPointer = { status: "unresolved", reason: "timeout" };

// The context holds, by item ID, the resolution of the item's own operation.
const boardItemOf = (
  item: QuestionContentItem,
  context: QuestionContext | undefined,
): BoardQuestionItem => {
  const resolution = context?.get(item.id) ?? NOT_READ;
  switch (item.type) {
    case "excerpt":
      return "text" in item.props
        ? { ...item, props: item.props }
        : { ...item, props: { ...item.props, ...(resolution as ExcerptResolution) } };
    case "reference":
      return "url" in item.props
        ? { ...item, props: { ...item.props, kind: webReferenceKind(item.props.url) } }
        : {
            ...item,
            props: { ...item.props, kind: "file", ...(resolution as ReferenceResolution) },
          };
    case "image":
      return { ...item, props: { ...item.props, ...(resolution as ImageResolution) } };
    case "molecule":
      // ask-core expands every reference before it builds the board document (design decision 5).
      throw new Error(`the molecule reference "${item.id}" reached the board document unexpanded`);
    // Any other item is a widget's, whatever its type: it goes through as sent, nothing of it is
    // read or resolved here (widget-registry design decision 2).
    default:
      return item;
  }
};

/** The props with their context items resolved; props without items are given as they are. */
export const boardPropsOf = (
  props: QuestionProps,
  context: QuestionContext | undefined,
): BoardQuestionProps => {
  const { items, ...rest } = props;
  if (items === undefined) return rest;
  const [first, ...others] = items;
  return {
    ...rest,
    items: [boardItemOf(first, context), ...others.map((item) => boardItemOf(item, context))],
  };
};
