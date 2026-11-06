// The Tree's treegrid (design decision 6): a table whose role is `treegrid`, so that its rows,
// cells and column headers take their roles from the HTML, labelled by its question's text; a
// header row of column names, the name's column first, then one row per visible node, with its
// change mark if the user changed it. One row or cell, the focus, is the Tab stop (roving focus);
// the table handles its rows' events. One cell at a time may be edited. A work breakdown's header
// names its work packages and adds its two value columns, and its Total row ends the grid
// (molecules design decision 14).

import type { TreeColumn } from "@askboard/contract";
import type { FocusEventHandler, KeyboardEventHandler, MouseEventHandler, Ref } from "react";
import { PERT_VALUE_COLUMNS } from "./cells.ts";
import { FIELD_HEADER, GRID, HEADER_ROW, NAME_HEADER } from "./classes.ts";
import type { TreeFocus } from "./model/focus.ts";
import type { NodeMark } from "./model/marks.ts";
import type { PertGrid } from "./model/pert.ts";
import type { TreeRow } from "./model/rows.ts";
import { NodeRow, ROW_STOP, type RowEditing, type RowStop } from "./row.tsx";
import { TotalRow } from "./total-row.tsx";

const stopIn = (focus: TreeFocus | undefined, nodeId: string): RowStop =>
  focus?.nodeId === nodeId ? (focus.cell ?? ROW_STOP) : undefined;

export const TreeGrid = ({
  ref,
  nameColumn,
  columns,
  pert,
  rows,
  focus,
  editing,
  marks,
  labelledBy,
  onKeyDown,
  onFocus,
  onMouseDown,
  onClick,
  onDoubleClick,
}: {
  readonly ref: Ref<HTMLTableElement>;
  /** The name column's header. */
  readonly nameColumn: string;
  readonly columns: readonly TreeColumn[];
  /** A work breakdown's values, by row, and its Total row's; none in a Tree without `pert`. */
  readonly pert: PertGrid | undefined;
  readonly rows: readonly TreeRow[];
  /** The Tab stop: a row, or a cell of it. */
  readonly focus: TreeFocus | undefined;
  /** The node whose cell is being edited, and its editor. */
  readonly editing: (RowEditing & { readonly nodeId: string }) | undefined;
  /** What the user changed, by node, against the agent's value (`marks.ts`). */
  readonly marks: ReadonlyMap<string, NodeMark>;
  /** The ID of the question's text, which names the grid. */
  readonly labelledBy: string;
  readonly onKeyDown: KeyboardEventHandler<HTMLTableElement>;
  readonly onFocus: FocusEventHandler<HTMLTableElement>;
  readonly onMouseDown: MouseEventHandler<HTMLTableElement>;
  readonly onClick: MouseEventHandler<HTMLTableElement>;
  readonly onDoubleClick: MouseEventHandler<HTMLTableElement>;
}) => (
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
  >
    <thead>
      <tr className={HEADER_ROW}>
        <th scope="col" className={NAME_HEADER}>
          {nameColumn}
        </th>
        {columns.map((column) => (
          <th scope="col" key={column.field} className={FIELD_HEADER[column.type]}>
            {column.label}
          </th>
        ))}
        {pert === undefined
          ? null
          : PERT_VALUE_COLUMNS.map((label) => (
              <th scope="col" key={label} className={FIELD_HEADER.number}>
                {label}
              </th>
            ))}
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
        />
      ))}
      {pert?.total === undefined ? null : <TotalRow columns={columns} values={pert.total} />}
    </tbody>
  </table>
);
