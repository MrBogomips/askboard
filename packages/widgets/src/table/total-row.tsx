// The Table's Total row (view-and-widgets spec: The Table's grid, Totals and formula columns on the
// board): the last row of the grid, read-only, under each column that has `total: "sum"`, its
// value from the board's graph, "Total" in the first cell; a total in error reads "—" and its
// reason shows on the line under the row. A total that moved against the board as sent takes the
// derived mark.

import { isFormulaError } from "@askboard/compute";
import type { TableColumn } from "@askboard/contract";
import { useLanguage, useLocale, useStrings } from "@askboard/view/catalog";
import type { ReactNode } from "react";
import type { BoardGraph } from "../board-graph/index.ts";
import { CELL, DERIVED, GRID_ERROR, NO_VALUE, TOTAL_ROW, WRAP } from "./classes.ts";
import { shownCell } from "./model/columns.ts";
import { totalResult } from "./model/derived.ts";

export const TotalRow = ({
  itemId,
  columns,
  graph,
  refused,
  derived,
  errors,
}: {
  readonly itemId: string;
  readonly columns: readonly TableColumn[];
  readonly graph: BoardGraph | undefined;
  readonly refused: ReadonlySet<string>;
  /** The fields of the totals that differ from the board as sent. */
  readonly derived: ReadonlySet<string>;
  /** The reasons of the totals in error, ready to show. */
  readonly errors: readonly { readonly key: string; readonly node: ReactNode }[];
}) => {
  const text = useStrings();
  const locale = useLocale();
  const language = useLanguage();
  return (
    <>
      <tr data-total-row="" className={TOTAL_ROW}>
        {columns.map((column, at) => {
          const total = column.total === "sum";
          const result =
            total && !refused.has(column.field)
              ? totalResult(graph, itemId, column.field)
              : undefined;
          const none = result === undefined || isFormulaError(result);
          return (
            <td
              key={column.field}
              data-total={total ? column.field : undefined}
              data-derived={derived.has(column.field) ? "" : undefined}
              className={`${CELL[column.type]} ${WRAP} ${derived.has(column.field) ? DERIVED : ""}`}
            >
              {at === 0 ? <span className="mr-2 font-semibold">{text("table.total")}</span> : null}
              {total ? (
                <span className={none ? NO_VALUE : undefined}>
                  {none ? text("table.noValue") : shownCell(column, result, locale, language)}
                </span>
              ) : null}
            </td>
          );
        })}
      </tr>
      {errors.map((error) => (
        // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: the error's line is no row of the grid.
        <tr key={error.key} role="presentation">
          <td colSpan={columns.length} className={GRID_ERROR}>
            {error.node}
          </td>
        </tr>
      ))}
    </>
  );
};
