// A work breakdown's Total row (molecules design decision 14; view spec, "WBS layout"): the last
// row of the treegrid, read-only, with no level and no node, labelled "Total", holding the item's
// expected effort and spread under the value columns and nothing under the fields. A work
// breakdown of one top-level package has none: that package's row shows the totals.

import type { TreeColumn } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { PERT_HEADERS } from "./cells.ts";
import { FIELD_CELL, NAME_CELL, PARENT_NAME, ROW } from "./classes.ts";
import type { PertValues } from "./model/pert.ts";
import { ValueCells, ValueError } from "./row.tsx";

export const TotalRow = ({
  columns,
  values,
}: {
  readonly columns: readonly TreeColumn[];
  readonly values: PertValues;
}) => {
  const text = useStrings();
  return (
    <>
      <tr data-total-row="" className={ROW}>
        <td data-cell={0} className={NAME_CELL}>
          <span className={PARENT_NAME}>{text("tree.total")}</span>
        </td>
        {columns.map((column, at) => (
          <td key={column.field} data-cell={at + 1} className={FIELD_CELL[column.type]} />
        ))}
        <ValueCells values={values} first={1 + columns.length} />
      </tr>
      <ValueError values={values} cells={1 + columns.length + PERT_HEADERS.length} />
    </>
  );
};
