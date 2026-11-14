// Size only (criterion 3), before the adapter exists: IronCalc's module and the API calls an
// adapter makes, kept by a global.

import { initSync, Model } from "@ironcalc/wasm";
import { wasmBytes } from "./wasm-bytes.ts";

Object.assign(globalThis, {
  __formulaEngine: () => {
    initSync({ module: wasmBytes() });
    const model = new Model("probe", "en", "UTC", "en");
    return {
      set: (row: number, col: number, input: string) => model.setUserInput(0, row, col, input),
      evaluate: () => model.evaluate(),
      read: (row: number, col: number) => [model.getCellType(0, row, col), model.getCellContent(0, row, col), model.getFormattedCellValue(0, row, col)],
      free: () => model.free(),
    };
  },
});
