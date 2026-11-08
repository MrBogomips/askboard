// Which catalog component renders each item of a board document (AD-9): the shell renders by it,
// and `assemble` picks the component chunks a board needs by it. The component's name is also its
// chunk's name, the folder under `catalog/`, or under `packages/widgets/src/` for a widget, that
// holds it (E1's design decision 7; the Tree widget's design decisions 7 and 8).

import { nestedWidgetItemsOf } from "../nested-items.ts";
import {
  questionsOf,
  type ViewDocument,
  type ViewQuestion,
  type WidgetItem,
} from "../view-document.ts";

/** The Choice atom: AskBoard's own radio group for one choice, Radix Checkbox for several. */
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

/**
 * What the question's items are at every depth of their layouts, in document order, layouts
 * included (layouts, design decision 6): the card draws `renderedOf` and a layout draws its own
 * items through the port, while the ready tracker and the chunk selection need every one.
 */
export const nestedRenderedOf = (question: ViewQuestion): readonly Rendered[] => [
  ...(question.props.options === undefined ? [] : [{ item: question, component: CHOICE }]),
  ...nestedWidgetItemsOf(question.props.items).map((item) => ({ item, component: item.type })),
];

/** The Text atom: plain text or Markdown, and the renderer of an option's Markdown preview. */
export const TEXT = "text";

// Whether an option of the question shows a preview as Markdown, which Choice draws through the Text
// atom's component (atoms, design decision 5): the item is no item of its own, so `renderedOf` stays.
const hasMarkdownPreview = (question: ViewQuestion): boolean =>
  (question.props.options ?? []).some(
    (option) =>
      option.previewFormat === "markdown" &&
      typeof option.preview === "string" &&
      option.preview !== "",
  );

/**
 * The components a board needs, each once, by name: every question's, areas' included, and `text`
 * for a question whose option previews are Markdown.
 */
export const componentsOf = (document: ViewDocument): string[] =>
  [
    ...new Set(
      questionsOf(document).flatMap((question) => [
        ...nestedRenderedOf(question).map(({ component }) => component),
        ...(hasMarkdownPreview(question) ? [TEXT] : []),
      ]),
    ),
  ].sort();
