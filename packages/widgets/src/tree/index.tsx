// The Tree's chunk (design decision 6): it registers `tree` through the `CatalogRenderer` port, the
// one part of `view` a widget imports (AD-1, AD-9). The view hands a widget item's props over as
// data, unchecked (design decision 7), so the Tree checks them as an agent's with the contract's
// plain checks, never its schemas, and throws on a problem: the item's error boundary then fails
// it, and its question never counts as visible (AD-10). It shows its value, the draft or the sent
// answer, else the agent's props, as a treegrid in the widget frame, and reports ready once laid
// out. A work breakdown, a Tree with `pert`, reads the board's graph through the `board-graph`
// chunk, the one build the plan on its board reads too (molecules, design decisions 13 and 14).

import {
  type TreeItem,
  type TreeProps,
  treeDerivedFields,
  treePropsProblems,
} from "@askboard/contract";
import {
  type BoardContent,
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { type BoardGraph, liveGraph } from "../graph/index.ts";
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

/**
 * A work breakdown's live graph, memoized by the board (`board-graph.ts`); none for a Tree that
 * computes nothing. It throws when the board cannot be computed, as the plan's does.
 */
const pertGraph = (
  itemId: string,
  sent: TreeProps,
  board: BoardContent,
): BoardGraph | undefined => {
  if (treeDerivedFields(sent) === undefined) return undefined;
  const graph = liveGraph(board);
  if (graph === undefined) throw new Error(`the board's graph holds no work breakdown "${itemId}"`);
  return graph;
};

const Tree = ({
  item,
  questionId,
  value,
  onValueChange,
  disabled,
  ready,
  board,
}: TreeComponentProps) => {
  // The checks throw before the item can report ready: its props, then its board's graph.
  const sent = useMemo(() => checkedProps(item.id, item.props), [item.id, item.props]);
  const graph = pertGraph(item.id, sent, board);
  useReadyAfterLayout(ready);
  return (
    <TreeWidget
      itemId={item.id}
      sent={sent}
      value={value ?? sent}
      labelledBy={questionTextId(questionId)}
      disabled={disabled}
      graph={graph}
      onValueChange={onValueChange}
    />
  );
};

register(TREE, Tree);
