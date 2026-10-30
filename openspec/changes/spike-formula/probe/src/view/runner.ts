// What a view chunk does once its engine can start: the run's mode comes from the document's
// data block. Each mode posts one "result" event, then "done".

import { EDIT_ADDRESS, EDIT_PROBE, generateBoard } from "../../fixtures/generate.ts";
import { BOARD_FIXTURES } from "../fixtures.ts";
import { buildGraph } from "../graph.ts";
import type { FormulaEngine } from "../port.ts";
import { compareValue, normalise, runLatency, runSuite } from "../suite.ts";
import { params, view } from "./api.ts";

export interface ViewEngine {
  readonly id: string;
  /** Makes the engine able to start (IronCalc: decode the bytes, `initSync`). */
  prepare(): void;
  create(): FormulaEngine;
  /** Modes this chunk cannot run (the direct IronCalc chunk runs only the smoke test). */
  readonly unsupported?: readonly string[];
}

const message = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 500);

function smoke(engine: FormulaEngine): Record<string, unknown> {
  engine.load([{ address: "t.r", type: "number", formula: "1+2" }]);
  const value = engine.read("t.r");
  return { value, pass: value === 3 };
}

function suite(engine: FormulaEngine): Record<string, unknown> {
  const t0 = view().now();
  const r = runSuite(engine);
  return {
    passed: r.passed,
    failed: r.failed,
    exactMismatches: r.exactMismatches,
    hash: r.hash,
    failures: r.failures.slice(0, 30),
    ms: view().now() - t0,
  };
}

/** One golden-like board: the UJ-2 WBS and Gantt plan, loaded and read once. */
function firstBoard(engine: FormulaEngine): Record<string, unknown> {
  const uj2 = BOARD_FIXTURES.find((f) => f.name.startsWith("uj2")) ?? BOARD_FIXTURES[0];
  if (!uj2) throw new Error("no UJ-2 fixture");
  const nodes = buildGraph(uj2.board);
  engine.load(nodes);
  let failed = 0;
  for (const [address, expected] of Object.entries(uj2.expected)) {
    if (compareValue(expected, normalise(engine.read(address))) === "fail") failed++;
  }
  return { board: uj2.name, nodes: nodes.length, read: Object.keys(uj2.expected).length, failed };
}

const BATCH = 500;

/**
 * The mean of many single-input edits timed together: Firefox and WebKit give the view a clock
 * coarsened to 1 ms, below which runLatency's per-edit times read 0 or 1.
 */
function batchEdits(engine: FormulaEngine, count: number): Record<string, unknown> {
  const nodes = buildGraph(generateBoard());
  engine.load(nodes);
  const base = nodes.find((n) => n.address === EDIT_ADDRESS)?.value;
  const start = typeof base === "number" ? base : 10;
  const t0 = view().now();
  for (let i = 0; i < count; i++) {
    engine.set(EDIT_ADDRESS, start + 1 + (i % 7));
    engine.recalc();
    engine.read(EDIT_PROBE);
  }
  return { batchEdits: count, batchMeanMs: Math.round(((view().now() - t0) / count) * 1000) / 1000 };
}

export function runView(entry: ViewEngine): void {
  const v = view();
  const p = params();
  try {
    if (entry.unsupported?.includes(p.mode)) {
      v.post("result", { mode: p.mode, engine: entry.id, unsupported: true });
      return;
    }
    entry.prepare();
    const engine = entry.create();
    v.post("engine-ready", { engine: entry.id });
    let data: Record<string, unknown>;
    if (p.mode === "smoke") data = smoke(engine);
    else if (p.mode === "suite") data = suite(engine);
    else if (p.mode === "latency") data = { ...runLatency(engine, p.repeats ?? 50), ...batchEdits(engine, BATCH) };
    else if (p.mode === "timing") {
      data = firstBoard(engine);
      v.post("evaluated", { engine: entry.id });
    } else data = { unsupported: true };
    engine.dispose();
    v.post("result", { mode: p.mode, engine: entry.id, ...data });
  } catch (e) {
    v.post("failed", { mode: p.mode, engine: entry.id, message: message(e) });
  } finally {
    v.done();
  }
}
