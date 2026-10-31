// The Tree's state and its treegrid (design decisions 5 and 6). The value is the draft, or the sent
// answer, else the agent's props; the view, the focus and the collapsed nodes, is the component's
// own and never goes in the draft (open question 8), so expanding and collapsing change nothing an
// answer carries. The treegrid has one Tab stop, the focused row or cell, and its keys and clicks
// change the view through the model (`keys.ts`, `focus.ts`); the DOM focus follows the view's
// after a key, after a click that hides the focused row and after the cell editor closes by key
// (`editing.tsx`), whose keys are its own while it is open.

import type { TreeColumn, TreeProps } from "@askboard/contract";
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCellEditing } from "./editing.tsx";
import { TreeGrid } from "./grid.tsx";
import { treeKeyOf } from "./key-event.ts";
import { focusOn, navigate, openView, type TreeView, toggle } from "./model/focus.ts";
import { keyAction } from "./model/keys.ts";
import { type TreeRow, visibleRows } from "./model/rows.ts";
import { chevronNodeOf, focusTargetOf } from "./targets.ts";

const NO_COLUMNS: readonly TreeColumn[] = [];

// The view with its focus on a row that shows: a focus the value no longer holds goes to the
// first row, so that the treegrid keeps its Tab stop.
const shownView = (view: TreeView, rows: readonly TreeRow[]): TreeView => {
  const { focus } = view;
  if (focus !== undefined && rows.some((row) => row.node.id === focus.nodeId)) return view;
  const first = rows[0]?.node.id;
  if (focus === undefined && first === undefined) return view;
  return Object.freeze({ ...view, focus: first === undefined ? undefined : { nodeId: first } });
};

export const TreeWidget = ({
  itemId,
  sent,
  value,
  labelledBy,
  disabled,
  onValueChange,
}: {
  readonly itemId: string;
  /** The agent's props, checked. */
  readonly sent: TreeProps;
  readonly value: TreeProps;
  /** The ID of the question's text, which names the treegrid. */
  readonly labelledBy: string;
  /** The question is answered, being sent or locked: the Tree edits nothing. */
  readonly disabled: boolean;
  readonly onValueChange: (value: TreeProps | undefined) => void;
}) => {
  const [stored, setView] = useState(() => openView(value));
  const rows = useMemo(
    () => visibleRows(value.nodes, stored.collapsed),
    [value.nodes, stored.collapsed],
  );
  const view = shownView(stored, rows);
  const grid = useRef<HTMLTableElement>(null);
  // Set when the DOM focus must move to the Tab stop once the next view is laid out.
  const refocus = useRef(false);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  });

  const show = (next: TreeView, moveFocus: boolean): void => {
    if (next === view) return;
    refocus.current = moveFocus;
    setView(next);
  };
  const { editing, start } = useCellEditing({
    itemId,
    sent,
    value,
    rows,
    disabled,
    onValueChange,
    onClosed: (moveFocus) => {
      refocus.current = moveFocus;
    },
  });

  // Every key the Tree binds has its default prevented, even when it changes nothing. While a
  // cell is edited, its editor handles the keys.
  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>): void => {
    if (editing !== undefined) return;
    const action = keyAction(treeKeyOf(event), "navigation");
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "focus") show(navigate(view, action.move, value), true);
    else if (action.kind === "startEdit" && view.focus !== undefined) start(view.focus);
  };

  // A row or cell focused by a click, or by the DOM focus moving to the Tab stop.
  const onFocus = (event: FocusEvent<HTMLTableElement>): void => {
    const at = focusTargetOf(event.target);
    if (at !== undefined) show(focusOn(view, value, at.nodeId, at.cell), false);
  };

  // A chevron is clicked without taking the focus; it keeps the focus on its row, or moves it to
  // the node when the focused row is in the branch it hides. While a cell is edited, the click
  // takes the focus, so that the editor commits first.
  const onMouseDown = (event: MouseEvent<HTMLTableElement>): void => {
    if (editing === undefined && chevronNodeOf(event.target) !== undefined) event.preventDefault();
  };
  const onClick = (event: MouseEvent<HTMLTableElement>): void => {
    const nodeId = chevronNodeOf(event.target);
    if (nodeId === undefined) return;
    const table = grid.current;
    const holdsFocus = table?.contains(table.ownerDocument.activeElement) ?? false;
    show(toggle(view, nodeId, value), holdsFocus);
  };

  return (
    <TreeGrid
      ref={grid}
      columns={value.columns ?? NO_COLUMNS}
      rows={rows}
      focus={view.focus}
      editing={editing}
      labelledBy={labelledBy}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onMouseDown={onMouseDown}
      onClick={onClick}
    />
  );
};
