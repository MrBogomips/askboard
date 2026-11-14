// Criterion 5: reads runs/det-*/{own,ironcalc}.json and reports each engine's hashes per
// runtime, zone and locale, then the values on which the two engines differ (one combination,
// since every combination has one hash per engine). Writes runs/det-summary.json.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareResults } from "./compare.ts";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const runs = readdirSync(join(here, "runs"), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("det-")).map((d) => d.name).sort();
type RunFile = { env: Record<string, unknown>; suite: { passed: number; failed: number; hash: string; results: Record<string, Record<string, unknown>> } };
const rows: Array<Record<string, unknown>> = [];
const hashes: Record<string, Set<string>> = { own: new Set(), ironcalc: new Set() };
let sample: Record<string, RunFile> = {};
for (const run of runs) {
  const files: Record<string, RunFile> = {};
  for (const engine of ["own", "ironcalc"]) {
    const f = JSON.parse(readFileSync(join(here, "runs", run, `${engine}.json`), "utf8")) as RunFile;
    files[engine] = f;
    hashes[engine]?.add(f.suite.hash);
  }
  const own = files.own as RunFile;
  const ic = files.ironcalc as RunFile;
  rows.push({ run, runtime: own.env.runtime, tz: own.env.tz, lang: own.env.lang, resolvedTimeZone: own.env.resolvedTimeZone, own: `${own.suite.passed}/${own.suite.failed} ${own.suite.hash.slice(0, 16)}`, ironcalc: `${ic.suite.passed}/${ic.suite.failed} ${ic.suite.hash.slice(0, 16)}` });
  sample = files;
}
const diff = compareResults((sample.own as RunFile).suite.results, (sample.ironcalc as RunFile).suite.results);
const out = {
  runs: rows,
  ownHashes: [...(hashes.own ?? [])],
  ironcalcHashes: [...(hashes.ironcalc ?? [])],
  ownVersusIronCalc: { same: diff.same, exactMismatches: diff.exact, differences: diff.differ },
};
writeFileSync(join(here, "runs", "det-summary.json"), `${JSON.stringify(out, null, 2)}\n`);
for (const r of rows) console.log(Object.values(r).join(" | "));
console.log(`own hashes: ${out.ownHashes.length} distinct; ironcalc hashes: ${out.ironcalcHashes.length} distinct`);
console.log(`own vs ironcalc: same ${diff.same}, exact mismatches ${diff.exact.length}, differences ${diff.differ.length}`);
for (const l of [...diff.differ, ...diff.exact]) console.log(`  ${l}`);
