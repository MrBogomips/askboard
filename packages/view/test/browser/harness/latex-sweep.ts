// The depth probe's sweeps (latex-kanban-timeline, task 4.15): each family of nests in each shape at
// each depth, measured in Bun (scan depth, output tree, whether KaTeX parses it) and timed in an
// engine (`LatexFrame`); flat content in growing sizes; the realistic set. A sweep stops at its first
// failure, its first render over `STOP_MS`, or a nest KaTeX does not parse.

import type { Engine } from "./engines.ts";
import { type Construct, fixtureFor, type Shape } from "./latex-fixtures.ts";
import { FLAT_KINDS, FLAT_SIZES, type FlatKind, flatFixture, REALISTIC } from "./latex-forms.ts";
import type { LatexFrame } from "./latex-frame.ts";
import type { Measure, Measurer } from "./latex-measure.ts";

/** A sweep goes no further than a render this slow, or a failure. */
export const STOP_MS = 2_000;
/** Where a branching nest is added: an engine's time at least doubles from one depth to the next. */
const DOUBLING_FLOOR_MS = 20;

/** One fixture in one engine: what Bun says of it and what the engine did. */
export type Row = {
  readonly engine: Engine;
  readonly family: string;
  readonly shape: string;
  /** The depth asked for (a nest) or the size in code points (flat content). */
  readonly asked: number;
  readonly length: number;
  readonly bun: Measure;
  /** The engine's draw, or why it failed. */
  readonly ms?: number;
  readonly beforeMs?: number;
  readonly domNodes?: number;
  readonly parentMs?: number;
  readonly failure?: string;
};

export type Progress = (row: Row) => void;

const cached = (measure: Measurer): Measurer => {
  const seen = new Map<string, Measure>();
  return (expression) => {
    let found = seen.get(expression);
    if (found === undefined) {
      found = measure(expression);
      seen.set(expression, found);
    }
    return found;
  };
};

/** Bun's measurement of an expression, kept by expression for the whole run. */
export const memoMeasure = cached;

const timed = async (
  frame: LatexFrame,
  base: Omit<Row, "ms" | "beforeMs" | "domNodes" | "parentMs" | "failure">,
  expression: string,
): Promise<Row> => {
  if (!base.bun.parses) return { ...base, failure: `no tree: ${base.bun.error ?? ""}` };
  const result = await frame.render(expression);
  if (!result.ok) return { ...base, failure: `${result.reason}: ${result.message}` };
  return {
    ...base,
    ms: result.ms,
    beforeMs: result.beforeMs,
    domNodes: result.nodes,
    parentMs: result.parentMs,
  };
};

const stops = (row: Row): boolean =>
  row.failure !== undefined || (row.ms !== undefined && row.ms >= STOP_MS);

/** One family in one shape, from depth `from` to `to`. */
export const sweepFamily = async (
  frame: LatexFrame,
  measure: Measurer,
  family: Construct,
  shape: Shape,
  from: number,
  to: number,
  progress: Progress,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let depth = from; depth <= to; depth += 1) {
    const expression = fixtureFor(family, shape, depth);
    const row = await timed(
      frame,
      {
        engine: frame.engine,
        family: family.name,
        shape,
        asked: depth,
        length: [...expression].length,
        bun: measure(expression),
      },
      expression,
    );
    progress(row);
    rows.push(row);
    if (stops(row)) break;
  }
  return rows;
};

const doubles = (rows: readonly Row[]): boolean =>
  rows.some((row, at) => {
    const next = rows[at + 1];
    return (
      row.ms !== undefined &&
      next?.ms !== undefined &&
      row.ms >= DOUBLING_FLOOR_MS &&
      next.ms >= 2 * row.ms
    );
  });

/** Every family alone and side by side, and branching where an engine's time doubles. */
export const sweepFamilies = async (
  frame: LatexFrame,
  measure: Measurer,
  families: readonly Construct[],
  from: number,
  to: number,
  progress: Progress,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (const family of families) {
    const alone = await sweepFamily(frame, measure, family, "alone", from, to, progress);
    rows.push(...alone);
    rows.push(...(await sweepFamily(frame, measure, family, "side by side", from, to, progress)));
    if (doubles(alone))
      rows.push(...(await sweepFamily(frame, measure, family, "branching", from, to, progress)));
  }
  return rows;
};

/** Flat content of each kind in growing steps, until the first render over 500 ms in the engine. */
export const sweepFlat = async (
  frame: LatexFrame,
  measure: Measurer,
  slowMs: number,
  progress: Progress,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (const kind of FLAT_KINDS as readonly FlatKind[]) {
    for (const size of FLAT_SIZES) {
      const expression = flatFixture(kind, size);
      const row = await timed(
        frame,
        {
          engine: frame.engine,
          family: kind,
          shape: "flat",
          asked: size,
          length: [...expression].length,
          bun: measure(expression),
        },
        expression,
      );
      progress(row);
      rows.push(row);
      // A kind KaTeX stops parsing (its expansion limit) ends there.
      if (!row.bun.parses || stops(row) || (row.ms !== undefined && row.ms >= slowMs)) break;
    }
  }
  return rows;
};

/** The realistic set, once each. */
export const sweepRealistic = async (
  frame: LatexFrame,
  measure: Measurer,
  progress: Progress,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (const { name, expression } of REALISTIC) {
    const row = await timed(
      frame,
      {
        engine: frame.engine,
        family: name,
        shape: "realistic",
        asked: 0,
        length: [...expression].length,
        bun: measure(expression),
      },
      expression,
    );
    progress(row);
    rows.push(row);
  }
  return rows;
};
