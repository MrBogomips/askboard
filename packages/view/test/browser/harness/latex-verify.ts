// The probe's check at the bounds (latex-kanban-timeline, task 4.15): every family in every shape at
// its deepest nest within the bounds, and every row within them that took 250 ms or more, timed again
// several runs each in a quiet engine, the combined form of design decision 7 at the bounds, and flat
// content at the node bound; then U-1, ten copies of the slowest fixture drawn in one task and one
// per task.

import { readFile } from "node:fs/promises";
import { LATEX_EXPRESSION_MAX_CHARS } from "@askboard/contract";
import { ENGINES, type Engine } from "./engines.ts";
import { combinedFamilies, FAST_MS, within } from "./latex-bounds-rules.ts";
import {
  type Construct,
  fixtureFor,
  katexControlWords,
  LATEX_CONSTRUCTS,
  type Shape,
} from "./latex-fixtures.ts";
import {
  type Combined,
  combinedForm,
  controlWordConstructs,
  EXTRA_CONSTRUCTS,
  FLAT_KINDS,
  type FlatKind,
  flatFixture,
  optionalArgumentWords,
} from "./latex-forms.ts";
import { LatexFrame } from "./latex-frame.ts";
import { LATEX_SOURCES, loadMeasurer, type Measurer } from "./latex-measure.ts";
import { type ProbeRecord, sampleOf } from "./latex-probe-report.ts";
import type { Progress, Row } from "./latex-sweep.ts";

/** A row whose first time reached this is timed again, whatever its depth. */
const NEAR_MS = 250;

type Timed = {
  readonly engine: Engine;
  readonly label: string;
  readonly expression: string;
  readonly runs: (number | undefined)[];
};

const maxOf = (runs: readonly (number | undefined)[]): number =>
  runs.some((run) => run === undefined)
    ? Number.POSITIVE_INFINITY
    : Math.max(...(runs as number[]));

const medianOf = (runs: readonly (number | undefined)[]): number => {
  const sorted = runs.map((run) => run ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

export type VerifyOptions = {
  readonly nodes: number;
  readonly fractions: number;
  readonly depth: number;
  readonly nesting: number;
  readonly runs: number;
};

/** The combined form of the record's rows within the bounds, with the names of its two families. */
const combinedOf = (
  record: ProbeRecord,
  bounds: { nodes: number; fractions: number; depth: number; nesting: number },
  families: ReadonlyMap<string, Construct>,
  measure: Measurer,
): { found: Combined; fraction: string; plain: string } | undefined => {
  const samples = record.rows.flatMap((row) => {
    const sample = sampleOf(row);
    return sample === undefined || row.shape === "realistic" || row.shape === "flat"
      ? []
      : [sample];
  });
  const { fraction, plain } = combinedFamilies(samples, bounds);
  const fractionFamily = fraction === undefined ? undefined : families.get(fraction);
  const plainFamily = plain === undefined ? undefined : families.get(plain);
  if (fraction === undefined || plain === undefined) return undefined;
  if (fractionFamily === undefined || plainFamily === undefined) return undefined;
  const found = combinedForm(fractionFamily, plainFamily, bounds, measure);
  return found === undefined ? undefined : { found, fraction, plain };
};

export const verify = async (
  file: string,
  given: VerifyOptions,
  _progress: Progress,
): Promise<{ readonly text: string; readonly record: unknown }> => {
  const record = JSON.parse(await readFile(file, "utf8")) as ProbeRecord;
  const bounds = {
    nodes: given.nodes,
    fractions: given.fractions,
    depth: given.depth,
    nesting: given.nesting,
  };
  const measure = await loadMeasurer();
  const { forms } = controlWordConstructs(
    katexControlWords(LATEX_SOURCES.katex),
    measure,
    optionalArgumentWords(LATEX_SOURCES.katex),
  );
  const families = new Map(
    [...LATEX_CONSTRUCTS, ...EXTRA_CONSTRUCTS, ...forms].map((f) => [f.name, f]),
  );
  const expressionOf = (row: Row): string => {
    if (row.shape === "flat") return flatFixture(row.family as FlatKind, row.asked);
    const family = families.get(row.family);
    if (family === undefined) throw new Error(`no family ${row.family}`);
    return fixtureFor(family, row.shape as Shape, row.asked);
  };
  // What the contract admits: at most 2,000 code points, so flat content past that is no fixture here.
  const insideBounds = (limits: typeof bounds) =>
    record.rows.filter((row) => {
      const sample = sampleOf(row);
      return (
        sample !== undefined &&
        row.shape !== "realistic" &&
        row.length <= LATEX_EXPRESSION_MAX_CHARS &&
        within(sample, limits)
      );
    });
  const inside = insideBounds(bounds);
  // Rows within the three bounds of the output alone, whatever the scan says: the board never refuses
  // them for their tree, so the ones that came near the limit are timed again too.
  const insideTree = insideBounds({ ...bounds, nesting: Number.POSITIVE_INFINITY });
  const timed: Timed[] = [];
  const engines = Object.keys(record.versions) as Engine[];
  const combined = combinedOf(record, bounds, families, measure);
  for (const engine of engines.filter((e) => (ENGINES as readonly string[]).includes(e))) {
    const own = inside.filter((row) => row.engine === engine);
    const deepest = new Map<string, Row>();
    for (const row of own) {
      const key = `${row.family}\u0000${row.shape}`;
      const held = deepest.get(key);
      if (held === undefined || row.asked > held.asked) deepest.set(key, row);
    }
    const chosen = new Set<Row>(deepest.values());
    for (const row of insideTree) {
      if (row.engine === engine && (row.ms ?? 0) >= NEAR_MS) chosen.add(row);
    }
    const frame = new LatexFrame(engine);
    try {
      for (const row of chosen) {
        const expression = expressionOf(row);
        const runs: (number | undefined)[] = [];
        for (let run = 0; run < given.runs; run += 1) {
          const result = await frame.render(expression);
          runs.push(result.ok ? result.ms : undefined);
        }
        timed.push({
          engine,
          label: `${row.family} | ${row.shape} ${row.asked}`,
          expression,
          runs,
        });
      }
      if (combined !== undefined) {
        const runs: (number | undefined)[] = [];
        for (let run = 0; run < given.runs; run += 1) {
          const result = await frame.render(combined.found.expression);
          runs.push(result.ok ? result.ms : undefined);
        }
        timed.push({
          engine,
          label: `combined: ${combined.fraction} x${combined.found.fractionLevels} in ${combined.plain} x${combined.found.plainLevels}`,
          expression: combined.found.expression,
          runs,
        });
      }
    } finally {
      await frame.close();
    }
  }
  // Flat content of each kind at about the node bound: the sizes rule 1 chose it by.
  const atBound = FLAT_KINDS.map((kind) => {
    const perChar =
      (measure(flatFixture(kind, 2_000)).nodes ?? 1) / [...flatFixture(kind, 2_000)].length;
    const expression = flatFixture(kind, Math.floor(given.nodes / perChar));
    return { kind, expression, nodes: measure(expression).nodes, length: [...expression].length };
  });
  const flatTimes: Record<string, unknown>[] = [];
  for (const engine of engines) {
    const frame = new LatexFrame(engine);
    try {
      for (const { kind, expression, nodes, length } of atBound) {
        const runs: (number | undefined)[] = [];
        for (let run = 0; run < given.runs; run += 1) {
          const result = await frame.render(expression);
          runs.push(result.ok ? result.ms : undefined);
        }
        flatTimes.push({ engine, kind, nodes, length, runs });
      }
    } finally {
      await frame.close();
    }
  }
  const lines = [
    `bounds: nodes ${given.nodes}, fractions ${given.fractions}, depth ${given.depth}, nesting ${given.nesting}; runs ${given.runs}`,
    combined === undefined
      ? "combined form: none (no fraction family or no plain family within the bounds)"
      : `combined form: ${combined.fraction} x${combined.found.fractionLevels} in ${combined.plain} x${combined.found.plainLevels}: ${combined.found.fractions} fractions, tree depth ${combined.found.treeDepth}, ${combined.found.nodes} nodes, ${[...combined.found.expression].length} chars`,
  ];
  for (const t of flatTimes) {
    lines.push(
      `flat at the node bound, ${String(t.engine)}: ${String(t.kind)} ${String(t.length)} chars, ${String(t.nodes)} nodes: ${(t.runs as (number | undefined)[]).map((r) => (r === undefined ? "FAIL" : Math.round(r))).join("/")} ms`,
    );
  }
  const many: Record<string, unknown> = {};
  for (const engine of engines) {
    for (const t of timed.filter((t) => t.engine === engine && t.label.startsWith("combined:"))) {
      lines.push(
        "",
        `${engine}: ${t.label}: ${t.runs.map((r) => (r === undefined ? "FAIL" : Math.round(r))).join("/")} ms`,
      );
    }
    const own = timed
      .filter((t) => t.engine === engine)
      .sort((a, b) => maxOf(b.runs) - maxOf(a.runs));
    const slow = own.filter((t) => maxOf(t.runs) >= FAST_MS);
    lines.push(
      "",
      `${engine}: ${own.length} fixtures timed, ${slow.length} at ${FAST_MS} ms or more in some run`,
      ...slow
        .slice(0, 10)
        .map(
          (t) =>
            `  SLOW ${t.label}: ${t.runs.map((r) => (r === undefined ? "FAIL" : Math.round(r))).join(", ")}`,
        ),
      `  slowest five: ${own
        .slice(0, 5)
        .map(
          (t) =>
            `${t.label} ${t.runs.map((r) => (r === undefined ? "FAIL" : Math.round(r))).join("/")}`,
        )
        .join("; ")}`,
    );
    // U-1 takes the fixture whose runs are slowest by their median: one noisy run picks no fixture.
    const worst = [...own].sort((a, b) => medianOf(b.runs) - medianOf(a.runs))[0];
    if (worst === undefined) continue;
    const frame = new LatexFrame(engine);
    try {
      const rows: Record<string, unknown>[] = [];
      for (const perTask of [false, true]) {
        for (let run = 0; run < given.runs; run += 1) {
          rows.push({ perTask, ...(await frame.many(worst.expression, 10, perTask)) });
        }
      }
      many[engine] = { fixture: worst.label, rows };
      for (const row of rows) {
        lines.push(
          `  U-1 ${worst.label} x10 ${row.perTask ? "one per task" : "in one task"}: total ${Math.round(Number(row.totalMs))} ms, longest task ${Math.round(Number(row.longestMs))} ms${row.ok === false ? ` FAIL ${String(row.reason)}` : ""}`,
        );
      }
    } finally {
      await frame.close();
    }
  }
  return {
    text: `${lines.join("\n")}\n`,
    record: {
      bounds,
      runs: given.runs,
      flatTimes,
      timed: timed.map(({ expression: _e, ...rest }) => rest),
      many,
    },
  };
};
