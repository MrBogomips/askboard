// Times the worst patterns the safe subset still admits (form-widget, design decision 3; the PO's
// rule of 2026-11-07): the subset leaves no exponential case and spends at most
// `PATTERN_MAX_REPEATS` repetitions, but adjacent quantifiers over overlapping classes still
// backtrack polynomially, and a fixed-width tail after them multiplies each attempt, so a TextField
// with a pattern holds at most `TEXT_CAP` (100) characters. Each pattern is run as the board runs it
// (`RegExp.test`, the `u` flag) against a run of its class followed by one ending that makes it fail
// late: `x`, `!` and U+2028. `FIXTURES` run at 100, 300 and 1,000 characters (a size only while the
// one before took under `GATE_MS`: what the budget alone would admit); `WORST_SHAPES` run at the cap
// only: `.` and `\d` heads and a class uniting property escapes over astral text (the slowest), anchored
// and not, with no tail, a `{k}` tail and a literal tail up to the 200-code-point pattern limit.
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
  /** What the table shows in place of a long pattern. */
  readonly label?: string;
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

/** The most characters a field with a pattern holds (`PATTERN_TEXT_MAX_CHARS` in `contract`). */
export const TEXT_CAP = 100;
/** The longest pattern, in code points (`PATTERN_MAX_CHARS` in `contract`). */
const PATTERN_LIMIT = 200;

type Head = {
  readonly head: string;
  readonly atom: string;
  readonly run: string;
  /** Whether a literal tail of atoms is timed too: not for an atom too long for the pattern limit. */
  readonly literal?: boolean;
};

/**
 * A class uniting several property escapes, over an astral run (U+20000, a CJK letter): each step
 * is slower on V8 than `.` on ASCII (review X-2 of task 1.14: 325 ms at 100 code points).
 */
const PROPERTY_CLASS = "[\\p{L}\\p{N}\\p{S}\\p{P}\\p{M}\\p{Cf}\\p{Co}]";
const ASTRAL_RUN = String.fromCodePoint(0x20000);

// The budget's most expensive heads (3 repetitions: `^` plus three quantifiers, or two with no `^`),
// on `.` (about five times slower than a class under the `u` flag, and failing at U+2028) and on `\d`.
const HEADS: readonly Head[] = [
  { head: "^.*.*.*", atom: ".", run: "a" },
  { head: ".*.*", atom: ".", run: "a" },
  { head: "^\\d*\\d*\\d*", atom: "\\d", run: "1" },
  { head: "\\d*\\d*", atom: "\\d", run: "1" },
  {
    head: `^${PROPERTY_CLASS}*${PROPERTY_CLASS}*${PROPERTY_CLASS}*`,
    atom: PROPERTY_CLASS,
    run: ASTRAL_RUN,
    literal: false,
  },
  {
    head: `${PROPERTY_CLASS}*${PROPERTY_CLASS}*`,
    atom: PROPERTY_CLASS,
    run: ASTRAL_RUN,
    literal: false,
  },
];
/** The `{k}` tails timed: short, middle and long ones, the longest that a run of `TEXT_CAP - 1` can fill. */
const TAIL_COUNTS: readonly number[] = [24, 50, 75, TEXT_CAP - 1];

const worstShapes = (): TimingFixture[] =>
  HEADS.flatMap(({ head, atom, run, literal = true }) => {
    const width = Array.from(atom).length;
    const longest = Math.floor((PATTERN_LIMIT - Array.from(head).length - 1) / width);
    return [
      { pattern: `${head}$`, run, label: `${head}$` },
      ...TAIL_COUNTS.map((k) => ({
        pattern: `${head}${atom}{${k}}$`,
        run,
        label: `${head}${atom}{${k}}$`,
      })),
      // A literal tail of atoms, one that a run of `TEXT_CAP - 1` can fill and the longest the
      // pattern limit holds (which no text of the cap can match: an engine may refuse it at once).
      ...(literal ? [TEXT_CAP - 25, longest] : []).map((count) => ({
        pattern: `${head}${atom.repeat(count)}$`,
        run,
        label: `${head} + ${count} x ${atom} + $`,
      })),
    ];
  });

/** The worst admitted shapes, run at `TEXT_CAP` characters. */
export const WORST_SHAPES: readonly TimingFixture[] = worstShapes();

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

let coldCount = 0;

/**
 * How long `new RegExp(pattern, "u").test(text)` takes, in milliseconds, compiling apart. Each call
 * gives the engine a source it has not seen (empty groups appended, which match nothing and cost
 * nothing), because V8 runs a new regular expression in its interpreter and tiers up after the first
 * run, a cache shared by equal sources: a cold run is the board's first keystroke, the worst one.
 */
export const timeMatch = (pattern: string, text: string): number => {
  coldCount += 1;
  const regex = new RegExp(pattern + "(?:)".repeat(coldCount), "u");
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
  for (const { pattern, run, label } of fixtures) {
    for (const ending of ENDINGS) {
      let before = -1;
      for (const size of sizes) {
        if (before >= gateMs) break;
        const ms = timeMatch(pattern, run.repeat(size) + ending.text);
        rows.push({ pattern: label ?? pattern, ending: ending.name, size, ms });
        before = ms;
      }
    }
  }
  return rows;
};

/** `WORST_SHAPES` with each ending, at one character under the cap plus the ending: `TEXT_CAP` in all. */
export const runWorstShapes = (): TimingRow[] => runTimings(WORST_SHAPES, [TEXT_CAP - 1]);

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
  const verdict = (rows: readonly TimingRow[]): string => {
    const over = rows.filter(({ ms }) => ms > KNOWN_LIMIT_MS);
    return over.length === 0
      ? `no case over ${KNOWN_LIMIT_MS} ms`
      : `${over.length} case(s) over ${KNOWN_LIMIT_MS} ms: known limits`;
  };
  const rows = runTimings(FIXTURES, sizesFrom(args));
  const worst = runWorstShapes();
  return [
    `pattern-timing on ${runtimeName()}`,
    formatTable(rows),
    verdict(rows),
    `worst shapes at ${TEXT_CAP} characters`,
    formatTable(worst),
    verdict(worst),
  ];
};

if (import.meta.main) {
  for (const line of report(process.argv.slice(2))) console.log(line);
}
