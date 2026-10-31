// The Tree's treegrid (design decision 6): a table whose role is `treegrid`, so that its rows,
// cells and column headers take their roles from the HTML, labelled by its question's text; a
// header row of column names, the name's column first, then one row per visible node. One row or
// cell, the focus, is the Tab stop (roving focus); the table handles its rows' events.

import type { TreeColumn } from "@askboard/contract";
import type { FocusEventHandler, KeyboardEventHandler, MouseEventHandler, Ref } from "react";
import { FIELD_HEADER, GRID, HEADER_ROW, NAME_HEADER } from "./classes.ts";
import type { TreeFocus } from "./model/focus.ts";
import type { TreeRow } from "./model/rows.ts";
import { NodeRow, ROW_STOP, type RowStop } from "./row.tsx";

/** The name column's header. The wording is not recorded in EXPERIENCE.md. */
const NAME_COLUMN = "Name";

const stopIn = (focus: TreeFocus | undefined, nodeId: string): RowStop =>
  focus?.nodeId === nodeId ? (focus.cell ?? ROW_STOP) : undefined;

export const TreeGrid = ({
  ref,
  columns,
  rows,
  focus,
  labelledBy,
  onKeyDown,
  onFocus,
  onMouseDown,
  onClick,
}: {
  readonly ref: Ref<HTMLTableElement>;
  readonly columns: readonly TreeColumn[];
  readonly rows: readonly TreeRow[];
  /** The Tab stop: a row, or a cell of it. */
  readonly focus: TreeFocus | undefined;
  /** The ID of the question's text, which names the grid. */
  readonly labelledBy: string;
  readonly onKeyDown: KeyboardEventHandler<HTMLTableElement>;
  readonly onFocus: FocusEventHandler<HTMLTableElement>;
  readonly onMouseDown: MouseEventHandler<HTMLTableElement>;
  readonly onClick: MouseEventHandler<HTMLTableElement>;
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
  >
    <thead>
      <tr className={HEADER_ROW}>
        <th scope="col" className={NAME_HEADER}>
          {NAME_COLUMN}
        </th>
        {columns.map((column) => (
          <th scope="col" key={column.field} className={FIELD_HEADER[column.type]}>
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <NodeRow key={row.node.id} row={row} columns={columns} stop={stopIn(focus, row.node.id)} />
      ))}
    </tbody>
  </table>
);
