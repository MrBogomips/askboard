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
// 14), the read-only Tree's included. A work breakdown, a Tree with `pert`, opens to its
// `openDepth` (`openView`) and shows each row's values from the board's graph, and its totals
// (molecules design decision 14). A node added and named goes in the draft with the edits it makes
// to the plans over the Tree (`linked.ts`; design decisions 11 and 12), and so does a node deleted,
// which asks first when tasks of those plans depend on its branch; a delete they refuse writes
// nothing and keeps the question open with the refusal. The selection of rows, the percentage
// adjustment of the selected leaves and its one undo slot are view state (widget-editing-plus
// design decisions 1, 3 and 4): the selection clears when the Tree turns read-only and drops what
// a delete took away; the slot holds the value before the last adjustment and is emptied by any
// other edit, and undoing it goes through the normal change path, leaving no trace in the draft.

import type { TreeColumn, TreeProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BoardGraph } from "../board-graph/index.ts";
import { type AddEdit, pendingAdd, viewOfAdd, viewWithoutAdd } from "./adding.ts";
import type { Applied } from "./adjust-panel.tsx";
import { nameColumnOf } from "./cells.ts";
import { DRAG_TIP, FRAME } from "./classes.ts";
import {
  afterDelete,
  branchIdsOf,
  type CountDependents,
  type DeleteQuestion,
  deleteQuestionOf,
} from "./deleting.ts";
import { NO_ROW_EVENTS, type RowDragEvents, type TreeDrag } from "./drag.ts";
import { useCellEditing } from "./editing.tsx";
import { TreeGrid } from "./grid.tsx";
import { treeKeyOf } from "./key-event.ts";
import { applyAdjustment } from "./model/adjust.ts";
import { anchorOf, type Current, canAct, currentIn } from "./model/current.ts";
import { type DragState, leaveTarget, overTarget, startDrag, tipOf } from "./model/dragging.ts";
import { dropOn } from "./model/drop.ts";
import type { TreeEdit } from "./model/edits.ts";
import { focusOn, navigate, openView, type TreeView, toggle } from "./model/focus.ts";
import { keyAction, TREE_TOOLS } from "./model/keys.ts";
import { ADDED, marksOf, sameNodes } from "./model/marks.ts";
import { locate } from "./model/nodes.ts";
import { pertValues } from "./model/pert.ts";
import type { TreeRow } from "./model/rows.ts";
import {
  extend,
  headerState,
  NO_SELECTION,
  pruned,
  type Selection,
  selectAll,
  toggle as toggleSelected,
} from "./model/selection.ts";
import { draftAfterUndo, liveSlot, slotOf, type UndoSlot } from "./model/undo.ts";
import { afterDrop, afterMove, isMove, type MoveEdit } from "./moving.ts";
import {
  cellTargetOf,
  chevronNodeOf,
  focusTargetOf,
  rowNodeOf,
  selectTargetOf,
} from "./targets.ts";
import { TreeToolbar } from "./toolbar.tsx";
import { type TreePart, useTreeFocus } from "./tree-focus.ts";

const NO_COLUMNS: readonly TreeColumn[] = [];

/** A delete whose question is asked: its node, the part it was asked from, and its refusal. */
type Asked = { readonly nodeId: string; readonly from: TreePart; readonly refusal?: string };

// The question of the delete `asked`, from the value as it is, with the refusal it met.
const askedQuestion = (
  value: TreeProps,
  asked: Asked,
  countDependents: CountDependents,
): DeleteQuestion | undefined => {
  const { nodeId, refusal } = asked;
  const question = deleteQuestionOf(value, nodeId, countDependents, refusal !== undefined);
  return question === undefined || refusal === undefined ? question : { ...question, refusal };
};

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
  graph,
  onValueChange,
  onLinkedAdd,
  countDependents,
  onLinkedDelete,
}: {
  readonly itemId: string;
  /** The agent's props, checked. */
  readonly sent: TreeProps;
  readonly value: TreeProps;
  /** The ID of the question's text, which names the treegrid. */
  readonly labelledBy: string;
  /** The question is answered, being sent or locked: the Tree edits nothing. */
  readonly disabled: boolean;
  /** A work breakdown's live graph, the board's; none for a Tree without `pert`. */
  readonly graph: BoardGraph | undefined;
  readonly onValueChange: (value: TreeProps | undefined) => void;
  /**
   * Writes the value `next` once the new node `added` is named after, or under, the node `anchor`,
   * with the plans' linked edits, or returns the field error that refuses it (`linked.ts`).
   */
  readonly onLinkedAdd: (
    next: TreeProps,
    added: string,
    anchor: string | undefined,
  ) => string | undefined;
  /** How many tasks of the plans over the Tree depend on a branch (`linked.ts`). */
  readonly countDependents: CountDependents;
  /**
   * Writes the value `next` once the branch `deleted` is out of it, with the plans' linked edits,
   * or returns the field error that refuses it (`linked.ts`).
   */
  readonly onLinkedDelete: (next: TreeProps, deleted: readonly string[]) => string | undefined;
}) => {
  const text = useStrings();
  const [stored, setView] = useState(() => openView(value));
  // The delete whose question is asked, the part it was asked from, and its refusal once refused.
  const [asked, setAsked] = useState<Asked>();
  // The current row, which the row tools act on: set by a click or an arrow key, none at open.
  const [currentId, setCurrent] = useState<Current>();
  const [picked, setPicked] = useState<Selection>(NO_SELECTION);
  // Where Shift with an arrow extends the selection from: the row last selected by itself.
  const [anchor, setAnchor] = useState<string>();
  const [slot, setSlot] = useState<UndoSlot>();
  const [announced, setAnnounced] = useState("");
  // The row being dragged and where the pointer is: view state, nothing until it drops.
  const [dragging, setDragging] = useState<DragState>();
  const focus = useTreeFocus();
  // Any edit but an adjustment, or its undo, empties the slot.
  const edited = (next: TreeProps | undefined): void => {
    setSlot(undefined);
    onValueChange(next);
  };

  const { rows, editing, start, startAdd, dropped, pendingId } = useCellEditing({
    itemId,
    sent,
    value,
    collapsed: stored.collapsed,
    disabled,
    onValueChange: edited,
    onCommitAdd: (next, added, pending) => {
      const refusal = onLinkedAdd(next, added, pending.anchor?.nodeId);
      if (refusal === undefined) setSlot(undefined);
      return refusal;
    },
    onClosed: (moveFocus, takenAway) => {
      focus.moveFocusTo(moveFocus ? "grid" : undefined);
      if (takenAway !== undefined) {
        const back = viewWithoutAdd(view, value, takenAway);
        setView(back);
        setCurrent(back.focus?.nodeId);
      }
    },
  });
  const view = shownView(stored, rows);
  // A new node the Tree dropped on turning read-only goes as if taken away: the focus goes back
  // where its add started.
  if (dropped !== undefined) {
    const back = viewWithoutAdd(view, value, dropped);
    setView(back);
    setCurrent(back.focus?.nodeId);
  }
  const current = currentIn(value, currentId);
  const marks = useMemo(() => marksOf(sent, value), [sent, value]);
  // The new node being named shows the added mark at once, though it is in no value yet.
  const shownMarks = useMemo(
    () => (pendingId === undefined ? marks.byNode : new Map(marks.byNode).set(pendingId, ADDED)),
    [marks, pendingId],
  );
  const pert = useMemo(
    () => (graph === undefined ? undefined : pertValues(graph, itemId, rows, value.nodes)),
    [graph, itemId, rows, value.nodes],
  );

  const show = (next: TreeView, moveFocus: boolean): void => {
    if (next === view) return;
    focus.moveFocusTo(moveFocus ? "grid" : undefined);
    setView(next);
  };
  const change = (next: TreeProps): void => {
    edited(sameNodes(sent, next) ? undefined : next);
  };

  // The selection: what the Tree still holds, none once it is read-only (view state, never draft).
  if (disabled && picked.size > 0) setPicked(NO_SELECTION);
  const selection = useMemo(() => pruned(picked, value), [picked, value]);
  const select = (next: Selection, from: string | undefined): void => {
    setPicked(next);
    setAnchor(from);
  };
  const toggleRow = (nodeId: string): void =>
    select(toggleSelected(selection, value, nodeId), nodeId);
  const toggleAll = (): void =>
    select(
      headerState(selection, value) === "checked" ? NO_SELECTION : selectAll(value),
      undefined,
    );
  // Shift with an arrow moves the focus a row and selects the rows between the anchor and it.
  const extendBy = (move: "up" | "down"): void => {
    const from = anchor ?? view.focus?.nodeId;
    const next = navigate(view, move, value);
    const to = next.focus?.nodeId;
    if (from !== undefined && to !== undefined)
      select(extend(selection, value, rows, from, to), from);
    setCurrent(to);
    show(next, true);
  };

  // The one undo slot: valid while the Tree is editable and holds the value the adjustment gave.
  const undo = liveSlot(slot, value, disabled);
  if (slot !== undefined && undo === undefined) setSlot(undefined);
  const adjusted = ({ plan, percent }: Applied): void => {
    const next = applyAdjustment(value, plan);
    if (disabled || plan.kind !== "ready" || next === value) return;
    setSlot(slotOf(value, next));
    onValueChange(sameNodes(sent, next) ? undefined : next);
    setAnnounced(text("tree.adjust.done", { count: plan.changes.length, percent }));
  };
  const undoAdjust = (): void => {
    if (undo === undefined) return;
    setSlot(undefined);
    onValueChange(draftAfterUndo(undo, sent));
    setAnnounced(text("tree.adjust.undone"));
  };

  // The new node's name is entered in its row, whose editor takes the focus.
  const add = (edit: AddEdit): void => {
    const pending = pendingAdd(edit, value, anchorOf(view, current));
    if (disabled || pending === undefined) return;
    const next = viewOfAdd(view, value, pending);
    setView(next);
    setCurrent(next.focus?.nodeId);
    startAdd(pending);
  };
  // The node and its branch go, the focus moving off it (`deleting.ts`), with the plans' linked
  // edits; or nothing goes, and the refusal is returned.
  const remove = (nodeId: string, focusTo: TreePart | undefined): string | undefined => {
    const deleted = afterDelete(value, view, nodeId);
    const refusal = onLinkedDelete(deleted.value, branchIdsOf(value, nodeId));
    if (refusal !== undefined) return refusal;
    setSlot(undefined);
    focus.moveFocusTo(focusTo);
    setView(deleted.view);
    setCurrent(deleted.view.focus?.nodeId);
    return undefined;
  };
  // A delete, asked first where `deleteQuestionOf` asks; a refused one opens the question with
  // its refusal.
  const startDelete = (nodeId: string, from: TreePart): void => {
    if (deleteQuestionOf(value, nodeId, countDependents) !== undefined) {
      setAsked({ nodeId, from });
      return;
    }
    const refusal = remove(nodeId, from === "grid" ? "grid" : undefined);
    if (refusal !== undefined) setAsked({ nodeId, from, refusal });
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
    const nodeId = current;
    const focusTo = from === "grid" ? "grid" : undefined;
    if (disabled || !canAct(edit, value, nodeId)) return;
    if (isAdd(edit)) add(edit);
    else if (nodeId === undefined) return;
    else if (isMove(edit)) move(edit, nodeId, focusTo);
    else startDelete(nodeId, from);
  };
  // A drop makes the move the buttons make, the focus following the node (`moving.ts`); a refused
  // drop and one where the node already is change nothing.
  const dropRow = (nodeId: string, targetId: string, fraction: number): void => {
    const moved = afterDrop(dropOn(value, nodeId, targetId, fraction), value, view, nodeId);
    if (disabled || moved.value === value) return;
    focus.moveFocusTo("grid");
    setCurrent(nodeId);
    setView(moved.view);
    change(moved.value);
    const name = locate(value.nodes, nodeId)?.node.label ?? nodeId;
    setAnnounced(text("tree.drag.moved", { name }));
  };
  // The events every row reports to, read at the time of the event: the rows register once.
  const dragEvents = useRef<RowDragEvents>(NO_ROW_EVENTS.current);
  // Escape cancels the drag: the browser's own drag takes the key and ends without a drop; where
  // the key reaches the page first, the drag is called off here and the drop that follows is not made.
  const cancelled = useRef(false);
  dragEvents.current = {
    start: (nodeId) => {
      cancelled.current = false;
      setDragging(startDrag(nodeId));
    },
    over: (nodeId, targetId, fraction) => {
      if (cancelled.current) return;
      setDragging((state) =>
        overTarget(state, nodeId, targetId, dropOn(value, nodeId, targetId, fraction)),
      );
    },
    leave: (targetId) => setDragging((state) => leaveTarget(state, targetId)),
    drop: (nodeId, targetId, fraction) => {
      if (!cancelled.current) dropRow(nodeId, targetId, fraction);
    },
    end: () => {
      setDragging(undefined);
      focus.moveFocusTo("grid");
    },
  };
  const dragged = dragging !== undefined;
  useEffect(() => {
    const page = focus.grid.current?.ownerDocument;
    if (!dragged || page === undefined) return undefined;
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      cancelled.current = true;
      setDragging(undefined);
    };
    page.addEventListener("keydown", onKey, true);
    return () => page.removeEventListener("keydown", onKey, true);
  }, [dragged, focus.grid]);
  if (disabled && dragging !== undefined) setDragging(undefined);
  const drag = useMemo<TreeDrag | undefined>(
    () => (disabled ? undefined : { treeId: itemId, events: dragEvents }),
    [disabled, itemId],
  );
  const tip = tipOf(dragging);
  const enabled = TREE_TOOLS.map((tool) => !disabled && canAct(tool.edit, value, current));
  // The question shows while its node has children or dependents, from the value as it is, or
  // its delete was refused, and while the Tree is editable; once it no longer applies it is
  // dropped, never to show again unasked.
  const question =
    disabled || asked === undefined ? undefined : askedQuestion(value, asked, countDependents);
  if (asked !== undefined && question === undefined) {
    // A lock takes the question while its "Cancel" holds the focus: the focus goes to the tree, not
    // to the selection tools that stay in a read-only toolbar.
    const row = focus.toolbarRow.current;
    if (disabled && row?.contains(row.ownerDocument.activeElement) === true) {
      focus.moveFocusTo("grid");
    }
    setAsked(undefined);
  }
  const asking =
    question === undefined || asked === undefined
      ? undefined
      : {
          nodeId: asked.nodeId,
          question,
          onConfirm: () => {
            const refusal = remove(asked.nodeId, asked.from);
            setAsked(refusal === undefined ? undefined : { ...asked, refusal });
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
    if (action.kind === "focus") {
      const next = navigate(view, action.move, value);
      setCurrent(next.focus?.nodeId);
      show(next, true);
    } else if (action.kind === "select") {
      if (view.focus !== undefined) toggleRow(view.focus.nodeId);
    } else if (action.kind === "extend") extendBy(action.move);
    else if (action.kind === "undo") undoAdjust();
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
    const clicked = rowNodeOf(event.target);
    if (clicked !== undefined) setCurrent(clicked);
    const onBox = selectTargetOf(event.target) !== undefined;
    if (editing === undefined && (onBox || chevronNodeOf(event.target) !== undefined)) {
      event.preventDefault();
    }
  };
  const onClick = (event: MouseEvent<HTMLTableElement>): void => {
    const nodeId = chevronNodeOf(event.target);
    if (nodeId === undefined) return;
    const table = focus.grid.current;
    const holdsFocus = table?.contains(table.ownerDocument.activeElement) ?? false;
    show(toggle(view, nodeId, value), holdsFocus);
  };

  // A double click on a cell edits it, as Enter does on the focused one: its editor opens, or
  // nothing opens where the cell takes no edit. An edit under way is left alone.
  const onDoubleClick = (event: MouseEvent<HTMLTableElement>): void => {
    const at = cellTargetOf(event.target);
    if (editing !== undefined || at === undefined) return;
    start(at);
  };

  // A check box of the selection column: the row's, or the header's for every node. The focus goes
  // to the row, so that the keys go on from there.
  const onChange = (event: ChangeEvent<HTMLTableElement>): void => {
    const target = selectTargetOf(event.target);
    if (target === undefined) return;
    if (target.all) {
      toggleAll();
      return;
    }
    toggleRow(target.nodeId);
    focus.moveFocusTo("grid");
    setCurrent(target.nodeId);
    setView(focusOn(view, value, target.nodeId));
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
        selecting={{
          selection,
          value,
          disabled,
          onSelectAll: () => select(selectAll(value), undefined),
          onSelectNone: () => select(NO_SELECTION, undefined),
          onApply: adjusted,
          onUndo: undo === undefined ? undefined : undoAdjust,
        }}
      />
      <TreeGrid
        ref={focus.grid}
        nameColumn={nameColumnOf(value, text)}
        columns={value.columns ?? NO_COLUMNS}
        value={value}
        disabled={disabled}
        pert={pert}
        rows={rows}
        focus={view.focus}
        current={pendingId ?? current}
        editing={editing}
        marks={shownMarks}
        selection={selection}
        headerState={headerState(selection, value)}
        drag={drag}
        dragging={dragging}
        labelledBy={labelledBy}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onChange={onChange}
      />
      <p data-drag-tip="" className={DRAG_TIP}>
        {tip === undefined ? "" : text(tip.key, "max" in tip ? { max: tip.max } : undefined)}
      </p>
      <p role="status" className="sr-only">
        {announced}
      </p>
    </div>
  );
};
