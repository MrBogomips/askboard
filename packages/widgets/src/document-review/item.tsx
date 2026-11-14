// The Document review's component (view-and-widgets spec: A Document review's document; design
// decision 7): the item as the view hands it over, its props not checked yet. The chunk's entry,
// `index.tsx`, registers it with the facts the shell needs (task 6.3).

import type { ItemProps } from "@askboard/view/catalog";
import { useMemo } from "react";
import { checkedProps } from "./props.ts";
import { DocumentReviewWidget } from "./widget.tsx";

/** A Document review item as the view hands it over, its props not checked yet. */
export type UncheckedDocumentReviewItem = {
  readonly type: "document-review";
  readonly id: string;
  readonly props: unknown;
};

export const DocumentReview = ({
  item,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedDocumentReviewItem>) => {
  // The props object itself is given on, since the reading and the places are kept per object.
  const props = useMemo(() => checkedProps(item.id, item.props), [item.id, item.props]);
  return (
    <DocumentReviewWidget
      itemId={item.id}
      props={props}
      result={result}
      disabled={disabled}
      onResultChange={onResultChange}
      ready={ready}
    />
  );
};
