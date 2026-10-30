// Criterion 4: IronCalc's initSync alone (WebAssembly compile + instantiate), cold, in a
// fresh process: `bun tools/init-time.ts` or `node tools/init-time.ts`. Prints one JSON line;
// also times `new WebAssembly.Module(bytes)` (compile only) 20 more times in the same process.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initSync } from "@ironcalc/wasm";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const bytes = new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm")));
let t = performance.now();
initSync({ module: bytes });
const initMs = performance.now() - t;
const compiles: number[] = [];
const W = (globalThis as unknown as { WebAssembly: { Module: new (b: Uint8Array) => unknown } }).WebAssembly;
for (let i = 0; i < 20; i++) {
  t = performance.now();
  new W.Module(bytes);
  compiles.push(performance.now() - t);
}
compiles.sort((a, b) => a - b);
const versions = process.versions as Record<string, string | undefined>;
console.log(JSON.stringify({ runtime: versions.bun ? `bun ${versions.bun}` : `node ${versions.node}`, initSyncMs: Math.round(initMs * 1000) / 1000, compileMedianMs: Math.round((compiles[10] as number) * 1000) / 1000 }));
