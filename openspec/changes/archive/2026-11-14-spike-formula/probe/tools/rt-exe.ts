// Criterion 2, run `rt-exe`: the suite through IronCalc inside a `bun build --compile`
// executable. The .wasm is embedded as a file asset ($bunfs), so the executable needs no
// node_modules. Prints the run file's JSON on stdout. Build and run: see tools/rt-exe.sh.

import { readFileSync } from "node:fs";
// @ts-expect-error Bun's file loader: the import is the embedded file's path.
import wasmPath from "../node_modules/@ironcalc/wasm/wasm_bg.wasm" with { type: "file" };
import { createIronCalcEngine } from "../src/ironcalc/engine.ts";
import { runSuite } from "../src/suite.ts";
import { exeEnvironment } from "./rt-env.ts";

const bytes = new Uint8Array(readFileSync(wasmPath as string));
const r = runSuite(createIronCalcEngine(bytes));
console.log(JSON.stringify({ env: exeEnvironment(), engine: "ironcalc", wasmBytes: bytes.length, suite: r }));
