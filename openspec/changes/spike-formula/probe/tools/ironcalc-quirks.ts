// IronCalc 0.9.1 used raw, without the adapter, run `ironcalc-quirks`:
// `bun tools/ironcalc-quirks.ts` writes runs/ironcalc-quirks/quirks.json with what the engine
// stores and shows for formulas the AskBoard grammar refuses, error short-circuits and number
// formats. `bun tools/ironcalc-quirks.ts chain <n>` tries one formula of n "+" operators in
// this fresh process (a crash poisons the module instance, so it gets its own process).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initSync, Model } from "@ironcalc/wasm";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
initSync({ module: new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm"))) });
const model = new Model("quirks", "en", "UTC", "en");

if (process.argv[2] === "chain") {
  const n = Number(process.argv[3]);
  try {
    model.setUserInput(0, 1, 1, `=1${"+1".repeat(n)}`);
    console.log(`chain ${n}: ${model.getFormattedCellValue(0, 1, 1)}`);
  } catch (e) {
    console.log(`chain ${n}: threw ${String(e).split("(")[0]}`);
  }
  process.exit(0);
}

let row = 0;
function cell(input: string, format?: string): { input: string; stored: string; type: number; shown: string } {
  row++;
  model.setUserInput(0, row, 1, input);
  if (format) model.updateRangeStyle({ sheet: 0, row, column: 1, width: 1, height: 1 }, "num_fmt", format);
  return { input, stored: model.getCellContent(0, row, 1), type: model.getCellType(0, row, 1), shown: model.getFormattedCellValue(0, row, 1) };
}
const lenient = ["=1 2", "=(1)(2)", "=1(2)", "=TRUE TRUE", '="a" "b"', "=1;2", "=SUM(1,,2)", "=IF(,1,2)", "=(1+2", "=1+2)", "={1,2}", "=MAX()", "=ROUND(1)", "=1e309", "=1+"].map((f) => cell(f));
const shortCircuit = ["=AND(FALSE,1/0)", "=OR(TRUE,1/0)", "=AND(TRUE,1/0)", "=ROUND(1E21,2)"].map((f) => cell(f, "0"));
const formats = [
  cell("=0.1+0.2", "0.0000000000000000E+00"),
  cell("=1/3", "0.0000000000000000E+00"),
  cell("=1/3", "General"),
  cell("=2/3*1E-300", "0.00000000000000E+00"),
  cell("1.7976931348623157E+308", "0.00000000000000E+00"),
  cell("=0.1+0.2", "0.################################"),
  cell("=(0.1+0.2)*2^200", "0"),
  cell("1e-15"),
];
const out = { env: { runtime: `bun ${process.versions.bun}`, date: new Date().toISOString(), command: "bun tools/ironcalc-quirks.ts" }, lenient, shortCircuit, formats };
mkdirSync(join(here, "runs", "ironcalc-quirks"), { recursive: true });
writeFileSync(join(here, "runs", "ironcalc-quirks", "quirks.json"), `${JSON.stringify(out, null, 2)}\n`);
for (const group of [lenient, shortCircuit, formats]) for (const c of group) console.log(`${c.input} | stored ${c.stored} | type ${c.type} | shown ${c.shown}`);
