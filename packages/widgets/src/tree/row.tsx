// One node's row of the treegrid (design decision 6; DESIGN.md, Tree): a table row, whose cells a
// treegrid exposes as `gridcell`s, with its level, place and expansion as ARIA attributes; the
// name's cell first, indented by a class per level, with a chevron on a parent, then one cell per
// field. The row and each cell can take the focus, and the one that is the treegrid's Tab stop is
// in the Tab order. Agent strings are text children, which React escapes: none becomes markup
// (AD-8).

import type { TreeColumn } from "@askboard/contract";
import { memo } from "react";
import { fieldText } from "./cells.ts";
import {
  CHEVRON,
  CHEVRON_OPEN,
  FIELD_CELL,
  FOCUS_RING,
  indentOf,
  NAME,
  NAME_CELL,
  PARENT_NAME,
  ROW,
} from "./classes.ts";
import type { TreeRow } from "./model/rows.ts";

// The chevron points right when closed and down when open. It has no role: the row's
// aria-expanded says what it shows.
const Chevron = ({ open }: { readonly open: boolean }) => (
  <span
    data-chevron=""
    aria-hidden="true"
    className={open ? `${CHEVRON} ${CHEVRON_OPEN}` : CHEVRON}
  >
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

// A leaf keeps the chevron's room, so that names of one level line up.
const NoChevron = () => <span aria-hidden="true" className="size-4 shrink-0" />;

/** The row itself as the Tab stop, rather than one of its cells. */
export const ROW_STOP = "row";

/** Where a row holds the treegrid's Tab stop: itself, one of its cells, or nowhere. */
export type RowStop = typeof ROW_STOP | number | undefined;

const tabIndexOf = (stop: RowStop, at: RowStop): number => (stop === at ? 0 : -1);

// Each row re-renders only when its node, its place or its Tab stop changes.
export const NodeRow = memo(function NodeRow({
  row,
  columns,
  stop,
}: {
  readonly row: TreeRow;
  readonly columns: readonly TreeColumn[];
  readonly stop: RowStop;
}) {
  return (
    <tr
      data-node-id={row.node.id}
      aria-level={row.level}
      aria-posinset={row.position}
      aria-setsize={row.setSize}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      tabIndex={tabIndexOf(stop, ROW_STOP)}
      className={`${ROW} ${FOCUS_RING}`}
    >
      <td data-cell={0} tabIndex={tabIndexOf(stop, 0)} className={`${NAME_CELL} ${FOCUS_RING}`}>
        <span className={`flex min-w-0 items-center gap-1.5 ${indentOf(row.level)}`}>
          {row.hasChildren ? <Chevron open={row.expanded} /> : <NoChevron />}
          <span className={row.hasChildren ? PARENT_NAME : NAME}>{row.node.label}</span>
        </span>
      </td>
      {columns.map((column, at) => (
        <td
          key={column.field}
          data-cell={at + 1}
          tabIndex={tabIndexOf(stop, at + 1)}
          className={`${FIELD_CELL[column.type]} ${FOCUS_RING}`}
        >
          {fieldText(row.node, column)}
        </td>
      ))}
    </tr>
  );
});
