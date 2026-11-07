// The LaTeX nesting probe (latex-kanban-timeline, task 4.10; design decision 7, Bounded work). Run
// by hand, not by `bun test` and not by the browser runner (the name has neither `.test.` nor
// `.browser.`), after a KaTeX bump or whenever the limit is in doubt:
//
//   bun packages/view/test/browser/latex-depth-probe.ts [--engines chromium,webkit]
//     [--from 4] [--to 24] [--limit 12] [--skip-words | --words-only] [--out <file.json>]
//
// For each engine it renders every construct of `harness/latex-fixtures.ts` at each depth from
// `--from` to `--to`, alone, repeated side by side to 2,000 code points and, where an engine's time
// at least doubles from one depth to the next, as a branching nest; a construct stops at its first
// failure in its shape. It then takes the largest depth at which every fixture of both engines
// renders in under one second with no failure (the limit) and renders every control word KaTeX
// names nested to that depth, reporting the slowest. The tables go to stdout as Markdown; the whole
// record goes to `--out` as JSON. Take the cross-session browser lock before a run.

import { writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { join } from "node:path";
import { ENGINES, type Engine } from "./harness/engines.ts";
import {
  depthOfFixture,
  fixtureFor,
  katexControlWords,
  LATEX_CONSTRUCTS,
  nestControlWord,
  type Shape,
} from "./harness/latex-fixtures.ts";
import { LatexFrame, type RenderResult } from "./harness/latex-frame.ts";

const FAST_MS = 1_000;
const DOUBLING_FLOOR_MS = 20;

type Row = {
  readonly engine: Engine;
  readonly construct: string;
  readonly shape: Shape;
  readonly depth: number;
  readonly length: number;
  readonly result: RenderResult;
};

const options = (argv: readonly string[]) => {
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const engines = (value("--engines") ?? "chromium,webkit").split(",") as Engine[];
  for (const engine of engines) {
    if (!(ENGINES as readonly string[]).includes(engine))
      throw new Error(`unknown engine ${engine}`);
  }
  return {
    engines,
    from: Number(value("--from") ?? 4),
    to: Number(value("--to") ?? 24),
    limit: value("--limit") === undefined ? undefined : Number(value("--limit")),
    out: value("--out"),
    skipWords: argv.includes("--skip-words"),
    wordsOnly: argv.includes("--words-only"),
  };
};

const text = (row: Row): string =>
  row.result.ok ? `${Math.round(row.result.ms)}` : `FAIL ${row.result.reason}`;

const progress = (row: Row) =>
  process.stderr.write(
    `${row.engine} ${row.construct} ${row.shape} ${row.depth} (${row.length} chars): ${text(row)}\n`,
  );

// One engine, one construct, one shape: increasing depths until the first failure.
const sweep = async (
  frame: LatexFrame,
  construct: (typeof LATEX_CONSTRUCTS)[number],
  shape: Shape,
  from: number,
  to: number,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let depth = from; depth <= to; depth += 1) {
    const expression = fixtureFor(construct, shape, depth);
    const read = depthOfFixture(expression);
    if (read !== depth)
      throw new Error(`${construct.name} ${shape}: scan reads ${read}, not ${depth}`);
    const result = await frame.render(expression);
    const row: Row = {
      engine: frame.engine,
      construct: construct.name,
      shape,
      depth,
      length: [...expression].length,
      result,
    };
    progress(row);
    rows.push(row);
    if (!result.ok) break;
  }
  return rows;
};

// Whether the time at least doubles from one depth to the next in these rows.
const doubles = (rows: readonly Row[]): boolean =>
  rows.some((row, at) => {
    const next = rows[at + 1];
    return (
      row.result.ok &&
      next?.result.ok === true &&
      row.result.ms >= DOUBLING_FLOOR_MS &&
      next.result.ms >= 2 * row.result.ms
    );
  });

const probeEngine = async (engine: Engine, from: number, to: number): Promise<Row[]> => {
  const frame = new LatexFrame(engine);
  const rows: Row[] = [];
  try {
    for (const construct of LATEX_CONSTRUCTS) {
      const alone = await sweep(frame, construct, "alone", from, to);
      rows.push(...alone);
      rows.push(...(await sweep(frame, construct, "side by side", from, to)));
      if (doubles(alone)) rows.push(...(await sweep(frame, construct, "branching", from, to)));
    }
  } finally {
    await frame.close();
  }
  return rows;
};

/** The largest depth at which every fixture of every engine passes, with every smaller one passing. */
const limitOf = (rows: readonly Row[], from: number, to: number): number => {
  let limit = from - 1;
  for (let depth = from; depth <= to; depth += 1) {
    const atDepth = rows.filter((row) => row.depth === depth);
    const failed = atDepth.some((row) => !row.result.ok || row.result.ms >= FAST_MS);
    // A construct that failed at a smaller depth has no row here, and the loop has stopped there.
    if (failed) break;
    limit = depth;
  }
  return limit;
};

const table = (rows: readonly Row[], engines: readonly Engine[], depths: readonly number[]) => {
  const lines = [
    `| construct | shape | depth | ${engines.map((engine) => `${engine} ms`).join(" | ")} |`,
    `|---|---|---|${engines.map(() => "---").join("|")}|`,
  ];
  const keys = [...new Set(rows.map((row) => `${row.construct}\u0000${row.shape}`))];
  for (const key of keys) {
    const [construct, shape] = key.split("\u0000") as [string, Shape];
    for (const depth of depths) {
      const cells = engines.map((engine) => {
        const row = rows.find(
          (r) =>
            r.engine === engine &&
            r.construct === construct &&
            r.shape === shape &&
            r.depth === depth,
        );
        return row === undefined ? "-" : text(row);
      });
      if (cells.some((cell) => cell !== "-"))
        lines.push(`| ${construct} | ${shape} | ${depth} | ${cells.join(" | ")} |`);
    }
  }
  return lines.join("\n");
};

const controlWords = async (engine: Engine, depth: number) => {
  const names = katexControlWords(
    Bun.resolveSync("katex", join(import.meta.dir, "../../../widgets")),
  ).filter((name) => !name.includes("@"));
  const frame = new LatexFrame(engine);
  const rows: { name: string; ms: number | string }[] = [];
  try {
    for (const name of names) {
      const result = await frame.render(nestControlWord(name, depth));
      rows.push({
        name,
        ms: result.ok
          ? result.ms
          : result.reason === "error"
            ? "parse error"
            : `FAIL ${result.reason}`,
      });
    }
  } finally {
    await frame.close();
  }
  return rows;
};

const main = async () => {
  const given = options(Bun.argv.slice(2));
  const watchdog = setTimeout(
    () => {
      process.stderr.write("the probe ran over its two hours: stopped\n");
      process.exit(2);
    },
    2 * 60 * 60 * 1_000,
  );
  const rows: Row[] = [];
  const versions: Record<string, string> = {};
  for (const engine of given.engines) {
    const probe = new LatexFrame(engine);
    await probe.render("x");
    versions[engine] = probe.version;
    await probe.close();
    if (!given.wordsOnly) rows.push(...(await probeEngine(engine, given.from, given.to)));
  }
  const limit = given.limit ?? limitOf(rows, given.from, given.to);
  const words: Record<string, { name: string; ms: number | string }[]> = {};
  if (!given.skipWords) {
    for (const engine of given.engines) words[engine] = await controlWords(engine, limit);
  }
  const machine = `${platform()} ${release()}, ${cpus()[0]?.model ?? "?"} x${cpus().length}, ${Math.round(totalmem() / 2 ** 30)} GiB`;
  const depths = [
    ...new Set([limit - 2, limit - 1, limit, limit + 1, limit + 2, limit + 4, given.to]),
  ]
    .filter((depth) => depth >= given.from && depth <= given.to)
    .sort((a, b) => a - b);
  process.stdout.write(
    `machine: ${machine}\nengines: ${JSON.stringify(versions)}\nlimit: ${limit}\n\n`,
  );
  process.stdout.write(`${table(rows, given.engines, depths)}\n\n`);
  for (const engine of given.engines) {
    const slow = (words[engine] ?? [])
      .filter((word): word is { name: string; ms: number } => typeof word.ms === "number")
      .sort((a, b) => b.ms - a.ms);
    const failed = (words[engine] ?? []).filter(
      (word) => typeof word.ms === "string" && word.ms.startsWith("FAIL"),
    );
    process.stdout.write(
      `${engine}: control words at depth ${limit}, slowest five: ${slow
        .slice(0, 5)
        .map((word) => `${word.name} ${Math.round(word.ms)} ms`)
        .join(
          ", ",
        )}; rendered ${slow.length}; failed: ${failed.map((word) => `${word.name} ${word.ms}`).join(", ") || "none"}\n`,
    );
  }
  if (given.out !== undefined) {
    writeFileSync(given.out, JSON.stringify({ machine, versions, limit, rows, words }, null, 1));
  }
  clearTimeout(watchdog);
};

await main();
