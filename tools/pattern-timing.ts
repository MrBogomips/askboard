// Times the worst patterns the safe subset still admits (form-widget, design decision 3; the PO's
// rule of 2026-11-07): the subset leaves no exponential case and spends at most
// `PATTERN_MAX_REPEATS` repetitions, but adjacent quantifiers over overlapping classes still
// backtrack polynomially, and a TextField with a pattern holds at most 1,000 characters. Each pattern is run unanchored, as the board runs it (`RegExp.test`, the `u` flag),
// against a run of its class of 100, 300 and 1,000 characters followed by one ending that makes it
// fail late: `x`, `!` and U+2028. A size runs only while the one before took under `GATE_MS`.
//
//   bun tools/pattern-timing.ts [--sizes 100,300,1000]
//   node tools/pattern-timing.ts [--sizes 100,300,1000]
//
// No import and only erasable TypeScript, so that Bun and Node 24 (type stripping) both run it. Any
// case over `KNOWN_LIMIT_MS` is a known limit for CHANGELOG, with no mechanism added.

export type TimingFixture = {
  /** The pattern source, as an agent would send it. */
  readonly pattern: string;
  /** One character of the class the pattern's quantifiers share: the text is a run of it. */
  readonly run: string;
};

export type Ending = { readonly name: string; readonly text: string };

export type TimingRow = {
  readonly pattern: string;
  readonly ending: string;
  readonly size: number;
  readonly ms: number;
};

/** Patterns inside the safe subset with adjacent quantifiers over overlapping classes. */
export const FIXTURES: readonly TimingFixture[] = [
  { pattern: "^\\d*\\d*\\d*$", run: "1" },
  { pattern: "\\d+\\d+x", run: "1" },
  { pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", run: "a" },
  { pattern: "^(?:[a-z0-9-]+\\.)?[a-z0-9-]+$", run: "a" },
  // The budget's worst shapes (PATTERN_MAX_REPEATS = 3: each range quantifier, each group holding
  // a |, and one more with no leading ^): an alternation group beside two quantifiers anchored,
  // beside one unanchored, three alternation groups, and two quantifiers before `$` unanchored.
  { pattern: "^(?:\\d|1)\\d*\\d*$", run: "1" },
  { pattern: "(?:\\d|1)\\d*x", run: "1" },
  { pattern: "^(?:\\d|1)(?:\\d|1)(?:\\d|1)$", run: "1" },
  { pattern: "\\d*\\d*$", run: "1" },
];

export const ENDINGS: readonly Ending[] = [
  { name: "x", text: "x" },
  { name: "!", text: "!" },
  { name: "U+2028", text: " " },
];

/** The lengths of the run, in characters. */
export const SIZES: readonly number[] = [100, 300, 1_000];
/** A size runs only while the one before took less than this many milliseconds. */
export const GATE_MS = 2_000;
/** A case that takes longer than this is a known limit. */
export const KNOWN_LIMIT_MS = 500;

/** How long `new RegExp(pattern, "u").test(text)` takes, in milliseconds, compiling apart. */
export const timeMatch = (pattern: string, text: string): number => {
  const regex = new RegExp(pattern, "u");
  const started = performance.now();
  regex.test(text);
  return performance.now() - started;
};

/** Every pattern against every ending at each size, a size only while the one before took under `gateMs`. */
export const runTimings = (
  fixtures: readonly TimingFixture[] = FIXTURES,
  sizes: readonly number[] = SIZES,
  gateMs: number = GATE_MS,
): TimingRow[] => {
  const rows: TimingRow[] = [];
  for (const { pattern, run } of fixtures) {
    for (const ending of ENDINGS) {
      let before = -1;
      for (const size of sizes) {
        if (before >= gateMs) break;
        const ms = timeMatch(pattern, run.repeat(size) + ending.text);
        rows.push({ pattern, ending: ending.name, size, ms });
        before = ms;
      }
    }
  }
  return rows;
};

const pad = (text: string, width: number): string => text.padEnd(width);

/** The rows as a table, one line each under a header, a row over `KNOWN_LIMIT_MS` marked "over". */
export const formatTable = (rows: readonly TimingRow[]): string => {
  const width = Math.max("pattern".length, ...rows.map(({ pattern }) => pattern.length));
  const lines = rows.map(
    ({ pattern, ending, size, ms }) =>
      `${pad(pattern, width)}  ${pad(ending, 6)}  ${String(size).padStart(5)}  ${ms.toFixed(1).padStart(9)} ms${ms > KNOWN_LIMIT_MS ? "  over" : ""}`,
  );
  return [
    `${pad("pattern", width)}  ending   size         time`,
    "-".repeat(width + 32),
    ...lines,
  ].join("\n");
};

/** The sizes `--sizes a,b,c` names in `args`, else `SIZES`. */
export const sizesFrom = (args: readonly string[]): readonly number[] => {
  const at = args.indexOf("--sizes");
  const value = at === -1 ? undefined : args[at + 1];
  if (value === undefined) return SIZES;
  return value.split(",").map((each) => Number(each));
};

/** The runtime this script runs on, with its version. */
export const runtimeName = (): string => {
  const bun = (globalThis as { Bun?: { version: string } }).Bun;
  return bun === undefined ? `Node ${process.version}` : `Bun ${bun.version}`;
};

/** The lines the script prints for `args`: the runtime, the table and what is over the limit. */
export const report = (args: readonly string[]): string[] => {
  const rows = runTimings(FIXTURES, sizesFrom(args));
  const over = rows.filter(({ ms }) => ms > KNOWN_LIMIT_MS);
  return [
    `pattern-timing on ${runtimeName()}`,
    formatTable(rows),
    over.length === 0
      ? `no case over ${KNOWN_LIMIT_MS} ms`
      : `${over.length} case(s) over ${KNOWN_LIMIT_MS} ms: known limits`,
  ];
};

if (import.meta.main) {
  for (const line of report(process.argv.slice(2))) console.log(line);
}
