// One node's row of the treegrid (design decision 6; DESIGN.md, Tree): a table row, whose cells a
// treegrid exposes as `gridcell`s, with its level, place and expansion as ARIA attributes; the
// name's cell first, indented by a class per level, with a chevron on a parent, then one cell per
// field. Agent strings are text children, which React escapes: none becomes markup (AD-8).

import type { TreeColumn } from "@askboard/contract";
import { fieldText } from "./cells.ts";
import {
  CHEVRON,
  CHEVRON_OPEN,
  FIELD_CELL,
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

export const NodeRow = ({
  row,
  columns,
}: {
  readonly row: TreeRow;
  readonly columns: readonly TreeColumn[];
}) => (
  <tr
    data-node-id={row.node.id}
    aria-level={row.level}
    aria-posinset={row.position}
    aria-setsize={row.setSize}
    aria-expanded={row.hasChildren ? row.expanded : undefined}
    className={ROW}
  >
    <td data-cell={0} className={NAME_CELL}>
      <span className={`flex min-w-0 items-center gap-1.5 ${indentOf(row.level)}`}>
        {row.hasChildren ? <Chevron open={row.expanded} /> : <NoChevron />}
        <span className={row.hasChildren ? PARENT_NAME : NAME}>{row.node.label}</span>
      </span>
    </td>
    {columns.map((column, at) => (
      <td key={column.field} data-cell={at + 1} className={FIELD_CELL[column.type]}>
        {fieldText(row.node, column)}
      </td>
    ))}
  </tr>
);
