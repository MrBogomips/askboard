// The driver (design decision 4), Playwright under Bun:
//   bun drive.ts versions
//   bun drive.ts <run> [--engines chromium,firefox,webkit] [--docs own,ironcalc] [--mode M]
//     [--repeat N] [--snapshot] [--tz <zone>] [--locale <tag>] [--board as-written|wasm]
//     [--view-wasm 0|1] [--latency-repeats N] [--bun-run <run>]
// Each load opens a fresh browser context (the browser process stays up), records CSP
// violations from the view and the board page, CSP lines on the console, every request other
// than the stand-in's own, requests that reached the server, the view's result and its timing
// marks. Writes runs/<run>/loads.json and runs/<run>/summary.json, and prints one line per load.
// The run name picks defaults (see PRESETS); `c1-negative` runs the negative controls.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startBoard } from "./board.ts";
import { gzipBytes } from "./build.ts";
import { loadSpecs, type LoadSpec, presetFor } from "./tools/view-presets.ts";
import { judge, type Load, summarise } from "./tools/view-verdict.ts";

const PROBE = import.meta.dir;
// Playwright's builds live in a scratch directory outside the repository (task 1.4).
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  console.error("drive.ts: set PLAYWRIGHT_BROWSERS_PATH to the scratch directory holding Playwright 1.64.1's browsers");
  process.exit(2);
}
const { chromium, firefox, webkit } = await import("playwright");
type Browser = Awaited<ReturnType<typeof chromium.launch>>;
type Page = Awaited<ReturnType<Browser["newPage"]>>;

const ENGINES = { chromium, firefox, webkit } as const;
type EngineName = keyof typeof ENGINES;
const TIMEOUT_MS = 240_000;

export type Options = {
  run: string;
  engines: EngineName[];
  docs: string[];
  mode: string;
  repeat: number;
  snapshot: boolean;
  tz?: string;
  locale?: string;
  board?: string;
  boardFlag: boolean;
  viewWasm?: string;
  latencyRepeats: number;
  bunRun: string;
};

function parseArgs(argv: string[]): Options {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const run = argv[0] as string;
  const preset = presetFor(run);
  const engines = (value("--engines") ?? "chromium,firefox,webkit").split(",") as EngineName[];
  for (const e of engines) if (!(e in ENGINES)) throw new Error(`unknown engine ${e}`);
  return {
    run,
    engines,
    docs: (value("--docs") ?? preset.docs.join(",")).split(","),
    mode: value("--mode") ?? preset.mode,
    repeat: Number(value("--repeat") ?? preset.repeat),
    snapshot: argv.includes("--snapshot") || preset.snapshot,
    tz: value("--tz"),
    locale: value("--locale"),
    board: value("--board"),
    boardFlag: argv.includes("--board"),
    viewWasm: value("--view-wasm"),
    latencyRepeats: Number(value("--latency-repeats") ?? 50),
    bunRun: value("--bun-run") ?? "view-bun",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Recorded = Pick<Load, "console" | "requests" | "pageErrors">;
type Board = Awaited<ReturnType<typeof startBoard>>;

const queryOf = (spec: LoadSpec): string => {
  const q = new URLSearchParams({ doc: spec.doc, mode: spec.mode, board: spec.board });
  if (spec.repeats !== undefined) q.set("repeats", String(spec.repeats));
  if (spec.viewWasm !== undefined) q.set("viewWasm", spec.viewWasm ? "1" : "0");
  if (spec.csp === false) q.set("csp", "0");
  return q.toString();
};

async function readEvents(page: Page, snapshot: boolean): Promise<{ events: Record<string, unknown>[]; board: Record<string, unknown>[]; t0: number | null }> {
  if (snapshot) {
    return page.evaluate(() => ({
      events: ((window as unknown as { __probeEvents?: Record<string, unknown>[] }).__probeEvents ?? []).slice(),
      board: [],
      t0: performance.timeOrigin,
    }));
  }
  return page.evaluate(() => {
    const p = (window as unknown as { __probe?: { events: Record<string, unknown>[]; board: Record<string, unknown>[]; t0: number | null } }).__probe;
    return p ? { events: p.events.slice(), board: p.board.slice(), t0: p.t0 } : { events: [], board: [], t0: null };
  });
}

async function loadOnce(browser: Browser, engine: EngineName, board: Board, spec: LoadSpec, options: Options, repeat: number): Promise<Load> {
  const context = await browser.newContext({ ...(options.tz ? { timezoneId: options.tz } : {}), ...(options.locale ? { locale: options.locale } : {}) });
  const page = await context.newPage();
  const recorded: Recorded = { console: [], requests: [], pageErrors: [] };
  page.on("console", (m) => recorded.console.push({ type: m.type(), text: m.text().slice(0, 600) }));
  page.on("pageerror", (e) => recorded.pageErrors.push(String(e).slice(0, 600)));
  page.on("request", (r) => recorded.requests.push({ url: r.url().slice(0, 300), method: r.method() }));
  page.on("requestfailed", (r) => recorded.requests.push({ url: r.url().slice(0, 300), method: r.method(), failure: r.failure()?.errorText }));
  const leaksBefore = board.leaks.length;
  const query = queryOf(spec);
  let url = `${board.url}/b?${query}`;
  let snapshotFile: string | null = null;
  if (spec.snapshot) {
    const html = board.view(new URL(`${board.url}/s?${query}`)).html;
    snapshotFile = join(PROBE, "runs", options.run, "snapshots", `${spec.label.replaceAll(" ", "_")}.html`);
    await Bun.write(snapshotFile, html);
    url = `file://${snapshotFile}`;
  }
  const viewHtml = board.view(new URL(`${board.url}/v?${query}`)).html;
  const doc = { bytes: Buffer.byteLength(viewHtml), gzip: gzipBytes(viewHtml) };
  const started = Date.now();
  let probe = { events: [] as Record<string, unknown>[], board: [] as Record<string, unknown>[], t0: null as number | null };
  try {
    await page.goto(url);
    while (Date.now() - started < TIMEOUT_MS) {
      probe = await readEvents(page, spec.snapshot);
      if (probe.events.some((e) => e.kind === "done")) break;
      // A chunk that never ran (a refused script, a parse error) posts nothing more.
      if (Date.now() - started > (spec.expectFailure ? 8_000 : TIMEOUT_MS) && !probe.events.some((e) => e.kind === "chunk-running")) break;
      await sleep(spec.mode === "suite" || spec.mode === "latency" ? 200 : 25);
    }
    // Late violations and console lines (Firefox reports some after the fact).
    await sleep(150);
    probe = await readEvents(page, spec.snapshot);
  } catch (e) {
    recorded.pageErrors.push(`driver: ${String(e).slice(0, 300)}`);
  }
  await context.close();
  const leaks = board.leaks.slice(leaksBefore).filter((l) => l.path !== "/favicon.ico");
  return judge({ engine, spec, repeat, probe, recorded, leaks, base: board.url, snapshotFile, wallMs: Date.now() - started, bunRun: options.bunRun, doc });
}

async function versions(): Promise<void> {
  const pkg = await Bun.file(join(PROBE, "node_modules/playwright/package.json")).json();
  const ironcalc = await Bun.file(join(PROBE, "node_modules/@ironcalc/wasm/package.json")).json();
  console.log(`playwright ${pkg.version}; bun ${Bun.version}; @ironcalc/wasm ${ironcalc.version}; PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
  const rows: Record<string, string> = {};
  for (const name of Object.keys(ENGINES) as EngineName[]) {
    try {
      const browser = await ENGINES[name].launch();
      rows[name] = browser.version();
      await browser.close();
    } catch (e) {
      rows[name] = `untested: ${String(e).split("\n")[0]}`;
    }
    console.log(`${name.padEnd(9)} ${rows[name]}`);
  }
  mkdirSync(join(PROBE, "runs", "versions"), { recursive: true });
  await Bun.write(join(PROBE, "runs", "versions", "versions.json"), `${JSON.stringify({ date: new Date().toISOString(), playwright: pkg.version, bun: Bun.version, ironcalc: ironcalc.version, browsers: rows }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "versions") return versions();
  if (!argv[0] || argv[0].startsWith("--")) {
    console.error("usage: bun drive.ts versions | bun drive.ts <run> [--engines ...] [--docs ...] [--mode M] [--repeat N] [--snapshot] [--tz Z] [--locale L] [--board as-written|wasm]");
    process.exit(2);
  }
  const options = parseArgs(argv);
  const dir = join(PROBE, "runs", options.run);
  mkdirSync(dir, { recursive: true });
  const board = await startBoard();
  const loads: Load[] = [];
  try {
    for (const engine of options.engines) {
      const browser = await ENGINES[engine].launch();
      try {
        for (const spec of loadSpecs(options)) {
          for (let i = 1; i <= options.repeat; i++) {
            const load = await loadOnce(browser, engine, board, spec, options, i);
            loads.push(load);
            console.log(load.line);
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    board.stop();
  }
  const command = `bun drive.ts ${argv.join(" ")}`;
  await Bun.write(join(dir, "loads.json"), `${JSON.stringify({ command, options, loads }, null, 2)}\n`);
  const summary = summarise(loads, { command, options, build: board.build.manifest });
  await Bun.write(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`summary: ${JSON.stringify(summary.counts)}  -> runs/${options.run}/summary.json`);
}

await main();
