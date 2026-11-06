// The Tree's treegrid (design decision 6): a table whose role is `treegrid`, so that its rows,
// cells and column headers take their roles from the HTML, labelled by its question's text; a
// header row of column names, the name's column first, then one row per visible node, with its
// change mark if the user changed it. One row or cell, the focus, is the Tab stop (roving focus);
// the table handles its rows' events. One cell at a time may be edited. A work breakdown's header
// names its work packages and adds its two value columns, and its Total row ends the grid
// (molecules design decision 14).

import type { TreeColumn, TreeProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  Ref,
} from "react";
import { PERT_HEADERS } from "./cells.ts";
import { FIELD_HEADER, GRID, HEADER_ROW, NAME_HEADER, SELECT_COLUMN } from "./classes.ts";
import type { TreeDrag } from "./drag.ts";
import { editableCells } from "./entry.ts";
import { type DragState, indicatorOf } from "./model/dragging.ts";
import type { TreeFocus } from "./model/focus.ts";
import type { NodeMark } from "./model/marks.ts";
import type { PertGrid } from "./model/pert.ts";
import type { TreeRow } from "./model/rows.ts";
import { type CheckState, type Selection, stateOf } from "./model/selection.ts";
import { NodeRow, ROW_STOP, type RowEditing, type RowStop } from "./row.tsx";
import { SelectBox } from "./select-box.tsx";
import { TotalRow } from "./total-row.tsx";

const stopIn = (focus: TreeFocus | undefined, nodeId: string): RowStop =>
  focus?.nodeId === nodeId ? (focus.cell ?? ROW_STOP) : undefined;

// A work breakdown's two value columns' headers, each on one line with its full name as the tip.
const PertHeaders = () => {
  const text = useStrings();
  return PERT_HEADERS.map(({ label, tip }) => (
    <th scope="col" key={label} title={text(tip)} className={FIELD_HEADER.number}>
      {text(label)}
    </th>
  ));
};

export const TreeGrid = ({
  ref,
  nameColumn,
  columns,
  value,
  disabled,
  pert,
  rows,
  focus,
  current,
  editing,
  marks,
  selection,
  headerState,
  drag,
  dragging,
  labelledBy,
  onKeyDown,
  onFocus,
  onMouseDown,
  onClick,
  onDoubleClick,
  onChange,
}: {
  readonly ref: Ref<HTMLTableElement>;
  /** The name column's header. */
  readonly nameColumn: string;
  readonly columns: readonly TreeColumn[];
  /** The Tree's value, which says what each cell edits. */
  readonly value: TreeProps;
  /** The Tree is read-only: no cell takes an edit. */
  readonly disabled: boolean;
  /** A work breakdown's values, by row, and its Total row's; none in a Tree without `pert`. */
  readonly pert: PertGrid | undefined;
  readonly rows: readonly TreeRow[];
  /** The Tab stop: a row, or a cell of it. */
  readonly focus: TreeFocus | undefined;
  /** The current row's node, which its row tools act on, or none. */
  readonly current: string | undefined;
  /** The node whose cell is being edited, and its editor. */
  readonly editing: (RowEditing & { readonly nodeId: string }) | undefined;
  /** What the user changed, by node, against the agent's value (`marks.ts`). */
  readonly marks: ReadonlyMap<string, NodeMark>;
  /** The selected nodes (`model/selection.ts`). */
  readonly selection: Selection;
  /** The header check box's state. */
  readonly headerState: CheckState;
  /** The Tree's drag, shared by the rows; none when the Tree is read-only. */
  readonly drag: TreeDrag | undefined;
  /** The drag under way, if any. */
  readonly dragging: DragState | undefined;
  /** The ID of the question's text, which names the grid. */
  readonly labelledBy: string;
  readonly onKeyDown: KeyboardEventHandler<HTMLTableElement>;
  readonly onFocus: FocusEventHandler<HTMLTableElement>;
  readonly onMouseDown: MouseEventHandler<HTMLTableElement>;
  readonly onClick: MouseEventHandler<HTMLTableElement>;
  readonly onDoubleClick: MouseEventHandler<HTMLTableElement>;
  /** A check box of the selection column changed. */
  readonly onChange: ChangeEventHandler<HTMLTableElement>;
}) => {
  const text = useStrings();
  return (
    <table
      ref={ref}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a treegrid is a table the user moves through (WAI-ARIA APG, Treegrid); the table gives its rows, cells and headers their roles.
      role="treegrid"
      aria-labelledby={labelledBy}
      className={GRID}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onChange={onChange}
    >
      <thead>
        <tr className={HEADER_ROW}>
          <th scope="col" data-select-column="" className={SELECT_COLUMN}>
            <SelectBox state={headerState} node={undefined} label={text("tree.select.header")} />
          </th>
          <th scope="col" className={NAME_HEADER}>
            {nameColumn}
          </th>
          {columns.map((column) => (
            <th scope="col" key={column.field} className={FIELD_HEADER[column.type]}>
              {column.label}
            </th>
          ))}
          {pert === undefined ? null : <PertHeaders />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <NodeRow
            key={row.node.id}
            row={row}
            columns={columns}
            stop={stopIn(focus, row.node.id)}
            editing={editing?.nodeId === row.node.id ? editing : undefined}
            mark={marks.get(row.node.id)}
            pert={pert?.rows.get(row.node.id)}
            editable={editableCells(value, row.node.id, disabled)}
            current={current === row.node.id}
            selected={stateOf(selection, row.node)}
            drag={drag}
            dragged={dragging?.nodeId === row.node.id}
            indicator={indicatorOf(dragging, row.node.id)}
          />
        ))}
        {pert?.total === undefined ? null : <TotalRow columns={columns} values={pert.total} />}
      </tbody>
    </table>
  );
};
