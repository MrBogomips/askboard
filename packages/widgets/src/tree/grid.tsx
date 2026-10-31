// The Tree's treegrid (design decision 6): a table whose role is `treegrid`, so that its rows,
// cells and column headers take their roles from the HTML, labelled by its question's text; a
// header row of column names, the name's column first, then one row per visible node
// (`model/rows.ts`).

import type { TreeProps } from "@askboard/contract";
import { FIELD_HEADER, GRID, HEADER_ROW, NAME_HEADER } from "./classes.ts";
import { visibleRows } from "./model/rows.ts";
import { NodeRow } from "./row.tsx";

/** The name column's header. The wording is not recorded in EXPERIENCE.md. */
const NAME_COLUMN = "Name";

export const TreeGrid = ({
  value,
  collapsed,
  labelledBy,
}: {
  readonly value: TreeProps;
  readonly collapsed: ReadonlySet<string>;
  /** The ID of the question's text, which names the grid. */
  readonly labelledBy: string;
}) => {
  const columns = value.columns ?? [];
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a treegrid is a table the user moves through (WAI-ARIA APG, Treegrid); the table gives its rows, cells and headers their roles.
    <table role="treegrid" aria-labelledby={labelledBy} className={GRID}>
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
        {visibleRows(value.nodes, collapsed).map((row) => (
          <NodeRow key={row.node.id} row={row} columns={columns} />
        ))}
      </tbody>
    </table>
  );
};
