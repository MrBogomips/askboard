// How exactly the IronCalc adapter reads numbers, run `precision`: `bun tools/precision.ts`.
// 3,000 seeded doubles (magnitudes 1e-30 to 1e30) and edge cases, each the literal of a
// formula node, read back with exact reads (shadow cells) and with 15-digit reads.
// Writes runs/precision/precision.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createIronCalcEngine } from "../src/ironcalc/engine.ts";
import type { GraphNode } from "../src/port.ts";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const bytes = new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm")));
let a = 7;
const rnd = (): number => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const edge = [0.1 + 0.2, 1 / 3, (796 - 528.8) / 796, 2 ** 53 + 2, 2 ** 52 + 0.5, 1e21, 1.5e-7, 123.456, 1e-40, 3e-45, 1e-50, 1e250, 1.7976931348623157e308];
const xs = [...edge];
for (let i = 0; i < 3000; i++) xs.push(((rnd() - 0.5) * 10 ** Math.floor(rnd() * 61 - 30)) / 3);
const literal = (x: number): string => (x < 0 ? `-${String(-x)}` : String(x));
const nodes: GraphNode[] = xs.map((x, i) => ({ address: `p.v${i}`, type: "number", formula: literal(x) }));
const out: Record<string, unknown> = { env: { runtime: `bun ${process.versions.bun}`, date: new Date().toISOString(), command: "bun tools/precision.ts" }, values: xs.length };
for (const exact of [true, false]) {
  const engine = createIronCalcEngine(bytes, { exact });
  engine.load(nodes);
  const misses: string[] = [];
  xs.forEach((x, i) => {
    const got = engine.read(`p.v${i}`);
    if (got !== x) misses.push(`${x} -> ${JSON.stringify(got)}`);
  });
  engine.dispose();
  out[exact ? "exact" : "fifteenDigits"] = { bitExact: xs.length - misses.length, misses: misses.length, examples: misses.slice(0, 12) };
  console.log(`${exact ? "exact reads" : "15-digit reads"}: ${xs.length - misses.length} of ${xs.length} bit-exact; e.g. ${misses.slice(0, 4).join("; ")}`);
}
mkdirSync(join(here, "runs", "precision"), { recursive: true });
writeFileSync(join(here, "runs", "precision", "precision.json"), `${JSON.stringify(out, null, 2)}\n`);
