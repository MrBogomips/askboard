// The Tree's chunk (design decision 6): it registers `tree` through the `CatalogRenderer` port, the
// one part of `view` a widget imports (AD-1, AD-9). The view hands a widget item's props over as
// data, unchecked (design decision 7), so the Tree checks them as an agent's with the contract's
// plain checks, never its schemas, and throws on a problem: the item's error boundary then fails
// it, and its question never counts as visible (AD-10). It shows its value, the draft or the sent
// answer, else the agent's props, as a treegrid in the widget frame, and reports ready once laid
// out.

import { type TreeItem, type TreeProps, treePropsProblems } from "@askboard/contract";
import {
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { FRAME } from "./classes.ts";
import { TreeWidget } from "./widget.tsx";

/** The catalog name, which is the Tree item's type. */
const TREE: TreeItem["type"] = "tree";

/** A Tree item as the view hands it over, its props not checked yet. */
type UncheckedTreeItem = Omit<TreeItem, "props"> & { readonly props: unknown };

type TreeComponentProps = ItemProps<UncheckedTreeItem, TreeProps>;

/** The props as an agent's Tree, or an error naming each problem. */
const checkedProps = (itemId: string, props: unknown): TreeProps => {
  const problems = treePropsProblems(props, "agent");
  if (problems.length === 0) return props as TreeProps;
  const listed = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
  throw new Error(`the Tree "${itemId}" refuses its props: ${listed}`);
};

const Tree = ({ item, questionId, value, onValueChange, disabled, ready }: TreeComponentProps) => {
  // The check throws before the item can report ready.
  const sent = useMemo(() => checkedProps(item.id, item.props), [item.id, item.props]);
  useReadyAfterLayout(ready);
  return (
    <div className={FRAME}>
      <TreeWidget
        itemId={item.id}
        sent={sent}
        value={value ?? sent}
        labelledBy={questionTextId(questionId)}
        disabled={disabled}
        onValueChange={onValueChange}
      />
    </div>
  );
};

register(TREE, Tree);
