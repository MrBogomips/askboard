// The depth probe's report (latex-kanban-timeline, task 4.15): the rows of one or more probe files
// read through design decision 7's rules (`latex-bounds-rules.ts`) into the three bounds and the
// tables the task's note records, as Markdown.

import { readFile } from "node:fs/promises";
import {
  BEFORE_LIMIT_MS,
  type Bounds,
  depthBound,
  FAST_MS,
  type FlatSeries,
  isSlow,
  nestingBound,
  nodeBound,
  type Sample,
  slowest,
  violations,
  within,
} from "./latex-bounds-rules.ts";
import type { Row } from "./latex-sweep.ts";

/** What a probe file holds. */
export type ProbeRecord = {
  readonly machine: string;
  readonly versions: Record<string, string>;
  readonly skipped: readonly string[];
  readonly rows: readonly Row[];
};

/** A row as the rules read it; a row KaTeX built no tree for has none. */
export const sampleOf = (row: Row): Sample | undefined =>
  row.bun.parses
    ? {
        engine: row.engine,
        label: `${row.family} | ${row.shape} ${row.asked}`,
        scanDepth: row.bun.scanDepth,
        treeDepth: row.bun.treeDepth as number,
        nodes: row.bun.nodes as number,
        ms: row.ms,
        beforeMs: row.beforeMs,
      }
    : undefined;

const samplesOf = (rows: readonly Row[], shapes: (shape: string) => boolean): Sample[] =>
  rows
    .filter((row) => shapes(row.shape))
    .flatMap((row) => {
      const sample = sampleOf(row);
      return sample === undefined ? [] : [sample];
    });

/** The flat series of each kind in each engine, from the smallest size to the largest. */
export const flatSeriesOf = (rows: readonly Row[]): FlatSeries[] => {
  const keys = [
    ...new Set(rows.filter((r) => r.shape === "flat").map((r) => `${r.engine}\u0000${r.family}`)),
  ];
  return keys.map((key) => {
    const [engine = "", kind = ""] = key.split("\u0000");
    const own = rows
      .filter((r) => r.shape === "flat" && r.engine === engine && r.family === kind)
      .sort((a, b) => a.asked - b.asked);
    const samples = own.flatMap((row) => {
      const sample = sampleOf(row);
      return sample === undefined ? [] : [sample];
    });
    return { engine, kind, samples, capped: own.some((row) => !row.bun.parses) };
  });
};

const ms = (value: number | undefined): string =>
  value === undefined ? "FAIL" : `${Math.round(value)}`;

/** The three bounds the rows give, with what limits each. */
export const boundsOf = (rows: readonly Row[]) => {
  const nodes = nodeBound(flatSeriesOf(rows));
  const sweep = samplesOf(rows, (shape) => shape !== "flat" && shape !== "realistic");
  const depth = depthBound(sweep, nodes.nodes);
  const nesting = nestingBound(sweep, nodes.nodes, depth.depth);
  const bounds: Bounds = { nodes: nodes.nodes, depth: depth.depth, nesting: nesting.depth };
  return { nodes, depth, nesting, bounds, sweep };
};

const engineColumns = (rows: readonly Row[]): string[] => [...new Set(rows.map((r) => r.engine))];

const flatTable = (rows: readonly Row[]): string => {
  const engines = engineColumns(rows);
  const lines = [
    `| kind | chars | tree depth | nodes | ${engines.map((e) => `${e} ms`).join(" | ")} |`,
    `|---|---|---|---|${engines.map(() => "---").join("|")}|`,
  ];
  const flat = rows.filter((r) => r.shape === "flat");
  const keys = [...new Set(flat.map((r) => `${r.family}\u0000${r.asked}`))];
  for (const key of keys) {
    const [kind = "", asked = ""] = key.split("\u0000");
    const same = flat.filter((r) => r.family === kind && String(r.asked) === asked);
    const first = same[0];
    if (first === undefined) continue;
    const cells = engines.map((engine) => {
      const row = same.find((r) => r.engine === engine);
      return row === undefined
        ? "-"
        : row.ms === undefined
          ? (row.failure ?? "?").slice(0, 28)
          : ms(row.ms);
    });
    lines.push(
      `| ${kind} | ${first.length} | ${first.bun.treeDepth ?? "-"} | ${first.bun.nodes ?? "-"} | ${cells.join(" | ")} |`,
    );
  }
  return lines.join("\n");
};

const realisticTable = (rows: readonly Row[], bounds: Bounds): string => {
  const engines = engineColumns(rows);
  const lines = [
    `| expression | scan | tree depth | nodes | ${engines.map((e) => `${e} ms`).join(" | ")} | passes |`,
    `|---|---|---|---|${engines.map(() => "---").join("|")}|---|`,
  ];
  const names = [...new Set(rows.filter((r) => r.shape === "realistic").map((r) => r.family))];
  for (const name of names) {
    const same = rows.filter((r) => r.shape === "realistic" && r.family === name);
    const first = same[0];
    const sample = first === undefined ? undefined : sampleOf(first);
    if (first === undefined || sample === undefined) continue;
    lines.push(
      `| ${name} | ${sample.scanDepth} | ${sample.treeDepth} | ${sample.nodes} | ${engines
        .map((engine) => ms(same.find((r) => r.engine === engine)?.ms))
        .join(" | ")} | ${within(sample, bounds) ? "yes" : "NO"} |`,
    );
  }
  return lines.join("\n");
};

// Per engine, the rows of a family and shape at the deepest scan depth within the bounds and the
// first one past them, for the families whose rows within the bounds are the slowest.
const aroundTable = (samples: readonly Sample[], bounds: Bounds, count: number): string => {
  const engines = [...new Set(samples.map((s) => s.engine))];
  const keyOf = (s: Sample) => s.label.replace(/ \d+$/, "");
  const families = [...new Set(samples.map(keyOf))];
  const worst = families
    .map((family) => ({
      family,
      ms: Math.max(
        0,
        ...samples
          .filter((s) => keyOf(s) === family && within(s, bounds))
          .map((s) => s.ms ?? Number.POSITIVE_INFINITY),
      ),
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, count);
  const lines = [
    `| family | shape | scan | tree depth | nodes | ${engines.map((e) => `${e} ms`).join(" | ")} |`,
    `|---|---|---|---|---|${engines.map(() => "---").join("|")}|`,
  ];
  for (const { family } of worst) {
    const own = samples.filter((s) => keyOf(s) === family);
    const inside = own.filter((s) => within(s, bounds));
    const past = own.filter((s) => !within(s, bounds));
    const deepest = Math.max(...inside.map((s) => s.scanDepth), -1);
    const firstPast = Math.min(...past.map((s) => s.scanDepth), Number.POSITIVE_INFINITY);
    for (const depth of [deepest, firstPast]) {
      const at = own.filter((s) => s.scanDepth === depth);
      const first = at[0];
      if (first === undefined) continue;
      const [name = family, shape = ""] = family.split(" | ");
      lines.push(
        `| ${name} | ${shape}${depth === firstPast && depth !== deepest ? " (past)" : ""} | ${depth} | ${first.treeDepth} | ${first.nodes} | ${engines
          .map((engine) => ms(at.find((s) => s.engine === engine)?.ms))
          .join(" | ")} |`,
      );
    }
  }
  return lines.join("\n");
};

/** The report of the rows of `files`, as Markdown. */
export const reportOf = async (files: readonly string[]): Promise<string> => {
  const records = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(file, "utf8")) as ProbeRecord),
  );
  const rows = records.flatMap((record) => [...record.rows]);
  const { nodes, depth, nesting, bounds, sweep } = boundsOf(rows);
  const bad = violations(sweep, bounds);
  const realistic = rows.filter((r) => r.shape === "realistic");
  const out: string[] = [
    `machine: ${records[0]?.machine ?? "?"}`,
    `engines: ${JSON.stringify(Object.assign({}, ...records.map((r) => r.versions)))}`,
    `fast: under ${FAST_MS} ms; work before the bound at most ${BEFORE_LIMIT_MS} ms`,
    "",
    `LATEX_TREE_MAX_NODES ${nodes.nodes}${nodes.unbounded ? " (no flat fixture slow: the largest tried)" : ""}, limited by ${nodes.limitedBy}`,
    `LATEX_TREE_MAX_DEPTH ${depth.depth}, limited by ${depth.limitedBy}`,
    `LATEX_NESTING_MAX_DEPTH ${nesting.depth}, limited by ${nesting.limitedBy}`,
    "",
    `fixtures within the bounds slow or with slow work before the bound: ${bad.length}`,
    ...bad
      .slice(0, 12)
      .map((s) => `  ${s.engine} ${s.label}: ${ms(s.ms)} ms, before ${ms(s.beforeMs)} ms`),
    "",
    "## flat content",
    flatTable(rows),
    "",
    "## realistic set",
    realisticTable(realistic, bounds),
    "",
    "## slowest within the bounds",
    ...["chromium", "webkit"].map(
      (engine) =>
        `${engine}: ${slowest(
          sweep.filter((s) => s.engine === engine),
          bounds,
          5,
        )
          .map(
            (s) =>
              `${s.label} (scan ${s.scanDepth}, tree ${s.treeDepth}/${s.nodes}) ${ms(s.ms)} ms`,
          )
          .join("; ")}`,
    ),
    "",
    "## work before the bound (scan, tree and its size), within the bounds",
    ...["chromium", "webkit"].map((engine) => {
      const inside = sweep.filter((s) => s.engine === engine && within(s, bounds));
      const worst = inside.reduce<Sample | undefined>(
        (a, s) => ((s.beforeMs ?? 0) > (a?.beforeMs ?? -1) ? s : a),
        undefined,
      );
      return `${engine}: at most ${ms(worst?.beforeMs)} ms (${worst?.label ?? "-"}); over all rows ${ms(Math.max(0, ...sweep.filter((s) => s.engine === engine).map((s) => s.beforeMs ?? 0)))} ms`;
    }),
    "",
    "## around the bounds (the 40 slowest families)",
    aroundTable(sweep, bounds, 40),
    "",
    `failures: ${sweep.filter(isSlow).filter((s) => s.ms === undefined).length} of ${sweep.length} sweep rows`,
    `control words skipped (no argument or no parsing form): ${records[0]?.skipped.length ?? 0}`,
  ];
  return `${out.join("\n")}\n`;
};
