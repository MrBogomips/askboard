// The Table's grid (design decision 9; view-and-widgets spec: The Table's grid): a `table` whose
// role is `grid`, named by its caption, the Table's `label`; a header row of the columns' labels,
// a computed column's marked "Computed" with its formula as the header's description (agent text,
// shown as text, in the title and in a description a screen reader reads); one row per row of the
// value, and the Total row. The grid's column problems show once over it. One cell, the focus, is
// the Tab stop. The grid handles its cells' events; the frame scrolls it sideways when it is wider
// than the frame.

import type { TableColumn, TableProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import type {
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  Ref,
} from "react";
import {
  CAPTION,
  COMPUTED,
  GRID,
  GRID_ERROR,
  GRID_ERRORS,
  HEADER,
  HEADER_ROW,
  HIDDEN_TEXT,
  SCROLL,
} from "./classes.ts";
import { isInputColumn } from "./model/columns.ts";
import { NodeRow, type NodeRowProps } from "./row.tsx";
import { TotalRow } from "./total-row.tsx";

const Header = ({ column, itemId }: { readonly column: TableColumn; readonly itemId: string }) => {
  const text = useStrings();
  const computed = !isInputColumn(column);
  const descriptionId = `${itemId}:${column.field}:formula`;
  return (
    <th
      scope="col"
      title={computed ? column.formula : undefined}
      aria-describedby={computed ? descriptionId : undefined}
      className={HEADER[column.type]}
    >
      {column.label}
      {computed ? (
        <>
          <span data-computed="" className={COMPUTED}>
            {text("table.computed")}
          </span>
          <span id={descriptionId} className={HIDDEN_TEXT}>
            {column.formula}
          </span>
        </>
      ) : null}
    </th>
  );
};

/** What the grid needs of each row beyond the row itself: `RowProps` less what the grid fixes. */
export type GridRow = Omit<NodeRowProps, "itemId" | "columns" | "graph" | "refused" | "lineText">;

export const TableGrid = ({
  ref,
  itemId,
  captionId,
  labelledBy,
  value,
  rows,
  graph,
  refused,
  problems,
  totals,
  lineText,
  onKeyDown,
  onFocus,
  onMouseDown,
  onClick,
  onDoubleClick,
}: {
  readonly ref: Ref<HTMLTableElement>;
  readonly itemId: string;
  readonly captionId: string;
  /** The question's text, which names the grid when the Table has no label. */
  readonly labelledBy: string;
  readonly value: TableProps;
  readonly rows: readonly GridRow[];
  readonly graph: NodeRowProps["graph"];
  readonly refused: ReadonlySet<string>;
  /** The column problems, shown once over the grid, ready to show. */
  readonly problems: readonly { readonly key: string; readonly text: string }[];
  /** The Total row's derived marks and errors; none for a Table with no total. */
  readonly totals:
    | {
        readonly derived: ReadonlySet<string>;
        readonly errors: readonly { readonly key: string; readonly node: ReactNode }[];
      }
    | undefined;
  readonly lineText: NodeRowProps["lineText"];
  readonly onKeyDown: KeyboardEventHandler<HTMLTableElement>;
  readonly onFocus: FocusEventHandler<HTMLTableElement>;
  readonly onMouseDown: MouseEventHandler<HTMLTableElement>;
  readonly onClick: MouseEventHandler<HTMLTableElement>;
  readonly onDoubleClick: MouseEventHandler<HTMLTableElement>;
}) => {
  const { columns } = value;
  return (
    <>
      {problems.length === 0 ? null : (
        <div data-table-problems="" className={GRID_ERRORS}>
          {problems.map((problem) => (
            <p key={problem.key} className={GRID_ERROR}>
              {problem.text}
            </p>
          ))}
        </div>
      )}
      <div className={SCROLL}>
        <table
          ref={ref}
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a grid is a table the user moves through (WAI-ARIA APG, Grid); the table gives its rows, cells and headers their roles.
          role="grid"
          aria-labelledby={value.label === undefined ? labelledBy : captionId}
          className={GRID}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        >
          {value.label === undefined ? null : (
            <caption id={captionId} className={CAPTION}>
              {value.label}
            </caption>
          )}
          <thead>
            <tr className={HEADER_ROW}>
              {columns.map((column) => (
                <Header key={column.field} column={column} itemId={itemId} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <NodeRow
                key={row.row.id}
                itemId={itemId}
                columns={columns}
                graph={graph}
                refused={refused}
                lineText={lineText}
                {...row}
              />
            ))}
            {totals === undefined ? null : (
              <TotalRow
                itemId={itemId}
                columns={columns}
                graph={graph}
                refused={refused}
                derived={totals.derived}
                errors={totals.errors}
              />
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
