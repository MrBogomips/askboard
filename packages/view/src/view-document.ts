// The board document as the view renders it (design decision 7; AD-7, Questions; F1): E1's board
// document, whose question may also hold widget items in its props' `items`, beside its options or
// instead of them. A widget item is `{type, id, props}`, its type naming the component that
// renders it; the view treats its props as data and leaves their check to that component (design
// decision 6). E1's board document is one: only test documents use the wider shape until the input
// format admits widgets, since the board page validates every board document against E1's schema.
// Plain ECMAScript: `assemble` reads it.

import type { BoardDocument, BoardQuestion, QuestionProps } from "@askboard/contract";

/** A widget item in a question. */
export type WidgetItem = {
  readonly type: string;
  readonly id: string;
  /** Data the widget's component checks before it renders (design decision 6). */
  readonly props: unknown;
};

export type ViewQuestionProps = Omit<QuestionProps, "options"> & {
  readonly options?: QuestionProps["options"];
  readonly items?: readonly WidgetItem[];
};

export type ViewQuestion = Omit<BoardQuestion, "props"> & { readonly props: ViewQuestionProps };

export type ViewDocument = Omit<BoardDocument, "items"> & {
  readonly items: readonly [ViewQuestion];
};
