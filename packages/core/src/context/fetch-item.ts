// What `fetch` returns of a question's context (excerpts, design decision 4, `fetch`; AD-6): the
// board document's items without an excerpt's text, written or read, or an image's bytes, at any
// depth, with their statuses, reasons and lines. The agent has the pointers it sent; the text and
// the bytes stay in the board document.

import type {
  FetchContextItem,
  FetchItem,
  FetchQuestion,
  FetchQuestionProps,
} from "@askboard/contract";

// A board document's item, typed as fetch's: the types let the text and bytes through, since an
// object may hold more than its type names, so each is dropped here by name.
const contextItemOf = (item: FetchContextItem): FetchContextItem => {
  switch (item.type) {
    case "excerpt": {
      const { text: _, ...props } = item.props as typeof item.props & { readonly text?: string };
      return { ...item, props };
    }
    case "image": {
      const { bytes: _, ...props } = item.props as typeof item.props & { readonly bytes?: string };
      return { ...item, props };
    }
    // A reference, and any widget item whatever its type (widget-registry design decision 2):
    // nothing to drop.
    default:
      return item;
  }
};

const propsOf = (props: FetchQuestionProps): FetchQuestionProps => {
  const { items } = props;
  if (items === undefined) return props;
  const [first, ...others] = items;
  return { ...props, items: [contextItemOf(first), ...others.map(contextItemOf)] };
};

const questionOf = (question: FetchQuestion): FetchQuestion => ({
  ...question,
  props: propsOf(question.props),
});

/** The item without its questions' excerpt text and image bytes. */
export const fetchItemOf = (item: FetchItem): FetchItem => {
  if (item.type === "question") return { ...item, props: propsOf(item.props) };
  // A widget item fetched alone holds no excerpt text or image bytes (widget-answers).
  if (item.type !== "area") return item;
  const [first, ...others] = item.props.items;
  return {
    ...item,
    props: { ...item.props, items: [questionOf(first), ...others.map(questionOf)] },
  };
};
