// The treegrid's focus and expansion (design decision 5; proposal, open questions 8, 9 and 10):
// view state the component holds beside the draft, never in it. The focus is on a row or on one
// of its cells, 0 the name and then one per column, and follows the WAI-ARIA treegrid pattern:
// Up and Down move between visible rows in the same column, Home and End to the first and last
// row or cell, Right expands a closed row or enters its cells, Left collapses an open row, goes to
// the parent or leaves the cells. Each function returns a new frozen view, or the same view when
// nothing changes. Also here: where focus goes after a delete, and the toolbar's roving focus.

import type { TreeProps } from "@askboard/contract";
import type { FocusMove, ToolbarMove } from "./keys.ts";
import { locate, nodeIds } from "./nodes.ts";
import { openingCollapsed, type TreeRow, visibleRows } from "./rows.ts";

/** A row, or one of its cells when `cell` is set: 0 is the name, then one cell per column. */
export type TreeFocus = { readonly nodeId: string; readonly cell?: number };

export type TreeView = {
  /** `undefined` only in an empty Tree. */
  readonly focus: TreeFocus | undefined;
  /** The collapsed nodes: every other node is expanded (open question 8). */
  readonly collapsed: ReadonlySet<string>;
};

const focusOf = (nodeId: string, cell: number | undefined): TreeFocus =>
  Object.freeze(cell === undefined ? { nodeId } : { nodeId, cell });

const sameFocus = (a: TreeFocus | undefined, b: TreeFocus | undefined): boolean =>
  a?.nodeId === b?.nodeId && a?.cell === b?.cell;

// The view with `focus` and `collapsed`, or `view` itself when neither changes. A focus the caller
// made is copied, never frozen in place.
const updated = (
  view: TreeView,
  focus: TreeFocus | undefined,
  collapsed: ReadonlySet<string>,
): TreeView => {
  if (sameFocus(focus, view.focus) && collapsed === view.collapsed) return view;
  const frozen =
    focus === undefined || Object.isFrozen(focus) ? focus : focusOf(focus.nodeId, focus.cell);
  return Object.freeze({ focus: frozen, collapsed });
};

// The collapsed set with `ids` expanded, or the same set when none of them was collapsed.
const expanding = (collapsed: ReadonlySet<string>, ids: Iterable<string>): ReadonlySet<string> => {
  const next = new Set(collapsed);
  for (const id of ids) next.delete(id);
  return next.size === collapsed.size ? collapsed : next;
};

const collapsing = (collapsed: ReadonlySet<string>, id: string): ReadonlySet<string> =>
  collapsed.has(id) ? collapsed : new Set([...collapsed, id]);

/**
 * The view of a Tree as it opens: the first row focused, nothing collapsed but, in a work
 * breakdown, the levels from its `openDepth` down (`openingCollapsed`).
 */
export const openView = (value: TreeProps): TreeView => {
  const first = value.nodes[0];
  return Object.freeze({
    focus: first === undefined ? undefined : focusOf(first.id, undefined),
    collapsed: openingCollapsed(value),
  });
};

/** A new focus, or a new collapsed set with the focus staying. */
type Step = { readonly focus: TreeFocus } | { readonly collapsed: ReadonlySet<string> } | undefined;

const toRow = (row: TreeRow | undefined, cell?: number): Step =>
  row === undefined ? undefined : { focus: focusOf(row.node.id, cell) };

const rowStep = (
  rows: readonly TreeRow[],
  at: number,
  collapsed: ReadonlySet<string>,
  move: FocusMove,
): Step => {
  const row = rows[at];
  if (row === undefined) return undefined;
  const id = row.node.id;
  switch (move) {
    case "up":
      return toRow(rows[at - 1]);
    case "down":
      return toRow(rows[at + 1]);
    case "home":
      return toRow(rows[0]);
    case "end":
      return toRow(rows.at(-1));
    case "right":
      return row.hasChildren && !row.expanded
        ? { collapsed: expanding(collapsed, [id]) }
        : { focus: focusOf(id, 0) };
    case "left":
      if (row.expanded) return { collapsed: collapsing(collapsed, id) };
      return row.parentId === undefined ? undefined : { focus: focusOf(row.parentId, undefined) };
  }
};

const cellStep = (
  rows: readonly TreeRow[],
  at: number,
  cell: number,
  cells: number,
  move: FocusMove,
): Step => {
  const row = rows[at];
  if (row === undefined) return undefined;
  const id = row.node.id;
  switch (move) {
    case "up":
      return toRow(rows[at - 1], cell);
    case "down":
      return toRow(rows[at + 1], cell);
    case "home":
      return { focus: focusOf(id, 0) };
    case "end":
      return { focus: focusOf(id, cells - 1) };
    case "right":
      return { focus: focusOf(id, Math.min(cell + 1, cells - 1)) };
    case "left":
      return { focus: focusOf(id, cell === 0 ? undefined : cell - 1) };
  }
};

/**
 * The view after the focus move `move` in the visible rows of `value`; the same view at an edge,
 * with no focus, or with the focus on a node not shown.
 */
export const navigate = (view: TreeView, move: FocusMove, value: TreeProps): TreeView => {
  const { focus, collapsed } = view;
  if (focus === undefined) return view;
  const rows = visibleRows(value.nodes, collapsed);
  const at = rows.findIndex((row) => row.node.id === focus.nodeId);
  const cells = 1 + (value.columns?.length ?? 0);
  const step =
    focus.cell === undefined
      ? rowStep(rows, at, collapsed, move)
      : cellStep(rows, at, focus.cell, cells, move);
  if (step === undefined) return view;
  return "focus" in step
    ? updated(view, step.focus, collapsed)
    : updated(view, focus, step.collapsed);
};

/**
 * A click on the chevron of `nodeId`: expands it when collapsed, else collapses it, moving a focus
 * it hides to the node, in the same column. The same view for a leaf or an unknown node.
 */
export const toggle = (view: TreeView, nodeId: string, value: TreeProps): TreeView => {
  const node = locate(value.nodes, nodeId)?.node;
  if (node === undefined || node.children === undefined) return view;
  if (view.collapsed.has(nodeId))
    return updated(view, view.focus, expanding(view.collapsed, [nodeId]));
  const { focus } = view;
  const hidden = focus !== undefined && [...nodeIds(node.children)].includes(focus.nodeId);
  const next = hidden ? focusOf(nodeId, focus.cell) : focus;
  return updated(view, next, collapsing(view.collapsed, nodeId));
};

/**
 * Focuses `nodeId`, or its cell `cell`, expanding its ancestors so that it shows: focus follows a
 * node after a move, an indent ("which expands") or an add ("Add child" expands the current
 * node). The same view for an unknown node.
 */
export const focusOn = (
  view: TreeView,
  value: TreeProps,
  nodeId: string,
  cell?: number,
): TreeView => {
  const ancestors: string[] = [];
  let place = locate(value.nodes, nodeId);
  if (place === undefined) return view;
  while (place?.parentId !== undefined) {
    ancestors.push(place.parentId);
    place = locate(value.nodes, place.parentId);
  }
  return updated(view, focusOf(nodeId, cell), expanding(view.collapsed, ancestors));
};

/**
 * The view once `nodeId` is deleted, computed on the value that still holds it: focus on its next
 * sibling, else its previous one, else its parent, in the same column, or nowhere when the Tree
 * becomes empty; the removed branch's nodes leave the collapsed set. The same view for an unknown
 * node.
 */
export const focusAfterRemove = (view: TreeView, value: TreeProps, nodeId: string): TreeView => {
  const place = locate(value.nodes, nodeId);
  if (place === undefined) return view;
  const sibling = place.siblings[place.index + 1] ?? place.siblings[place.index - 1];
  const target = sibling?.id ?? place.parentId;
  const focus = target === undefined ? undefined : focusOf(target, view.focus?.cell);
  return updated(view, focus, expanding(view.collapsed, nodeIds([place.node])));
};

const enabledAt = (enabled: readonly boolean[]): number[] =>
  enabled.flatMap((on, at) => (on ? [at] : []));

/**
 * The tool the toolbar's focus moves to from `current` on `move`, skipping disabled tools and
 * stopping at the ends (open question 10); `current` when no other tool fits.
 */
export const toolbarFocus = (
  enabled: readonly boolean[],
  current: number,
  move: ToolbarMove,
): number => {
  const tools = enabledAt(enabled);
  switch (move) {
    case "previous":
      return tools.findLast((at) => at < current) ?? current;
    case "next":
      return tools.find((at) => at > current) ?? current;
    case "first":
      return tools[0] ?? current;
    case "last":
      return tools.at(-1) ?? current;
  }
};

/**
 * The tool that holds the toolbar's Tab stop: `current` while enabled, else the nearest enabled
 * tool after it, else before it; `undefined` when every tool is disabled, as in a read-only Tree.
 */
export const toolbarStop = (enabled: readonly boolean[], current: number): number | undefined => {
  if (enabled[current] === true) return current;
  const tools = enabledAt(enabled);
  return tools.find((at) => at > current) ?? tools.findLast((at) => at < current);
};
