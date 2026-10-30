// Summarises a diagram run for findings.md: per fixture and engine, the verdict, the violations
// by directive (counted once per event, view and board policies together), and per diagram item
// whether it rendered, the image's scheme and outcome, the anchors, the render time and any error.
//
// Usage, from probe/: bun tools/diagram-report.ts <run> [--json]
//        bun tools/diagram-report.ts <run> --sites <engine> <fixture>
// --sites maps each view violation of one load to the code that caused it: the srcdoc is
// assembled again from dist/ (as the run's options say), and the violation's line and column
// point into it. Run it before the next `bun run build` changes the chunks.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { assemble, loadBuild } from "../assemble.ts";
import { loadFixtures } from "../board.ts";

type Event = { kind: string; [key: string]: unknown };
type Load = {
  engine: string;
  fixture: string;
  verdict: string;
  reasons: string[];
  timeToVisibleMs: number | null;
  probe: { events: Event[]; board: Event[] };
  requests: { url: string; failure?: string }[];
};

const run = process.argv[2];
if (!run) throw new Error("usage: bun tools/diagram-report.ts <run> [--json]");
const dir = join(import.meta.dir, "..", "runs", run);

const sites = process.argv.indexOf("--sites");
if (sites > 0) {
  const [engine, fixtureName] = [process.argv[sites + 1], process.argv[sites + 2]];
  const summary = await Bun.file(join(dir, "summary.json")).json();
  const load = (await Bun.file(join(dir, String(engine), `${fixtureName}.own.json`)).json()) as Load;
  const fixture = (await loadFixtures()).get(String(fixtureName));
  if (!fixture) throw new Error(`no fixture ${fixtureName}`);
  const build = await loadBuild(join(import.meta.dir, "..", "dist"));
  const html = assemble(fixture.board, build, { renderer: "own", variants: summary.options.variants }).html;
  const lines = html.split("\n");
  const counts = new Map<string, number>();
  for (const v of load.probe.events.filter((e) => e.kind === "violation")) {
    const text = lines[Number(v.line) - 1] ?? "";
    const at = Number(v.column) - 1;
    const key = `${v.directive} line ${v.line} column ${v.column}: …${text.slice(Math.max(0, at - 90), at + 40)}…`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of counts) console.log(`${n}× ${key}`);
  process.exit(0);
}

const rows = [];
for (const engine of readdirSync(dir).filter((d) => !d.includes(".") && d !== "snapshots")) {
  for (const file of readdirSync(join(dir, engine)).filter((f) => f.endsWith(".json")).sort()) {
    const load = (await Bun.file(join(dir, engine, file)).json()) as Load;
    const violations = [
      ...load.probe.events.filter((e) => e.kind === "violation"),
      ...load.probe.board.filter((e) => !String(e.blockedURI).endsWith("/favicon.ico")),
    ];
    const byDirective: Record<string, number> = {};
    for (const v of violations) {
      const key = `${v.directive}${String(v.blockedURI).startsWith("http") ? ` ${new URL(String(v.blockedURI)).pathname}` : v.blockedURI && v.blockedURI !== "inline" ? ` ${v.blockedURI}` : ""}`;
      byDirective[key] = (byDirective[key] ?? 0) + 1;
    }
    const events = load.probe.events;
    const ids = [...new Set(events.filter((e) => e.kind.startsWith("diagram-")).map((e) => String(e.id)))];
    const diagrams = ids.map((id) => {
      const mine = events.filter((e) => e.kind.startsWith("diagram-") && e.id === id);
      const render = mine.filter((e) => e.kind === "diagram-render").at(-1);
      const image = mine.filter((e) => e.kind === "diagram-image").at(-1);
      const error = mine.filter((e) => e.kind === "diagram-error").at(-1);
      return {
        id,
        engine: render?.engine ?? error?.engine,
        rendered: render !== undefined,
        renderMs: render?.renderMs ?? null,
        anchors: Array.isArray(render?.anchors) ? render.anchors.length : null,
        image: image ? `${image.scheme} ${image.loaded ? "loaded" : "blocked"}` : "none",
        error: error ? String(error.message).slice(0, 160) : null,
      };
    });
    const requests = load.requests.filter(
      (r) => !/\/(b|v)\//.test(new URL(r.url).pathname) && !r.url.startsWith("blob:") && !r.url.startsWith("file:"),
    );
    rows.push({
      engine,
      fixture: file.replace(/\.json$/, ""),
      verdict: load.verdict,
      visibleMs: load.timeToVisibleMs,
      violations: violations.length,
      byDirective,
      requests: requests.map((r) => `${new URL(r.url).pathname}${r.failure ? ` (${r.failure})` : ""}`),
      diagrams,
    });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const row of rows) {
    const directives = Object.entries(row.byDirective)
      .map(([d, n]) => `${d} ×${n}`)
      .join(", ");
    const diagrams = row.diagrams
      .map((d) => `${d.id}: ${d.rendered ? `rendered ${d.renderMs} ms, ${d.anchors} anchors` : "not rendered"}, image ${d.image}${d.error ? `, error "${d.error}"` : ""}`)
      .join("; ");
    console.log(
      `${row.engine.padEnd(8)} ${row.fixture.padEnd(34)} ${row.verdict.padEnd(6)} ${String(row.visibleMs).padStart(6)} ms  violations ${row.violations}${directives ? ` (${directives})` : ""}  ${diagrams}${row.requests.length ? `  requests ${row.requests.join(" ")}` : ""}`,
    );
  }
}
