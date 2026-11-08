// Times the worst Table the bounds admit (table-widget, design decision 13; the PO's rule of
// 2026-11-07): 200 rows of 10 columns, one input number column and nine formula columns of at most
// 500 characters, each reading the one before (about 100 references), every column totalled. Three
// steps, each against its gate: the build and first evaluation as the board does them (the board's
// items through `boardGraphSource`, `buildGraph`, `evaluateGraph`, the totals read), one input cell
// set and the graph recalculated, and the rebuild once a row is added.
//
//   bun tools/table-timing.ts [--rows 200] [--only build|set|rebuild]
//   bun tools/table-timing.ts --node [...]     the same on Node, bundled first
//
// A timing is taken cold: run a step in a fresh process (`--only` times that step alone, the ones
// it needs before it untimed). Node cannot run `contract`'s sources (its type stripping refuses
// parameter properties), so `--node` bundles this script with `bun build --target=node` into a
// scratch folder and runs the bundle on the `node` in the path. The exit status is 1 when a step is
// over its gate: a gate missed lowers a bound through `/opsx:update`, never a new mechanism.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boardGraphSource,
  buildGraph,
  evaluateGraph,
  type GraphValues,
} from "../packages/compute/src/index.ts";
import { tableWorstForm } from "../packages/contract/src/fixtures/table.ts";
import {
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
} from "../packages/contract/src/widgets/table/constants.ts";

/** Design decision 13's gates, in milliseconds, on Bun and on Node 24. */
export const GATES_MS = { build: 150, set: 10, rebuild: 150 } as const;

export type StepName = keyof typeof GATES_MS;

export type TimingStep = {
  readonly step: StepName;
  readonly label: string;
  readonly ms: number;
  readonly gateMs: number;
  readonly within: boolean;
  readonly detail: string;
};

const LABELS: Readonly<Record<StepName, string>> = {
  build: "build and first evaluation",
  set: "one cell set and recalculated",
  rebuild: "rebuild with a row added",
};

const ID = "worst";
const FORMULA_COLUMNS = TABLE_MAX_COLUMNS - 1;

type Form = ReturnType<typeof tableWorstForm>;

/** The totals the board reads: one per column, `worst.a` and `worst.f1` to `worst.f9`. */
const TOTALS: readonly string[] = [
  `${ID}.a`,
  ...Array.from({ length: FORMULA_COLUMNS }, (_, index) => `${ID}.f${index + 1}`),
];

/** The graph of a form as the board builds it, with the totals read once (the first evaluation). */
const evaluated = (form: Form): GraphValues => {
  const items = [{ type: "table", id: ID, props: form }];
  const values = evaluateGraph(buildGraph(boardGraphSource(items)));
  for (const address of TOTALS) values.read(address);
  return values;
};

const describeForm = (form: Form): string =>
  `${form.rows.length} rows, ${form.rows.length * form.columns.length} cells, ${FORMULA_COLUMNS} formula columns`;

const clock = <T>(run: () => T): { ms: number; result: T } => {
  const started = performance.now();
  const result = run();
  return { ms: performance.now() - started, result };
};

const stepOf = (step: StepName, ms: number, detail: string): TimingStep => ({
  step,
  label: LABELS[step],
  ms,
  gateMs: GATES_MS[step],
  within: ms <= GATES_MS[step],
  detail,
});

/**
 * The steps on a form of `rows` rows (a row more for the rebuild): build, set, rebuild. With `only`,
 * the other steps this one needs run untimed, and that step alone is returned.
 */
export const runSteps = (rows: number = TABLE_MAX_ROWS, only?: StepName): TimingStep[] => {
  const steps: TimingStep[] = [];
  const form = tableWorstForm(rows);
  const wants = (step: StepName): boolean => only === undefined || only === step;
  let values: GraphValues | undefined;
  if (only !== "rebuild") {
    const built = clock(() => evaluated(form));
    values = built.result;
    if (wants("build")) steps.push(stepOf("build", built.ms, describeForm(form)));
  }
  if (only !== "build" && only !== "rebuild" && values !== undefined) {
    const cell = `${ID}.r1.a`;
    const target = values;
    const set = clock(() => {
      target.set(cell, 8);
      const recalculated = target.recalc();
      for (const address of TOTALS) target.read(address);
      return recalculated.length;
    });
    steps.push(stepOf("set", set.ms, `${cell} set, ${set.result} nodes recalculated`));
  }
  if (wants("rebuild")) {
    const more = tableWorstForm(rows + 1);
    const rebuilt = clock(() => evaluated(more));
    steps.push(stepOf("rebuild", rebuilt.ms, describeForm(more)));
  }
  return steps;
};

/** The rows and the single step `args` ask for: `--rows N` and `--only build|set|rebuild`. */
export const stepsFrom = (args: readonly string[]): { rows: number; only?: StepName } => {
  const value = (flag: string): string | undefined => {
    const at = args.indexOf(flag);
    return at === -1 ? undefined : args[at + 1];
  };
  const rowsText = value("--rows");
  const rows = rowsText === undefined ? TABLE_MAX_ROWS : Number(rowsText);
  if (!Number.isInteger(rows) || rows < 1)
    throw new Error(`rows must be a whole number from 1: ${rowsText}`);
  const only = value("--only");
  if (only === undefined) return { rows };
  if (!Object.hasOwn(GATES_MS, only)) throw new Error(`no step ${only}: build, set or rebuild`);
  return { rows, only: only as StepName };
};

/** The runtime this script runs on, with its version. */
export const runtimeName = (): string => {
  const bun = (globalThis as { Bun?: { version: string } }).Bun;
  return bun === undefined ? `Node ${process.version}` : `Bun ${bun.version}`;
};

/** The lines the script prints: the runtime and the form, one line a step, the verdict. */
export const formatReport = (
  runtime: string,
  rows: number,
  steps: readonly TimingStep[],
): string[] => {
  const width = Math.max(...steps.map(({ label }) => label.length));
  const lines = steps.map(
    ({ label, ms, gateMs, within, detail }) =>
      `${label.padEnd(width)}  ${ms.toFixed(1).padStart(7)} ms  (gate ${gateMs} ms)  ${within ? "ok  " : "OVER"}  ${detail}`,
  );
  const over = steps.filter(({ within }) => !within).length;
  return [
    `table-timing on ${runtime}: ${rows} rows, ${TABLE_MAX_COLUMNS} columns`,
    ...lines,
    over === 0
      ? "every step within its gate"
      : `${over} step${over === 1 ? "" : "s"} over its gate`,
  ];
};

/** The report for `args`. */
export const report = (args: readonly string[]): string[] => {
  const { rows, only } = stepsFrom(args);
  return formatReport(runtimeName(), rows, runSteps(rows, only));
};

/** Bundles this script for Node into a scratch folder, runs it there and returns its exit status. */
const runOnNode = (args: readonly string[]): number => {
  const folder = mkdtempSync(join(tmpdir(), "askboard-table-timing-"));
  try {
    const bundle = join(folder, "table-timing.mjs");
    const built = spawnSync(
      process.execPath,
      ["build", fileURLToPath(import.meta.url), "--target=node", "--outfile", bundle],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    if (built.status !== 0) return built.status ?? 1;
    return spawnSync("node", [bundle, ...args], { stdio: "inherit" }).status ?? 1;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--node")) {
    process.exitCode = runOnNode(args.filter((arg) => arg !== "--node"));
  } else {
    const lines = report(args);
    for (const line of lines) console.log(line);
    if (!lines.at(-1)?.startsWith("every")) process.exitCode = 1;
  }
}
