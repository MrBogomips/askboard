// Which catalog component renders each item of a board document (AD-9): the shell renders by it,
// and `assemble` picks the component chunks a board needs by it. The component's name is also its
// chunk's name, the folder under `catalog/`, or under `packages/widgets/src/` for a widget, that
// holds it (E1's design decision 7; the Tree widget's design decisions 7 and 8).

import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";

/** The Choice atom: Radix Radio Group for one choice, Checkbox for several (design decision 8). */
export const CHOICE = "choice";

/** An item the renderer shows through the port, with the component that renders it. */
export type Rendered = {
  readonly item: ViewQuestion | WidgetItem;
  readonly component: string;
};

/**
 * What a question renders, in its card's order: its options, if it has any, with the Choice atom,
 * then each widget item with the component its type names (design decision 7). The question's
 * place, not an item's type, picks Choice: a widget item typed `question` names a component too.
 */
export const renderedOf = (question: ViewQuestion): readonly Rendered[] => [
  ...(question.props.options === undefined ? [] : [{ item: question, component: CHOICE }]),
  ...(question.props.items ?? []).map((item) => ({ item, component: item.type })),
];

/** The components a board needs, each once, by name. */
export const componentsOf = (document: ViewDocument): string[] =>
  [
    ...new Set(
      document.items.flatMap((question) => renderedOf(question).map(({ component }) => component)),
    ),
  ].sort();
