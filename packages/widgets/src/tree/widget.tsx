// The Tree's state, its toolbar and its treegrid (design decisions 5 and 6). The value is the
// draft, or the sent answer, else the agent's props; the view, the focus and the collapsed nodes,
// is the component's own and never goes in the draft (open question 8), so expanding and
// collapsing change nothing an answer carries. The treegrid has one Tab stop, the focused row or
// cell, and its keys and clicks change the view through the model (`keys.ts`, `focus.ts`); the
// DOM focus follows the view's after a key, after a click that hides the focused row and after
// the cell editor closes by key (`editing.tsx`), whose keys are its own while it is open. The
// toolbar's tools act on the focused node, which keeps its place in the view while the focus is
// in the toolbar; each tool is enabled only where its edit is possible (`can`).

import type { TreeColumn, TreeProps } from "@askboard/contract";
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type AddEdit, pendingAdd, viewOfAdd, viewWithoutAdd } from "./adding.ts";
import { useCellEditing } from "./editing.tsx";
import { TreeGrid } from "./grid.tsx";
import { treeKeyOf } from "./key-event.ts";
import { can, type TreeEdit } from "./model/edits.ts";
import { focusOn, navigate, openView, type TreeView, toggle } from "./model/focus.ts";
import { keyAction, TREE_TOOLS } from "./model/keys.ts";
import type { TreeRow } from "./model/rows.ts";
import { chevronNodeOf, focusTargetOf } from "./targets.ts";
import { TreeToolbar } from "./toolbar.tsx";

const NO_COLUMNS: readonly TreeColumn[] = [];

const isAdd = (edit: TreeEdit): edit is AddEdit => edit === "addAfter" || edit === "addChild";

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
  const grid = useRef<HTMLTableElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  // Set when the DOM focus must move to the Tab stop once the next view is laid out.
  const refocus = useRef(false);
  // The treegrid's element that holds the focus, kept while the focus stays in the treegrid.
  const held = useRef<EventTarget | null>(null);
  // The focus moves to the Tab stop when asked, and when its element went while the focus was in
  // the treegrid, as a new node taken away by Shift+Tab from its name does: the treegrid's Tab
  // stop, or the toolbar's in an empty Tree.
  useLayoutEffect(() => {
    const lost = held.current instanceof Node && !held.current.isConnected;
    if (!refocus.current && !lost) return;
    refocus.current = false;
    held.current = null;
    const stop = '[tabindex="0"]';
    const target =
      grid.current?.querySelector<HTMLElement>(stop) ??
      toolbar.current?.querySelector<HTMLElement>(stop);
    target?.focus();
  });

  const { rows, editing, start, startAdd } = useCellEditing({
    itemId,
    sent,
    value,
    collapsed: stored.collapsed,
    disabled,
    onValueChange,
    onClosed: (moveFocus, takenAway) => {
      refocus.current = moveFocus;
      if (takenAway !== undefined) setView(viewWithoutAdd(view, value, takenAway));
    },
  });
  const view = shownView(stored, rows);

  const show = (next: TreeView, moveFocus: boolean): void => {
    if (next === view) return;
    refocus.current = moveFocus;
    setView(next);
  };

  // The new node's name is entered in its row, whose editor takes the focus.
  const add = (edit: AddEdit): void => {
    const pending = pendingAdd(edit, value, view.focus);
    if (disabled || pending === undefined) return;
    setView(viewOfAdd(view, value, pending));
    startAdd(pending);
  };
  const onTool = (edit: TreeEdit): void => {
    if (isAdd(edit)) add(edit);
  };
  const enabled = TREE_TOOLS.map((tool) => !disabled && can(tool.edit, value, view.focus?.nodeId));

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
    held.current = event.target;
    const at = focusTargetOf(event.target);
    if (at !== undefined) show(focusOn(view, value, at.nodeId, at.cell), false);
  };
  const onBlur = (event: FocusEvent<HTMLTableElement>): void => {
    const to = event.relatedTarget;
    if (!(to instanceof Node && event.currentTarget.contains(to))) held.current = null;
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
    <>
      <TreeToolbar ref={toolbar} enabled={enabled} onTool={onTool} />
      <TreeGrid
        ref={grid}
        columns={value.columns ?? NO_COLUMNS}
        rows={rows}
        focus={view.focus}
        editing={editing}
        labelledBy={labelledBy}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onMouseDown={onMouseDown}
        onClick={onClick}
      />
    </>
  );
};
