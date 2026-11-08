// One row of the Table's grid (design decision 9; view-and-widgets spec: The Table's grid, Typed
// cells in the ask's locale, Changes shown apart, Formula errors on the board): a table row whose
// cells are `gridcell`s, the Tab stop's cell in the Tab order. An input cell shows its value in the
// ask's locale, or the text a user typed that gives no value (a cell entry, in the destructive
// border); a computed cell shows the board's value or "—"; a toggle cell is a gridcell with
// `aria-checked` and no control inside. A changed cell takes the change highlight, an added row the
// change bar, a computed cell whose value moved the derived mark. Agent and user text is a text
// child, which React escapes, and wraps (AD-8). The lines under the row are no rows of the grid.

import { isFormulaError } from "@askboard/compute";
import type { TableColumn, TableRow } from "@askboard/contract";
import { useLanguage, useLocale, useStrings } from "@askboard/view/catalog";
import { memo, type ReactNode } from "react";
import type { BoardGraph } from "../board-graph/index.ts";
import {
  ADDED_BAR,
  CELL,
  CHANGED_FIELD,
  CURRENT_ROW,
  DERIVED,
  ENTRY,
  FOCUS_RING,
  NO_VALUE,
  NOT_SELECTABLE,
  ROW,
  ROW_ERROR,
} from "./classes.ts";
import { ariaChecked, isInputColumn, shownCell } from "./model/columns.ts";
import { cellResult } from "./model/derived.ts";

/** The cell of a row being edited: its editor, which takes the cell's place. */
export type RowEditing = {
  readonly field: string;
  readonly editor: ReactNode;
};

/** A line under a row: the column's name and the reason, or one sentence. */
export type RowLine = {
  readonly key: string;
  /** The ID the line takes while an editor it describes is open. */
  readonly id?: string | undefined;
  readonly column: string | undefined;
  readonly text: string;
};

const held = (row: TableRow, field: string): unknown =>
  Object.hasOwn(row, field) ? row[field] : undefined;

// A computed cell: the graph's value, "—" when the column's formula was refused, the cell holds an
// error or the graph holds no number there.
const ComputedText = ({
  column,
  itemId,
  rowId,
  graph,
  refused,
}: {
  readonly column: TableColumn;
  readonly itemId: string;
  readonly rowId: string;
  readonly graph: BoardGraph | undefined;
  readonly refused: boolean;
}) => {
  const locale = useLocale();
  const language = useLanguage();
  const text = useStrings();
  const result = refused ? undefined : cellResult(graph, itemId, rowId, column.field, column);
  if (result === undefined || isFormulaError(result)) {
    return <span className={NO_VALUE}>{text("table.noValue")}</span>;
  }
  return <span>{shownCell(column, result, locale, language)}</span>;
};

const cellClass = (
  column: TableColumn,
  state: { edited: boolean; changed: boolean; derived: boolean; first: boolean; added: boolean },
): string => {
  const parts = [CELL[column.type], FOCUS_RING];
  if (!state.edited) parts.push(NOT_SELECTABLE);
  if (state.changed) parts.push(CHANGED_FIELD);
  if (state.derived) parts.push(DERIVED);
  if (state.first && state.added) parts.push(ADDED_BAR);
  return parts.join(" ");
};

export type NodeRowProps = {
  readonly itemId: string;
  readonly row: TableRow;
  /** The row's place, from 1, which names its cells. */
  readonly position: number;
  readonly columns: readonly TableColumn[];
  /** The field of the cell that holds the grid's Tab stop, when it is in this row. */
  readonly stop: string | undefined;
  readonly current: boolean;
  /** The Table takes edits: its input cells are marked for the hover layer. */
  readonly editable: boolean;
  readonly added: boolean;
  /** The input fields the user changed in this row. */
  readonly changed: ReadonlySet<string> | undefined;
  /** The computed fields whose value moved against the board as sent. */
  readonly derived: ReadonlySet<string> | undefined;
  readonly graph: BoardGraph | undefined;
  /** The fields of the computed columns whose formula the build refused. */
  readonly refused: ReadonlySet<string>;
  /** The text of each cell entry of this row, by field. */
  readonly entries: ReadonlyMap<string, string> | undefined;
  readonly editing: RowEditing | undefined;
  readonly lines: readonly RowLine[];
  readonly lineText: (line: RowLine) => ReactNode;
};

export const NodeRow = memo(function NodeRow({
  itemId,
  row,
  columns,
  stop,
  current,
  editable,
  added,
  changed,
  derived,
  graph,
  refused,
  entries,
  editing,
  lines,
  lineText,
}: NodeRowProps) {
  const locale = useLocale();
  const language = useLanguage();
  return (
    <>
      <tr
        data-row-id={row.id}
        data-change={added ? "added" : undefined}
        aria-current={current ? "true" : undefined}
        className={`${ROW} ${current ? CURRENT_ROW : ""}`}
      >
        {columns.map((column, at) => {
          const input = isInputColumn(column);
          const edited = editing?.field === column.field;
          const entry = input && !edited ? entries?.get(column.field) : undefined;
          const isChanged = input && !edited && changed?.has(column.field) === true;
          const isDerived = !input && derived?.has(column.field) === true;
          const value = held(row, column.field);
          return (
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: a toggle cell is a gridcell holding a state (WAI-ARIA APG, Grid); `aria-checked` is its own.
            <td
              key={column.field}
              data-table-cell=""
              data-row={row.id}
              data-field={column.field}
              data-editable={editable && input && !edited ? "" : undefined}
              data-change={isChanged ? "field" : undefined}
              data-derived={isDerived ? "" : undefined}
              data-entry={entry === undefined ? undefined : ""}
              aria-checked={column.type === "toggle" && input ? ariaChecked(value) : undefined}
              aria-readonly={input ? undefined : true}
              tabIndex={stop === column.field ? 0 : -1}
              className={cellClass(column, {
                edited,
                changed: isChanged,
                derived: isDerived,
                first: at === 0,
                added,
              })}
            >
              {edited ? (
                editing?.editor
              ) : !input ? (
                <ComputedText
                  column={column}
                  itemId={itemId}
                  rowId={row.id}
                  graph={graph}
                  refused={refused.has(column.field)}
                />
              ) : entry === undefined ? (
                shownCell(column, value, locale, language)
              ) : (
                <span className={ENTRY}>{entry}</span>
              )}
            </td>
          );
        })}
      </tr>
      {lines.map((line) => (
        // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: the error's line is no row of the grid; the editor's aria-describedby reads it.
        <tr key={line.key} role="presentation" data-row-error="">
          <td colSpan={columns.length} className={ROW_ERROR}>
            {lineText(line)}
          </td>
        </tr>
      ))}
    </>
  );
});
