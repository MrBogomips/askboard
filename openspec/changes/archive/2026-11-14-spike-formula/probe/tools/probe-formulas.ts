// Extra formulas outside the fixtures, through both engines, to name semantic differences the
// suite surfaced: `bun tools/probe-formulas.ts`. Prints formula | own | ironcalc.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createIronCalcEngine } from "../src/ironcalc/engine.ts";
import { createOwnEngine } from "../src/own/engine.ts";
import { normalise } from "../src/suite.ts";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const bytes = new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm")));
const engines = [createOwnEngine(), createIronCalcEngine(bytes)];
const formulas = ["AND(FALSE,1/0)", "OR(TRUE,1/0)", "AND(FALSE,[x.na])", "IF(FALSE,1/0,2)", "ROUND(1E21,2)", "ROUND(123456789.125,2)", "SUM(1,2)+0.1+0.2", "MAX(1)", "ROUNDUP(1E21,2)", "1+1" + "+1".repeat(998)];
for (const f of formulas) {
  const row = engines.map((e) => {
    e.load([{ address: "x.na", type: "number", formula: "1/0" }, { address: "t.r", type: "number", formula: f }]);
    return JSON.stringify(normalise(e.read("t.r")));
  });
  console.log(`${f.length > 40 ? `${f.slice(0, 20)}... (${f.length} chars)` : f} | ${row.join(" | ")}`);
}
