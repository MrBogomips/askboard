// `bun tools/view-evidence.ts <name> <run> [<run> ...]`: the compact summary of view runs worth
// keeping, in ../evidence/<name>.json (runs/ is gitignored). Per run: the command, the counts,
// and per browser engine and load label the verdicts, hashes, violations, requests and timings.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROBE = join(import.meta.dir, "..");
const [name, ...runs] = process.argv.slice(2);
if (!name || runs.length === 0) {
  console.error("usage: bun tools/view-evidence.ts <name> <run> [<run> ...]");
  process.exit(2);
}

const out: Record<string, unknown> = { written: new Date().toISOString(), runs: {} };
for (const run of runs) {
  const file = join(PROBE, "runs", run, "summary.json");
  if (!existsSync(file)) throw new Error(`no ${file}`);
  const s = JSON.parse(readFileSync(file, "utf8"));
  (out.runs as Record<string, unknown>)[run] = {
    command: s.command,
    date: s.date,
    counts: s.counts,
    build: s.build ? { adapter: s.build.adapter, adapterSource: s.build.adapterSource, wasm: s.build.wasm, chunks: s.build.chunks.map((c: Record<string, unknown>) => ({ name: c.name, bytes: c.bytes, gzip: c.gzip, sha256: c.sha256 })) } : undefined,
    rows: s.rows.map((r: Record<string, unknown>) => {
      const { violationSamples, cspConsole, requestSamples, ...rest } = r;
      return { ...rest, violationSamples, cspConsole: (cspConsole as string[]).map((t) => t.slice(0, 300)), requestSamples };
    }),
  };
}
// One line per row keeps the file small and still diffable.
const text = JSON.stringify(out, null, 2).replace(/\n {8,}/g, " ").replace(/\n {6}([\]}])/g, " $1");
await Bun.write(join(PROBE, "..", "evidence", `${name}.json`), `${text}\n`);
console.log(`wrote evidence/${name}.json (${runs.join(", ")})`);
