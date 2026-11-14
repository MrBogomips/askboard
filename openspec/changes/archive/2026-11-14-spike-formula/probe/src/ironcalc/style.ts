// Number formats on formula cells, one `updateRangeStyle` call per run of consecutive rows
// in a column (a call per cell would cost a WASM round trip each).

import type { Model } from "@ironcalc/wasm";
import type { Cell } from "./layout.ts";

export function formatRuns(model: Model, cells: readonly Cell[], sheetOffset: number, format: string): void {
  const sorted = [...cells].sort((a, b) => a.sheet - b.sheet || a.col - b.col || a.row - b.row);
  let i = 0;
  while (i < sorted.length) {
    const first = sorted[i] as Cell;
    let j = i + 1;
    while (j < sorted.length) {
      const c = sorted[j] as Cell;
      if (c.sheet !== first.sheet || c.col !== first.col || c.row !== first.row + (j - i)) break;
      j++;
    }
    model.updateRangeStyle({ sheet: sheetOffset + first.sheet, row: first.row, column: first.col, width: 1, height: j - i }, "num_fmt", format);
    i = j;
  }
}
