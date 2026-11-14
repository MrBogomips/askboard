// Criterion 4 outside the browser, run `latency-bun` (or `latency-node`):
// `bun tools/latency.ts <run> <own|ironcalc|ironcalc-approx> [leaves]`, one fresh process per
// configuration so start-up is cold. Start-up = engine creation (initSync for IronCalc) plus
// the first load with its full evaluation; then runLatency's full recalculation and 50
// single-input edits (median, p95). Writes runs/<run>/<engine>-<leaves>.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LEAVES } from "../fixtures/generate.ts";
import { createIronCalcEngine } from "../src/ironcalc/engine.ts";
import { createOwnEngine } from "../src/own/engine.ts";
import type { FormulaEngine } from "../src/port.ts";
import { runLatency } from "../src/suite.ts";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const [run, which, leavesText] = process.argv.slice(2);
if (!run || !which) {
  console.error("usage: bun tools/latency.ts <run> <own|ironcalc|ironcalc-approx> [leaves]");
  process.exit(2);
}
const leaves = leavesText ? Number(leavesText) : DEFAULT_LEAVES;
const bytes = which === "own" ? null : new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm")));
const t0 = performance.now();
const engine: FormulaEngine = bytes ? createIronCalcEngine(bytes, { exact: which === "ironcalc" }) : createOwnEngine();
const createMs = performance.now() - t0;
const r = runLatency(engine, 50, leaves);
engine.dispose();
const versions = process.versions as Record<string, string | undefined>;
const runtime = versions.bun ? `bun ${versions.bun}` : `node ${versions.node}`;
const out = {
  env: { runtime, platform: `${process.platform} ${process.arch}`, date: new Date().toISOString(), command: `${versions.bun ? "bun" : "node"} tools/latency.ts ${process.argv.slice(2).join(" ")}` },
  engine: which,
  leaves,
  createMs: Math.round(createMs * 1000) / 1000,
  startupMs: Math.round((createMs + r.loadMs) * 1000) / 1000,
  ...r,
  thresholdMs: 16,
  editWithinThreshold: r.editP95Ms <= 16,
};
mkdirSync(join(here, "runs", run), { recursive: true });
writeFileSync(join(here, "runs", run, `${which}-${leaves}.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(`${runtime} ${which} ${r.nodes} nodes: create ${out.createMs} ms, first load ${r.loadMs} ms, full ${r.fullRecalcMs} ms, edit median ${r.editMedianMs} ms, p95 ${r.editP95Ms} ms`);
