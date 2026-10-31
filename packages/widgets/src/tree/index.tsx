// The Tree's chunk (design decision 6): it registers `tree` through the `CatalogRenderer` port, the
// one part of `view` a widget imports (AD-1, AD-9). The view hands a widget item's props over as
// data, unchecked (design decision 7), so the Tree checks them as an agent's with the contract's
// plain checks, never its schemas, and throws on a problem: the item's error boundary then fails
// it, and its question never counts as visible (AD-10). For now it shows the node names as text,
// nested as the Tree nests them, and reports ready once laid out; the treegrid comes later.

import {
  type TreeItem,
  type TreeNode,
  type TreeProps,
  treePropsProblems,
} from "@askboard/contract";
import { type ItemProps, register, useReadyAfterLayout } from "@askboard/view/catalog";
import { useMemo } from "react";

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

// Each name is a text child, which React escapes: no agent string becomes markup (AD-8).
const Nodes = ({ nodes }: { readonly nodes: readonly TreeNode[] }) => (
  <ul className="flex flex-col gap-1 pl-4">
    {nodes.map((node) => (
      <li key={node.id} className="text-body text-foreground">
        {node.label}
        {node.children === undefined ? null : <Nodes nodes={node.children} />}
      </li>
    ))}
  </ul>
);

const Tree = ({ item, ready }: TreeComponentProps) => {
  const props = useMemo(() => checkedProps(item.id, item.props), [item.id, item.props]);
  useReadyAfterLayout(ready);
  return <Nodes nodes={props.nodes} />;
};

register(TREE, Tree);
