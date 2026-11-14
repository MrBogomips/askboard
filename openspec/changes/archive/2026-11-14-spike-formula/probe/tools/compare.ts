// Compares the results of two run files value by value: `bun tools/compare.ts <a.json> <b.json>`.
// Prints every address whose value differs (exactly, or beyond the suite's tolerance) and a
// summary line. Used for own versus IronCalc (criterion 5) and runtime versus runtime.

import { readFileSync } from "node:fs";
import { compareValue } from "../src/suite.ts";

type Results = Record<string, Record<string, unknown>>;

function results(path: string): Results {
  const file = JSON.parse(readFileSync(path, "utf8")) as { suite?: { results?: Results } };
  if (!file.suite?.results) throw new Error(`${path} has no suite results`);
  return file.suite.results;
}

export function compareResults(a: Results, b: Results): { same: number; exact: string[]; differ: string[]; missing: string[] } {
  const out = { same: 0, exact: [] as string[], differ: [] as string[], missing: [] as string[] };
  const fixtures = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const f of fixtures) {
    const x = a[f] ?? {};
    const y = b[f] ?? {};
    for (const address of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
      const key = `${f} ${address}`;
      if (!(address in x) || !(address in y)) {
        out.missing.push(key);
        continue;
      }
      const u = x[address];
      const v = y[address];
      if (JSON.stringify(u) === JSON.stringify(v)) out.same++;
      else if (compareValue(u, v) === "exact-mismatch") out.exact.push(`${key}: ${JSON.stringify(u)} vs ${JSON.stringify(v)}`);
      else out.differ.push(`${key}: ${JSON.stringify(u)} vs ${JSON.stringify(v)}`.slice(0, 400));
    }
  }
  return out;
}

if (import.meta.main ?? process.argv[1]?.endsWith("compare.ts")) {
  const [pa, pb] = process.argv.slice(2);
  if (!pa || !pb) {
    console.error("usage: bun tools/compare.ts <a.json> <b.json>");
    process.exit(2);
  }
  const r = compareResults(results(pa), results(pb));
  for (const line of r.differ) console.log(`differs  ${line}`);
  for (const line of r.exact) console.log(`exact    ${line}`);
  for (const line of r.missing) console.log(`missing  ${line}`);
  console.log(`same ${r.same}, exact mismatches ${r.exact.length}, differences ${r.differ.length}, missing ${r.missing.length}`);
}
