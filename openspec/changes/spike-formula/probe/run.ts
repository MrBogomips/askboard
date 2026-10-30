// The runner: `bun run.ts <run> [--engine own|ironcalc|both] [--only <parts>] [--repeats N] [--leaves N]`
// writes runs/<run>/<engine>.json (and refs.json, reference.json for the engine-free checks)
// and prints a one-line summary per part. Parts: refs, reference, whitelist, boards,
// errors, internals, latency (comma-separated; default all; run "refs" defaults to
// refs,reference). Also runs under Node 24: `node run.ts <run> ...` (type stripping is on
// by default in Node 24; older 24.x need --experimental-strip-types).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOwnEngine } from "./src/engines.ts";
import type { FormulaEngine } from "./src/port.ts";
import { checkReference, checkRefs } from "./src/checks.ts";
import { checkOwnInternals } from "./src/own-internals.ts";
import { runLatency, runSuite, SUITE_PARTS, type SuitePart } from "./src/suite.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ALL = ["refs", "reference", "whitelist", "boards", "errors", "internals", "latency"] as const;

function args(): { run: string; engines: string[]; only: Set<string>; repeats: number; leaves: number | undefined } {
  const argv = process.argv.slice(2);
  const run = argv[0];
  if (!run || run.startsWith("--")) {
    console.error("usage: bun run.ts <run> [--engine own|ironcalc|both] [--only refs,reference,whitelist,boards,errors,internals,latency] [--repeats N] [--leaves N]");
    process.exit(2);
  }
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const engine = flag("--engine") ?? "both";
  const engines = engine === "both" ? ["own", "ironcalc"] : [engine];
  const onlyText = flag("--only") ?? (run === "refs" ? "refs,reference" : ALL.join(","));
  const only = new Set(onlyText.split(","));
  for (const part of only) if (!(ALL as readonly string[]).includes(part)) throw new Error(`unknown part ${part}`);
  const leaves = flag("--leaves");
  return { run, engines, only, repeats: Number(flag("--repeats") ?? 50), leaves: leaves === undefined ? undefined : Number(leaves) };
}

function environment(): Record<string, unknown> {
  const versions = process.versions as Record<string, string | undefined>;
  return {
    runtime: versions.bun ? `bun ${versions.bun}` : `node ${versions.node}`,
    platform: `${process.platform} ${process.arch}`,
    tz: process.env.TZ ?? null,
    lang: process.env.LANG ?? null,
    lcAll: process.env.LC_ALL ?? null,
    resolvedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    date: new Date().toISOString(),
    command: `${versions.bun ? "bun" : "node"} run.ts ${process.argv.slice(2).join(" ")}`,
  };
}

async function engineFor(id: string): Promise<FormulaEngine | string> {
  if (id === "own") return createOwnEngine();
  if (id !== "ironcalc") return `unknown engine ${id}`;
  let mod: { createIronCalcEngine?: (bytes: Uint8Array) => FormulaEngine };
  try {
    // A variable specifier, so the runner starts even before that file exists.
    const specifier = "./src/ironcalc/engine.ts";
    mod = await import(specifier);
  } catch (e) {
    return `not available: src/ironcalc/engine.ts did not load (${e instanceof Error ? e.message.split("\n")[0] : e})`;
  }
  if (typeof mod.createIronCalcEngine !== "function") return "not available: src/ironcalc/engine.ts has no createIronCalcEngine";
  const bytes = new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm")));
  return mod.createIronCalcEngine(bytes);
}

function write(dir: string, name: string, data: unknown): void {
  writeFileSync(join(dir, name), `${JSON.stringify(data, null, 2)}\n`);
}

async function main(): Promise<void> {
  const { run, engines, only, repeats, leaves } = args();
  const dir = join(here, "runs", run);
  mkdirSync(dir, { recursive: true });
  const env = environment();
  let failed = false;
  if (only.has("refs")) {
    const r = checkRefs();
    write(dir, "refs.json", { env, ...r });
    console.log(`refs: ${r.passed} passed, ${r.failed} failed${r.failed ? ` (first: ${JSON.stringify(r.failures[0])})` : ""}`);
    failed ||= r.failed > 0;
  }
  if (only.has("reference")) {
    const r = checkReference();
    write(dir, "reference.json", { env, ...r });
    console.log(`reference: ${r.passed} passed, ${r.failed} failed${r.failed ? ` (first: ${JSON.stringify(r.failures[0])})` : ""}`);
    failed ||= r.failed > 0;
  }
  const parts = SUITE_PARTS.filter((p) => only.has(p)) as SuitePart[];
  if (parts.length === 0 && !only.has("latency") && !only.has("internals")) return finish(failed);
  for (const id of engines) {
    const engine = await engineFor(id);
    if (typeof engine === "string") {
      console.log(`${id}: ${engine}`);
      write(dir, `${id}.json`, { env, engine: id, skipped: engine });
      continue;
    }
    const out: Record<string, unknown> = { env, engine: id };
    const line: string[] = [id];
    if (parts.length > 0) {
      const t0 = Date.now();
      const r = runSuite(engine, parts);
      out.suite = { parts, ...r, ms: Date.now() - t0 };
      line.push(`suite ${r.passed} passed, ${r.failed} failed, ${r.exactMismatches} exact mismatches, hash ${r.hash.slice(0, 16)}`);
      failed ||= r.failed > 0;
    }
    if (only.has("internals") && id === "own") {
      const r = checkOwnInternals();
      out.internals = r;
      line.push(`internals ${r.passed} passed, ${r.failed} failed`);
      failed ||= r.failed > 0;
    }
    if (only.has("latency")) {
      const r = runLatency(engine, repeats, leaves);
      out.latency = { repeats, leaves: leaves ?? "default", ...r };
      line.push(`latency ${r.nodes} nodes, load ${r.loadMs} ms, full ${r.fullRecalcMs} ms, edit median ${r.editMedianMs} ms, p95 ${r.editP95Ms} ms`);
    }
    engine.dispose();
    write(dir, `${id}.json`, out);
    console.log(line.join("; "));
  }
  finish(failed);
}

function finish(failed: boolean): void {
  process.exitCode = failed ? 1 : 0;
}

await main();
