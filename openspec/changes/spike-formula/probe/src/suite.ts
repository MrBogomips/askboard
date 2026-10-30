// The shared suite: every fixture through the FormulaEngine port, for any engine, in Bun,
// Node or the sandboxed view. No Node, Bun or DOM-only API; the clock is guarded.

import { EDIT_ADDRESS, EDIT_PROBE, generateBoard } from "../fixtures/generate.ts";
import { BOARD_FIXTURES, type BoardFixture, errorFixtures, WHITELIST_CASES, whitelistNodes } from "./fixtures.ts";
import { buildGraph } from "./graph.ts";
import { type FormulaEngine, type GraphNode, isFormulaError, type NodeResult } from "./port.ts";
import { referenceValues } from "./reference.ts";
import { canonicalJson, sha256Hex } from "./sha256.ts";

export interface SuiteResult {
  engine: "own" | "ironcalc";
  passed: number;
  failed: number;
  exactMismatches: number;
  failures: Array<{ fixture: string; address: string; expected: unknown; actual: unknown }>;
  hash: string;
  results: Record<string, Record<string, unknown>>;
}

export type SuitePart = "whitelist" | "boards" | "errors";
export const SUITE_PARTS: readonly SuitePart[] = ["whitelist", "boards", "errors"];

export const TOLERANCE = 1e-9;

const now: () => number = (() => {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return perf && typeof perf.now === "function" ? () => perf.now?.() ?? Date.now() : () => Date.now();
})();

/** The result as the hash and the run file record it: errors by kind only. */
export function normalise(r: NodeResult): unknown {
  if (isFormulaError(r)) return { error: r.error };
  return r;
}

type Verdict = "pass" | "exact-mismatch" | "fail";

export function compareValue(expected: unknown, actual: unknown): Verdict {
  if (typeof expected === "number" && typeof actual === "number") {
    if (actual === expected) return "pass";
    return Math.abs(actual - expected) <= TOLERANCE * Math.max(1, Math.abs(expected)) ? "exact-mismatch" : "fail";
  }
  if (expected !== null && typeof expected === "object") {
    const e = (expected as { error?: unknown }).error;
    return actual !== null && typeof actual === "object" && (actual as { error?: unknown }).error === e ? "pass" : "fail";
  }
  return expected === actual ? "pass" : "fail";
}

class Tally {
  passed = 0;
  failed = 0;
  exactMismatches = 0;
  readonly failures: SuiteResult["failures"] = [];
  readonly results: Record<string, Record<string, unknown>> = {};

  check(fixture: string, address: string, expected: unknown, actual: unknown): void {
    (this.results[fixture] ??= {})[address] = actual;
    const verdict = compareValue(expected, actual);
    if (verdict === "fail") {
      this.failed++;
      this.failures.push({ fixture, address, expected, actual });
      return;
    }
    this.passed++;
    if (verdict === "exact-mismatch") this.exactMismatches++;
  }

  /** Load warnings compared as a set of kind@address. */
  checkWarnings(fixture: string, expected: readonly { error: string; address: string }[], actual: readonly { error: string; address: string }[]): void {
    const want = [...new Set(expected.map((w) => `${w.error}@${w.address}`))].sort();
    const got = [...new Set(actual.map((w) => `${w.error}@${w.address}`))].sort();
    this.check(fixture, "@warnings", want.join(" "), got.join(" "));
  }
}

/** Runs `fn` and records a thrown exception as a failure instead of stopping the suite. */
function guarded(t: Tally, fixture: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    t.failed++;
    t.failures.push({ fixture, address: "@exception", expected: "no exception", actual: String(e instanceof Error ? e.message : e).slice(0, 300) });
    (t.results[fixture] ??= {})["@exception"] = "exception";
  }
}

function runWhitelist(engine: FormulaEngine, t: Tally): void {
  for (const c of WHITELIST_CASES) {
    const fixture = `whitelist:${c.id}`;
    guarded(t, fixture, () => {
      const report = engine.load(whitelistNodes(c));
      t.check(fixture, "t.r", c.expected, normalise(engine.read("t.r")));
      t.checkWarnings(fixture, c.warnings ?? [], report.warnings);
    });
  }
}

function checkAll(engine: FormulaEngine, t: Tally, fixture: string, expected: Readonly<Record<string, unknown>>): void {
  for (const address of Object.keys(expected).sort()) t.check(fixture, address, expected[address], normalise(engine.read(address)));
}

function runBoard(engine: FormulaEngine, t: Tally, f: BoardFixture): void {
  const fixture = `board:${f.name}`;
  guarded(t, fixture, () => {
    const report = engine.load(buildGraph(f.board));
    t.checkWarnings(fixture, f.warnings, report.warnings);
    checkAll(engine, t, fixture, f.expected);
    f.edits.forEach((edit, i) => {
      for (const address of Object.keys(edit.set)) engine.set(address, edit.set[address] ?? null);
      engine.recalc();
      checkAll(engine, t, `${fixture}#edit${i + 1}`, edit.expected);
    });
  });
}

function runGenerated(engine: FormulaEngine, t: Tally): void {
  const fixture = "board:generated";
  guarded(t, fixture, () => {
    const board = generateBoard();
    const report = engine.load(buildGraph(board));
    t.checkWarnings(fixture, [], report.warnings);
    checkAll(engine, t, fixture, Object.fromEntries(referenceValues(board)));
  });
}

function runErrors(engine: FormulaEngine, t: Tally): void {
  for (const f of errorFixtures()) {
    const fixture = `error:${f.id}`;
    guarded(t, fixture, () => {
      const nodes: readonly GraphNode[] = f.nodes ?? buildGraph(f.board as Parameters<typeof buildGraph>[0]);
      const report = engine.load(nodes);
      t.checkWarnings(fixture, f.warnings, report.warnings);
      checkAll(engine, t, fixture, f.expected);
    });
  }
}

export function runSuite(engine: FormulaEngine, parts: readonly SuitePart[] = SUITE_PARTS): SuiteResult {
  const t = new Tally();
  if (parts.includes("whitelist")) runWhitelist(engine, t);
  if (parts.includes("boards")) {
    for (const f of BOARD_FIXTURES) runBoard(engine, t, f);
    runGenerated(engine, t);
  }
  if (parts.includes("errors")) runErrors(engine, t);
  return {
    engine: engine.id,
    passed: t.passed,
    failed: t.failed,
    exactMismatches: t.exactMismatches,
    failures: t.failures,
    hash: sha256Hex(canonicalJson(t.results)),
    results: t.results,
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i] as number;
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Criterion 4: load (with its first full evaluation), a full recalculation (every input
 * set to itself), and single-input edits on the generated board (the first work package,
 * so the whole Gantt chain recomputes), each followed by a read of the plan's finish date.
 */
export function runLatency(
  engine: FormulaEngine,
  repeats: number,
  leaves?: number,
): { nodes: number; loadMs: number; fullRecalcMs: number; editMedianMs: number; editP95Ms: number } {
  const nodes = buildGraph(generateBoard(leaves === undefined ? {} : { leaves }));
  let t0 = now();
  engine.load(nodes);
  engine.read(EDIT_PROBE);
  const loadMs = now() - t0;
  t0 = now();
  for (const n of nodes) if (n.formula === undefined) engine.set(n.address, n.value ?? null);
  engine.recalc();
  engine.read(EDIT_PROBE);
  const fullRecalcMs = now() - t0;
  const base = nodes.find((n) => n.address === EDIT_ADDRESS)?.value;
  const start = typeof base === "number" ? base : 10;
  const times: number[] = [];
  for (let i = 0; i < repeats; i++) {
    t0 = now();
    engine.set(EDIT_ADDRESS, start + 1 + (i % 7));
    engine.recalc();
    engine.read(EDIT_PROBE);
    times.push(now() - t0);
  }
  engine.set(EDIT_ADDRESS, start);
  engine.recalc();
  times.sort((a, b) => a - b);
  return {
    nodes: nodes.length,
    loadMs: round3(loadMs),
    fullRecalcMs: round3(fullRecalcMs),
    editMedianMs: round3(percentile(times, 0.5)),
    editP95Ms: round3(percentile(times, 0.95)),
  };
}
