// Compares the verdicts of a run with those of earlier runs, per engine, fixture and renderer
// (group 5: the build's tree-shaking fix must change no earlier verdict), and the number of
// violations of each load. Loads present in only one side are listed apart.
//
// Usage, from probe/: bun tools/compare-runs.ts <new run> <old run>[,<old run>…]

import { join } from "node:path";

type Row = { fixture: string; renderer: string; verdict: string; reasons: string[]; violations?: unknown[] };
type Summary = { engines: Record<string, { results?: Row[] }> };

const verdicts = async (run: string): Promise<Map<string, Row>> => {
  const summary = (await Bun.file(join(import.meta.dir, "..", "runs", run, "summary.json")).json()) as Summary;
  const rows = new Map<string, Row>();
  for (const [engine, { results = [] }] of Object.entries(summary.engines)) {
    for (const row of results) rows.set(`${engine} ${row.fixture} ${row.renderer}`, row);
  }
  return rows;
};

const [current, previous] = process.argv.slice(2);
if (!current || !previous) throw new Error("usage: bun tools/compare-runs.ts <new run> <old run>[,<old run>…]");
const now = await verdicts(current);
const before = new Map<string, Row>();
for (const run of previous.split(",")) for (const [key, row] of await verdicts(run)) before.set(key, row);

let same = 0;
const changed: string[] = [];
const counts: string[] = [];
const onlyNew: string[] = [];
for (const [key, row] of now) {
  const old = before.get(key);
  if (!old) onlyNew.push(`${key}: ${row.verdict}`);
  else if (old.verdict === row.verdict) {
    same += 1;
    const [a, b] = [old.violations?.length ?? 0, row.violations?.length ?? 0];
    if (a !== b) counts.push(`${key}: ${a} -> ${b} violation(s)`);
  } else changed.push(`${key}: ${old.verdict} -> ${row.verdict} (${row.reasons.join("; ").slice(0, 200)})`);
}
const onlyOld = [...before.keys()].filter((key) => !now.has(key));
console.log(
  `${current} against ${previous}: ${same} same verdict, ${changed.length} changed; ` +
    `${same - counts.length} of the same with the same number of violations`,
);
for (const line of changed) console.log(`  changed: ${line}`);
for (const line of counts) console.log(`  violations: ${line}`);
if (onlyNew.length) console.log(`  only in ${current}: ${onlyNew.join(", ")}`);
if (onlyOld.length) console.log(`  not in ${current}: ${onlyOld.length} load(s)`);
process.exit(changed.length > 0 ? 1 : 0);
