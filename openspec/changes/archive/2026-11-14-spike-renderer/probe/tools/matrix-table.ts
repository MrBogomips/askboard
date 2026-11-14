// Task 4.1's component-by-engine matrix from one or more runs: per fixture and engine, the
// verdict with its violations counted by directive, and the reasons of a failure. With
// `--storage`, the storage and worker accesses every load recorded instead (S-5, task 4.6).
//
// Usage, from probe/: bun tools/matrix-table.ts <run> [<run>…] [--storage]

import { join } from "node:path";

const args = process.argv.slice(2);
const storage = args.includes("--storage");
const runs = args.filter((a) => !a.startsWith("--"));
const ENGINES = ["chromium", "firefox", "webkit", "chrome", "msedge"];

type Result = {
  fixture: string;
  verdict: string;
  reasons: string[];
  violations: { directive?: string; policy?: string }[];
  storage: { kind: string; api?: string; op?: string; outcome?: string }[];
  cspConsole?: string[];
};
type Summary = { engines: Record<string, { results?: Result[]; untested?: string }> };

const cell = (r: Result | undefined): string => {
  if (!r) return "—";
  const byDirective = new Map<string, number>();
  for (const v of r.violations) {
    const policy = String(v.policy ?? "").includes("connect-src 'self'") ? "board" : "view";
    const key = `${v.directive} (${policy})`;
    byDirective.set(key, (byDirective.get(key) ?? 0) + 1);
  }
  const counts = [...byDirective].map(([k, n]) => `${n} ${k}`).join(", ");
  const other = r.reasons.filter((x) => !/violation|CSP console/.test(x)).map((x) => x.slice(0, 90));
  return [r.verdict, counts, ...other].filter(Boolean).join("; ");
};

for (const run of runs) {
  const summary = (await Bun.file(join(import.meta.dir, "..", "runs", run, "summary.json")).json()) as Summary;
  const fixtures = [...new Set(Object.values(summary.engines).flatMap((e) => (e.results ?? []).map((r) => r.fixture)))];
  console.log(`\n### ${run}\n`);
  if (storage) {
    const rows = new Map<string, Set<string>>();
    for (const [engine, { results = [] }] of Object.entries(summary.engines)) {
      for (const r of results) {
        for (const s of r.storage) {
          const key = `${r.fixture} | ${s.api ?? s.kind} | ${s.op ?? ""} ${s.outcome ?? ""}`.trim();
          rows.set(key, (rows.get(key) ?? new Set()).add(engine));
        }
      }
    }
    if (rows.size === 0) console.log(`no storage or worker access in ${fixtures.length} fixtures × ${Object.keys(summary.engines).length} engines`);
    for (const [key, engines] of rows) console.log(`| ${key} | ${[...engines].join(", ")} |`);
    continue;
  }
  console.log(`| Fixture | ${ENGINES.join(" | ")} |`);
  console.log(`| --- | ${ENGINES.map(() => "---").join(" | ")} |`);
  for (const fixture of fixtures) {
    const cells = ENGINES.map((engine) => {
      const e = summary.engines[engine];
      if (!e) return "—";
      if (e.untested) return `untested: ${e.untested}`;
      return cell(e.results?.find((r) => r.fixture === fixture));
    });
    console.log(`| \`${fixture}\` | ${cells.join(" | ")} |`);
  }
}
