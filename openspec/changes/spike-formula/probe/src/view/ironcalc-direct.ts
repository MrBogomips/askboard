// IronCalc's view chunk before the adapter exists: IronCalc's own API, for the smoke test only
// (one formula without references in one cell).

import "./mark.ts";
import { initSync, Model } from "@ironcalc/wasm";
import type { FormulaEngine, GraphNode } from "../port.ts";
import { runView } from "./runner.ts";
import { wasmBytes } from "./wasm-bytes.ts";

function directEngine(): FormulaEngine {
  let model = new Model("probe", "en", "UTC", "en");
  const rows = new Map<string, number>();
  return {
    id: "ironcalc",
    load(nodes: readonly GraphNode[]) {
      model = new Model("probe", "en", "UTC", "en");
      rows.clear();
      nodes.forEach((n, i) => {
        rows.set(n.address, i + 1);
        model.setUserInput(0, i + 1, 1, n.formula !== undefined ? `=${n.formula}` : String(n.value ?? ""));
      });
      model.evaluate();
      return { warnings: [] };
    },
    set: () => undefined,
    recalc: () => model.evaluate(),
    read(address) {
      const text = model.getFormattedCellValue(0, rows.get(address) ?? 1, 1);
      const value = Number(text);
      return Number.isNaN(value) ? text : value;
    },
    dispose: () => model.free(),
  };
}

runView({
  id: "ironcalc",
  prepare: () => initSync({ module: wasmBytes() }),
  create: directEngine,
  unsupported: ["suite", "latency", "timing"],
});
