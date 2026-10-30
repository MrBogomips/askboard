// Criterion 8: per whitelist function or operator, how many fixture cases a run passes.
// `bun tools/whitelist-column.ts runs/<run>/<engine>.json` prints one line per `op`, with the
// failing and inexact cases named.

import { readFileSync } from "node:fs";
import { WHITELIST_CASES } from "../src/fixtures.ts";
import { compareValue, normalise } from "../src/suite.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: bun tools/whitelist-column.ts <run file>");
  process.exit(2);
}
const results = (JSON.parse(readFileSync(path, "utf8")) as { suite: { results: Record<string, Record<string, unknown>> } }).suite.results;
const byOp = new Map<string, { total: number; passed: number; notes: string[] }>();
for (const c of WHITELIST_CASES) {
  const row = byOp.get(c.op) ?? { total: 0, passed: 0, notes: [] };
  byOp.set(c.op, row);
  row.total++;
  const r = results[`whitelist:${c.id}`] ?? {};
  const value = compareValue(normalise(c.expected as never), r["t.r"]);
  const warnings = r["@warnings"] === [...new Set((c.warnings ?? []).map((w) => `${w.error}@${w.address}`))].sort().join(" ");
  if (value !== "fail" && warnings) row.passed++;
  if (value === "fail") row.notes.push(`${c.id}: ${c.formula} expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(r["t.r"])}`);
  else if (value === "exact-mismatch") row.notes.push(`${c.id} inexact: ${c.formula} = ${JSON.stringify(r["t.r"])}, expected ${JSON.stringify(c.expected)}`);
  if (!warnings) row.notes.push(`${c.id}: warnings ${JSON.stringify(r["@warnings"])}`);
}
for (const [op, row] of byOp) console.log(`${op} | ${row.passed}/${row.total}${row.notes.length ? ` | ${row.notes.join("; ")}` : ""}`);
