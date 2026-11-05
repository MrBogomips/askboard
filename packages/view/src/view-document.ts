// The board document as the view renders it (design decision 7; AD-7, Questions; F1): E1's board
// document, whose question may also hold widget items in its props' `items`, beside its options or
// instead of them. A widget item is `{type, id, props}`, its type naming the component that
// renders it; the view treats its props as data and leaves their check to that component (design
// decision 6). E1's board document is one: only test documents use the wider shape until the input
// format admits widgets, since the board page validates every board document against E1's schema.
// Since the ask lifecycle (ask-lifecycle, design decision 6), board document 1.1's shape: several
// questions, or areas holding them, with the presentation and delivery the ask requests.
// Plain ECMAScript: `assemble` reads it.

import type { BoardDocument, BoardQuestion, QuestionProps } from "@askboard/contract";

/** A widget item in a question. */
export type WidgetItem = {
  readonly type: string;
  readonly id: string;
  /** Data the widget's component checks before it renders (design decision 6). */
  readonly props: unknown;
};

export type ViewQuestionProps = Omit<QuestionProps, "options" | "items"> & {
  readonly options?: QuestionProps["options"];
  readonly items?: readonly WidgetItem[];
};

export type ViewQuestion = Omit<BoardQuestion, "props"> & { readonly props: ViewQuestionProps };

/** A titled group of questions (FR-2); it has no revision of its own. */
export type ViewArea = {
  readonly type: "area";
  readonly id: string;
  readonly props: {
    readonly title: string;
    readonly items: readonly [ViewQuestion, ...ViewQuestion[]];
  };
};

export type ViewDocument = Omit<BoardDocument, "items"> & {
  readonly presentation?: "sections" | "tabs" | "one-per-view";
  readonly delivery?: "immediate" | "submitted";
  readonly items: readonly [ViewQuestion, ...ViewQuestion[]] | readonly [ViewArea, ...ViewArea[]];
};

/** Every question of the board, in board order: each area's questions, area by area. */
export const questionsOf = (document: ViewDocument): readonly ViewQuestion[] =>
  document.items.flatMap((item) => (item.type === "area" ? item.props.items : [item]));

/** The area that holds a question, on a board of areas. */
export const areaOf = (document: ViewDocument, questionId: string): ViewArea | undefined =>
  document.items.find(
    (item): item is ViewArea =>
      item.type === "area" && item.props.items.some((question) => question.id === questionId),
  );
