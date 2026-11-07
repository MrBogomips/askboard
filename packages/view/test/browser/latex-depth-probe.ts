// The LaTeX bounds probe (latex-kanban-timeline, tasks 4.10 and 4.15; design decision 7, Measuring).
// Run by hand, not by `bun test` and not by the browser runner (the name has neither `.test.` nor
// `.browser.`), after a KaTeX bump or whenever a bound is in doubt, with the cross-session browser
// lock held:
//
//   bun packages/view/test/browser/latex-depth-probe.ts --out <file.json> [--engines chromium,webkit]
//     [--phases sweep,flat,realistic] [--from 4] [--to 24] [--only <regex on a family's name>]
//   bun packages/view/test/browser/latex-depth-probe.ts --report <file.json>...
//   bun packages/view/test/browser/latex-depth-probe.ts --verify <file.json> --nodes N --fractions F
//     --depth D --nesting S [--runs 3] [--out <verify.json>]
//
// The first form measures every family of `harness/latex-fixtures.ts` and `harness/latex-forms.ts`
// (task 4.10's constructs, the infix, hidden-opener, environment and style forms, and every control
// word with arguments in each argument position) alone, side by side to 2,000 code points and
// branching, flat content past 2,000 code points, and the realistic set, in each engine, and writes
// every row to `--out`. The second reads such files and applies design decision 7's rules; the third
// re-times the fixtures within the bounds, several runs each, the combined form and the ten-element
// runs of U-1.

import { writeFileSync } from "node:fs";
import { ENGINES, type Engine } from "./harness/engines.ts";
import { katexControlWords, LATEX_CONSTRUCTS } from "./harness/latex-fixtures.ts";
import {
  controlWordConstructs,
  EXTRA_CONSTRUCTS,
  optionalArgumentWords,
} from "./harness/latex-forms.ts";
import { LatexFrame } from "./harness/latex-frame.ts";
import { LATEX_SOURCES, loadMeasurer } from "./harness/latex-measure.ts";
import { reportOf } from "./harness/latex-probe-report.ts";
import {
  memoMeasure,
  type Progress,
  type Row,
  sweepFamilies,
  sweepFlat,
  sweepRealistic,
} from "./harness/latex-sweep.ts";
import { verify } from "./harness/latex-verify.ts";
import { machineOf } from "./harness/machine.ts";

const options = (argv: readonly string[]) => {
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const list = (flag: string, fallback: string): string[] =>
    (value(flag) ?? fallback).split(",").filter((entry) => entry !== "");
  const engines = list("--engines", "chromium,webkit") as Engine[];
  for (const engine of engines) {
    if (!(ENGINES as readonly string[]).includes(engine))
      throw new Error(`unknown engine ${engine}`);
  }
  const reportAt = argv.indexOf("--report");
  return {
    engines,
    phases: list("--phases", "sweep,flat,realistic"),
    from: Number(value("--from") ?? 4),
    to: Number(value("--to") ?? 24),
    only: value("--only") === undefined ? undefined : new RegExp(value("--only") as string),
    out: value("--out"),
    report:
      reportAt === -1 ? undefined : argv.slice(reportAt + 1).filter((a) => !a.startsWith("--")),
    verify: value("--verify"),
    nodes: Number(value("--nodes")),
    fractions: Number(value("--fractions")),
    depth: Number(value("--depth")),
    nesting: Number(value("--nesting")),
    runs: Number(value("--runs") ?? 3),
  };
};

const progress: Progress = (row) =>
  process.stderr.write(
    `${row.engine} ${row.family} | ${row.shape} ${row.asked} (${row.length} chars): ${
      row.ms === undefined ? (row.failure ?? "?") : `${Math.round(row.ms)} ms`
    } tree ${row.bun.treeDepth ?? "-"}/${row.bun.nodes ?? "-"}\n`,
  );

const collect = async (given: ReturnType<typeof options>) => {
  const measure = memoMeasure(await loadMeasurer());
  const words = katexControlWords(LATEX_SOURCES.katex);
  const { forms, skipped } = controlWordConstructs(
    words,
    measure,
    optionalArgumentWords(LATEX_SOURCES.katex),
  );
  const families = [...LATEX_CONSTRUCTS, ...EXTRA_CONSTRUCTS, ...forms].filter(
    (family) => given.only?.test(family.name) ?? true,
  );
  const rows: Row[] = [];
  const versions: Record<string, string> = {};
  for (const engine of given.engines) {
    const frame = new LatexFrame(engine);
    try {
      await frame.render("x");
      versions[engine] = frame.version;
      if (given.phases.includes("sweep"))
        rows.push(
          ...(await sweepFamilies(frame, measure, families, given.from, given.to, progress)),
        );
      if (given.phases.includes("flat"))
        rows.push(...(await sweepFlat(frame, measure, 500, progress)));
      if (given.phases.includes("realistic"))
        rows.push(...(await sweepRealistic(frame, measure, progress)));
    } finally {
      await frame.close();
    }
  }
  return { machine: machineOf(), versions, families: families.length, skipped, rows };
};

const main = async () => {
  const given = options(Bun.argv.slice(2));
  const watchdog = setTimeout(
    () => {
      process.stderr.write("the probe ran over its three hours: stopped\n");
      process.exit(2);
    },
    3 * 60 * 60 * 1_000,
  );
  if (given.report !== undefined) {
    process.stdout.write(await reportOf(given.report));
  } else if (given.verify !== undefined) {
    const result = await verify(given.verify, given, progress);
    process.stdout.write(result.text);
    if (given.out !== undefined) writeFileSync(given.out, JSON.stringify(result.record, null, 1));
  } else {
    const record = await collect(given);
    if (given.out !== undefined) writeFileSync(given.out, JSON.stringify(record));
    process.stdout.write(
      `${record.machine}\nengines ${JSON.stringify(record.versions)}\nfamilies ${record.families}, skipped ${record.skipped.length}, rows ${record.rows.length}\n`,
    );
  }
  clearTimeout(watchdog);
};

await main();
