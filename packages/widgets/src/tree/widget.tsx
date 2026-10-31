// The Tree's state, and its frame of a toolbar row and a treegrid (design decisions 5 and 6). The
// value is the draft, or the sent answer, else the agent's props; the view, the focus and the
// collapsed nodes, is the component's own and never goes in the draft (open question 8), so
// expanding and collapsing change nothing an answer carries. The treegrid has one Tab stop, the
// focused row or cell, and its keys and clicks change the view through the model (`keys.ts`,
// `focus.ts`); the DOM focus follows the view's after a key, after a click that hides the focused
// row and after the cell editor closes by key (`editing.tsx`), whose keys are its own while it is
// open, and is never lost (`tree-focus.ts`). The toolbar's tools act on the focused node, which
// keeps its place in the view while the focus is in the toolbar; each tool is enabled only where
// its edit is possible (`can`). An edit from a key brings the DOM focus with the node's focus;
// from a tool, the focus stays on the tool. Every change of the value goes in the draft, or
// `undefined` once the nodes are the agent's again (`sameNodes`). What the user changed against
// the agent's value is marked per node and counted in the toolbar row (`marksOf`, open question
// 14), the read-only Tree's included.

import type { TreeColumn, TreeProps } from "@askboard/contract";
import { type FocusEvent, type KeyboardEvent, type MouseEvent, useMemo, useState } from "react";
import { type AddEdit, pendingAdd, viewOfAdd, viewWithoutAdd } from "./adding.ts";
import { FRAME } from "./classes.ts";
import { afterDelete, deleteQuestionOf } from "./deleting.ts";
import { useCellEditing } from "./editing.tsx";
import { TreeGrid } from "./grid.tsx";
import { treeKeyOf } from "./key-event.ts";
import { can, type TreeEdit } from "./model/edits.ts";
import { focusOn, navigate, openView, type TreeView, toggle } from "./model/focus.ts";
import { keyAction, TREE_TOOLS } from "./model/keys.ts";
import { marksOf, sameNodes } from "./model/marks.ts";
import type { TreeRow } from "./model/rows.ts";
import { afterMove, isMove, type MoveEdit } from "./moving.ts";
import { chevronNodeOf, focusTargetOf } from "./targets.ts";
import { TreeToolbar } from "./toolbar.tsx";
import { type TreePart, useTreeFocus } from "./tree-focus.ts";

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
  // The delete whose question is asked, and the part it was asked from.
  const [asked, setAsked] = useState<{ readonly nodeId: string; readonly from: TreePart }>();
  const focus = useTreeFocus();

  const { rows, editing, start, startAdd, dropped } = useCellEditing({
    itemId,
    sent,
    value,
    collapsed: stored.collapsed,
    disabled,
    onValueChange,
    onClosed: (moveFocus, takenAway) => {
      focus.moveFocusTo(moveFocus ? "grid" : undefined);
      if (takenAway !== undefined) setView(viewWithoutAdd(view, value, takenAway));
    },
  });
  const view = shownView(stored, rows);
  // A new node the Tree dropped on turning read-only goes as if taken away: the focus goes back
  // where its add started.
  if (dropped !== undefined) setView(viewWithoutAdd(view, value, dropped));
  const marks = useMemo(() => marksOf(sent, value), [sent, value]);

  const show = (next: TreeView, moveFocus: boolean): void => {
    if (next === view) return;
    focus.moveFocusTo(moveFocus ? "grid" : undefined);
    setView(next);
  };
  const change = (next: TreeProps): void => {
    onValueChange(sameNodes(sent, next) ? undefined : next);
  };

  // The new node's name is entered in its row, whose editor takes the focus.
  const add = (edit: AddEdit): void => {
    const pending = pendingAdd(edit, value, view.focus);
    if (disabled || pending === undefined) return;
    setView(viewOfAdd(view, value, pending));
    startAdd(pending);
  };
  // The node and its branch go, the focus moving off it (`deleting.ts`).
  const remove = (nodeId: string, focusTo: TreePart | undefined): void => {
    const deleted = afterDelete(value, view, nodeId);
    focus.moveFocusTo(focusTo);
    setView(deleted.view);
    change(deleted.value);
  };
  // The node moves with its branch, the focus following it (`moving.ts`).
  const move = (edit: MoveEdit, nodeId: string, focusTo: TreePart | undefined): void => {
    const moved = afterMove(edit, value, view, nodeId);
    focus.moveFocusTo(focusTo);
    setView(moved.view);
    change(moved.value);
  };
  // An edit of the focused node, from a key or a tool, where it is possible.
  const act = (edit: TreeEdit, from: TreePart): void => {
    const nodeId = view.focus?.nodeId;
    const focusTo = from === "grid" ? "grid" : undefined;
    if (disabled || !can(edit, value, nodeId)) return;
    if (isAdd(edit)) add(edit);
    else if (nodeId === undefined) return;
    else if (isMove(edit)) move(edit, nodeId, focusTo);
    else if (deleteQuestionOf(value, nodeId) !== undefined) setAsked({ nodeId, from });
    else remove(nodeId, focusTo);
  };
  const enabled = TREE_TOOLS.map((tool) => !disabled && can(tool.edit, value, view.focus?.nodeId));
  // The question shows while its node has children, from the value as it is, and while the Tree
  // is editable; once it no longer applies it is dropped, never to show again unasked.
  const question =
    disabled || asked === undefined ? undefined : deleteQuestionOf(value, asked.nodeId);
  if (asked !== undefined && question === undefined) setAsked(undefined);
  const asking =
    question === undefined || asked === undefined
      ? undefined
      : {
          nodeId: asked.nodeId,
          question,
          onConfirm: () => {
            setAsked(undefined);
            remove(asked.nodeId, asked.from);
          },
          onCancel: () => {
            focus.moveFocusTo(asked.from);
            setAsked(undefined);
          },
        };

  // Every key the Tree binds has its default prevented, even when it changes nothing. While a
  // cell is edited, its editor handles the keys.
  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>): void => {
    if (editing !== undefined) return;
    const action = keyAction(treeKeyOf(event), "navigation");
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "focus") show(navigate(view, action.move, value), true);
    else if (action.kind === "startEdit" && view.focus !== undefined) start(view.focus);
    else if (action.kind === "edit") act(action.edit, "grid");
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
    const table = focus.grid.current;
    const holdsFocus = table?.contains(table.ownerDocument.activeElement) ?? false;
    show(toggle(view, nodeId, value), holdsFocus);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the frame takes no input; its focus handlers follow the focus of its toolbar and treegrid, which bubbles to it.
    <div className={FRAME} onFocus={focus.onFocus} onBlur={focus.onBlur}>
      <TreeToolbar
        ref={focus.toolbarRow}
        enabled={enabled}
        onTool={(edit) => act(edit, "toolbar")}
        asking={asking}
        changes={marks.count}
      />
      <TreeGrid
        ref={focus.grid}
        columns={value.columns ?? NO_COLUMNS}
        rows={rows}
        focus={view.focus}
        editing={editing}
        marks={marks.byNode}
        labelledBy={labelledBy}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onMouseDown={onMouseDown}
        onClick={onClick}
      />
    </div>
  );
};
