// The browser driver (design decision 2). Loads fixtures through the board-page stand-in in
// Playwright's Chromium, Firefox and WebKit and the installed Chrome and Edge, and records CSP
// violations, console messages, requests, storage and worker accesses, ready times and a
// screenshot per load, then a verdict (design decision 2's rule).
//
//   bun drive.ts versions
//   bun drive.ts <run> [--fixtures a,b] [--engines chromium,firefox,webkit,chrome,msedge]
//       [--renderers own,json-render] [--repeat N] [--control] [--snapshot]
//       [--color-scheme light|dark] [--script loads|compare|c2]
//
// Writes runs/<run>/<engine>/<fixture>.<renderer>[.<n>].json and .png, and runs/<run>/summary.json.
// The Playwright engines come from PLAYWRIGHT_BROWSERS_PATH (the spike's scratch directory).

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type Browser, type BrowserType, chromium, firefox, type Page, webkit } from "playwright";
import type { Fixture } from "./board.ts";

const PROBE = import.meta.dir;
const ENGINES: Record<string, { type: BrowserType; channel?: string }> = {
  chromium: { type: chromium },
  firefox: { type: firefox },
  webkit: { type: webkit },
  chrome: { type: chromium, channel: "chrome" },
  msedge: { type: chromium, channel: "msedge" },
};
const VISIBLE_TIMEOUT_MS = 30_000;
const SETTLE_MS = 1_300;

type ProbeEvent = { kind: string; t: number; [key: string]: unknown };
type Snapshot = { events: ProbeEvent[]; board: ProbeEvent[]; t0: number | null };
type Options = {
  run: string;
  fixtures: string[];
  engines: string[];
  renderers: string[];
  repeat: number;
  control: boolean;
  snapshot: boolean;
  colorScheme: "light" | "dark";
  script: string;
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const parseArgs = (argv: string[]): Options => {
  const value = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 && argv[index + 1] ? (argv[index + 1] as string) : fallback;
  };
  const list = (flag: string, fallback: string) => value(flag, fallback).split(",").filter(Boolean);
  return {
    run: argv[0] as string,
    fixtures: list("--fixtures", ""),
    engines: list("--engines", "chromium,firefox,webkit,chrome,msedge"),
    renderers: list("--renderers", "own"),
    repeat: Number(value("--repeat", "1")),
    control: argv.includes("--control"),
    snapshot: argv.includes("--snapshot"),
    colorScheme: value("--color-scheme", "light") as "light" | "dark",
    script: value("--script", "loads"),
  };
};

// The board stand-in runs as its own process, as it does when the product owner starts it.
const startBoard = async () => {
  const child = Bun.spawn([process.execPath, join(PROBE, "board.ts"), "--json"], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const reader = child.stdout.getReader();
  const { value } = await reader.read();
  const { url } = JSON.parse(new TextDecoder().decode(value).split("\n")[0] as string);
  reader.releaseLock();
  return { url: url as string, stop: () => child.kill() };
};

const launch = async (engine: string): Promise<Browser> => {
  const spec = ENGINES[engine];
  if (!spec) throw new Error(`unknown engine ${engine}`);
  return spec.type.launch(spec.channel ? { channel: spec.channel } : {});
};

type Session = {
  page: Page;
  snapshot: boolean;
  close: () => Promise<void>;
  setPhase: (phase: string) => void;
};
type Recorded = {
  // `phase` is "screenshot" for lines logged while Playwright takes the screenshot: in WebKit
  // it injects a stylesheet the CSP refuses (console only, no violation event).
  console: { type: string; text: string; url: string; phase: string }[];
  requests: { url: string; method: string; failure?: string }[];
  pageErrors: string[];
};

const openSession = async (
  browser: Browser,
  url: string,
  options: Options,
): Promise<Session & Recorded> => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: options.colorScheme,
  });
  const page = await context.newPage();
  const recorded: Recorded = { console: [], requests: [], pageErrors: [] };
  let phase = "load";
  page.on("console", (m) =>
    recorded.console.push({ type: m.type(), text: m.text(), url: m.location().url, phase }),
  );
  page.on("pageerror", (e) => recorded.pageErrors.push(String(e)));
  page.on("request", (r) => recorded.requests.push({ url: r.url(), method: r.method() }));
  page.on("requestfailed", (r) =>
    recorded.requests.push({ url: r.url(), method: r.method(), failure: r.failure()?.errorText }),
  );
  await page.goto(url);
  return {
    page,
    snapshot: options.snapshot,
    close: () => context.close(),
    setPhase: (next) => {
      phase = next;
    },
    ...recorded,
  };
};

const readProbe = (session: Session): Promise<Snapshot> =>
  session.snapshot
    ? session.page.evaluate(() => ({
        events: (window as unknown as { __probeEvents?: ProbeEvent[] }).__probeEvents ?? [],
        board: [],
        t0: performance.timeOrigin,
      }))
    : session.page.evaluate(
        () => (window as unknown as { __probe?: Snapshot }).__probe ?? { events: [], board: [], t0: null },
      );

const waitFor = async (
  session: Session,
  match: (e: ProbeEvent) => boolean,
  timeout = VISIBLE_TIMEOUT_MS,
): Promise<ProbeEvent | null> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = (await readProbe(session)).events.find(match);
    if (found) return found;
    await sleep(50);
  }
  return null;
};

let commandId = 0;
const command = async (session: Session, name: string, args: object = {}) => {
  commandId += 1;
  const id = commandId;
  await session.page.evaluate(
    ([c, a, i, snapshot]) => {
      const message = { askboardProbeCommand: c, args: a, id: i };
      if (snapshot) window.postMessage(message, "*");
      else (window as unknown as { __probeSend: (...x: unknown[]) => void }).__probeSend(c, a, i);
    },
    [name, args, id, session.snapshot] as const,
  );
  const reply = await waitFor(session, (e) => e.kind === "command" && e.id === id, 5_000);
  return (reply?.result ?? null) as Record<string, unknown> | null;
};

const viewLocator = (session: Session, selector: string) =>
  session.snapshot ? session.page.locator(selector) : session.page.frameLocator("#view").locator(selector);

// Requests other than the stand-in's own board page and view document.
const foreign = (requests: Recorded["requests"], base: string) =>
  requests.filter(
    (r) =>
      !r.url.startsWith(`${base}/b/`) &&
      !r.url.startsWith(`${base}/v/`) &&
      !r.url.startsWith("file:") &&
      !r.url.startsWith("about:") &&
      !r.url.startsWith("data:"),
  );

type Load = {
  engine: string;
  fixture: string;
  renderer: string;
  repeat: number;
  mode: "board" | "control" | "snapshot";
  visible: boolean;
  timeToVisibleMs: number | null;
  probe: Snapshot;
  check: Record<string, unknown> | null;
  dump: Record<string, unknown> | null;
} & Recorded & { verdict: string; reasons: string[]; signals?: unknown };

const loadUrl = (base: string, fixture: string, renderer: string, options: Options): string => {
  const query = new URLSearchParams({ renderer });
  if (options.control) query.set("control", "1");
  return `${base}/b/${fixture}?${query}`;
};

const snapshotFile = async (base: string, fixture: string, renderer: string, options: Options) => {
  const html = await (await fetch(`${base}/s/${fixture}?renderer=${renderer}`)).text();
  const file = join(PROBE, "runs", options.run, "snapshots", `${fixture}.${renderer}.html`);
  await Bun.write(file, html);
  return `file://${file}`;
};

const visibleEvent = (e: ProbeEvent) => e.kind === "visible" || e.kind === "boot-failed";

// Firefox loads /favicon.ico for the board page itself; the board policy blocks it. That is the
// browser's request, not the view's: recorded, never counted against a fixture.
const isFavicon = (e: ProbeEvent) => String(e.blockedURI).endsWith("/favicon.ico");

// Violations from both documents: WebKit reports some violations of the inherited board policy
// (eval) to the board page, not to the view. `where` says which document received the event.
export const violationsOf = (probe: Snapshot): ProbeEvent[] => [
  ...probe.events.filter((e) => e.kind === "violation").map((e) => ({ ...e, where: "view" })),
  ...probe.board.filter((e) => !isFavicon(e)).map((e) => ({ ...e, where: "board" })),
];

const matches = (expect: Record<string, unknown>, load: Omit<Load, "verdict" | "reasons">, base: string) => {
  const events = load.probe.events;
  switch (expect.kind) {
    case "violation":
      return violationsOf(load.probe).some(
        (e) =>
          (expect.directives as string[]).includes(String(e.directive)) &&
          (!expect.blocked || e.blockedURI === expect.blocked) &&
          (!expect.policyIncludes || String(e.policy).includes(String(expect.policyIncludes))),
      );
    case "storage":
      return events.some(
        (e) => e.kind === "storage" && e.api === expect.api && e.outcome === expect.outcome,
      );
    case "no-request":
      return !load.requests.some((r) => r.url.startsWith(`${base}${expect.path}`));
    // The view still answers commands: nothing navigated it away.
    case "alive":
      return load.dump !== null;
    default:
      return false;
  }
};

// What each engine showed for a negative probe: console lines from the view, and violations.
const signalsOf = (load: Omit<Load, "verdict" | "reasons">) => ({
  console: load.console
    .filter((m) => m.phase === "load" && (m.url === "about:srcdoc" || m.url === ""))
    .map((m) => m.text),
  violations: violationsOf(load.probe).map((e) => ({
    where: e.where,
    directive: e.directive,
    blockedURI: e.blockedURI,
    policy: String(e.policy ?? "").includes("connect-src 'self'") ? "board" : "view",
  })),
  outcome: load.probe.events.find((e) => e.kind === "emit")?.message,
});

// Design decision 2's verdict rule; a negative fixture passes when every expected signal shows.
const judge = (load: Omit<Load, "verdict" | "reasons">, fixture: Fixture, base: string) => {
  const reasons: string[] = [];
  const events = load.probe.events;
  if (fixture.negative) {
    for (const expect of fixture.negative) {
      if (!matches(expect, load, base)) reasons.push(`not seen: ${JSON.stringify(expect)}`);
    }
    return { verdict: reasons.length === 0 ? "caught" : "missed", reasons, signals: signalsOf(load) };
  }
  // A blocked eval feature probe that the library catches is told apart (design decision 2).
  const isEvalProbe = (e: ProbeEvent) => e.blockedURI === "eval";
  const violations = violationsOf(load.probe);
  const probes = violations.filter(isEvalProbe);
  const others = violations.filter((e) => !isEvalProbe(e));
  if (others.length) reasons.push(`${others.length} violation(s)`);
  const requests = foreign(load.requests, base);
  if (requests.length) reasons.push(`${requests.length} request(s): ${requests.map((r) => r.url).join(" ")}`);
  const storage = events.filter(
    (e) => (e.kind === "storage" && e.outcome === "threw") || e.kind === "worker",
  );
  if (storage.length) reasons.push(`${storage.length} storage or worker access(es)`);
  const errors = events.filter((e) => ["error", "rejection", "boot-failed"].includes(e.kind));
  if (errors.length || load.pageErrors.length) {
    reasons.push(`errors: ${[...errors.map((e) => e.message ?? e.reason), ...load.pageErrors].join("; ")}`);
  }
  if (!load.visible) reasons.push("never visible");
  if (fixture.check && load.check?.ok !== true) reasons.push(`check failed: ${JSON.stringify(load.check)}`);
  if (reasons.length > 0) return { verdict: "fail", reasons };
  if (probes.length > 0) {
    return { verdict: "probe", reasons: [`${probes.length} blocked eval probe(s), caught by the library`] };
  }
  return { verdict: "pass", reasons };
};

const loadOnce = async (
  browser: Browser,
  base: string,
  engine: string,
  name: string,
  fixture: Fixture,
  renderer: string,
  repeat: number,
  options: Options,
  keep?: (session: Session & Recorded) => Promise<void>,
): Promise<Load> => {
  const url = options.snapshot
    ? await snapshotFile(base, name, renderer, options)
    : loadUrl(base, name, renderer, options);
  const session = await openSession(browser, url, options);
  try {
    const visible = await waitFor(session, visibleEvent);
    await sleep(SETTLE_MS);
    const check = fixture.check ? await command(session, "check", fixture.check) : null;
    const dump = await command(session, "dump");
    if (keep) await keep(session);
    const probe = await readProbe(session);
    const dir = join(PROBE, "runs", options.run, engine);
    await mkdir(dir, { recursive: true });
    const stem = `${name}.${renderer}${options.repeat > 1 ? `.${repeat}` : ""}`;
    session.setPhase("screenshot");
    await session.page.screenshot({ path: join(dir, `${stem}.png`), caret: "initial" });
    const ok = visible?.kind === "visible";
    const load = {
      engine,
      fixture: name,
      renderer,
      repeat,
      mode: (options.snapshot ? "snapshot" : options.control ? "control" : "board") as Load["mode"],
      visible: ok,
      timeToVisibleMs: ok && probe.t0 !== null ? Math.round((visible.t - probe.t0) * 10) / 10 : null,
      probe,
      check,
      dump,
      console: session.console,
      requests: session.requests,
      pageErrors: session.pageErrors,
    };
    const result = { ...load, ...judge(load, fixture, base) };
    await Bun.write(join(dir, `${stem}.json`), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await session.close();
  }
};

// Item IDs from React's useId differ between mounts; everything else must match exactly.
export const normalize = (html: string): string => html.replace(/(«|_)r[0-9a-z]+(»|_)/g, "«id»");

const firstDifference = (a: string, b: string): string | null => {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return `at ${i}: «${a.slice(Math.max(0, i - 60), i + 60)}» vs «${b.slice(Math.max(0, i - 60), i + 60)}»`;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

type Context = { base: string; fixtures: Map<string, Fixture>; options: Options };

const runLoads = async (browser: Browser, engine: string, ctx: Context) => {
  const loads: Load[] = [];
  for (const name of ctx.options.fixtures) {
    for (const renderer of ctx.options.renderers) {
      for (let n = 1; n <= ctx.options.repeat; n += 1) {
        const fixture = ctx.fixtures.get(name) as Fixture;
        const load = await loadOnce(browser, ctx.base, engine, name, fixture, renderer, n, ctx.options);
        loads.push(load);
        console.log(
          `${engine.padEnd(8)} ${name.padEnd(20)} ${renderer.padEnd(11)} ${String(n).padStart(2)} ` +
            `${load.verdict.padEnd(7)} visible ${load.timeToVisibleMs ?? "-"} ms  ${load.reasons.join("; ")}`,
        );
      }
    }
  }
  return loads.map(({ probe, dump, console: c, requests, ...rest }) => ({
    ...rest,
    violations: violationsOf(probe),
    browserFavicon: probe.board.filter(isFavicon).length > 0,
    storage: probe.events.filter((e) => e.kind.startsWith("storage") || e.kind.startsWith("worker")),
    emits: probe.events.filter((e) => e.kind === "emit").map((e) => e.message),
    consoleErrors: c.filter((m) => (m.type === "error" || m.type === "warning") && m.phase === "load"),
    foreignRequests: foreign(requests, ctx.base),
  }));
};

// Task 2.1: the same fixture through both renderers gives the same DOM.
const runCompare = async (browser: Browser, engine: string, ctx: Context) => {
  const results = [];
  for (const name of ctx.options.fixtures) {
    const fixture = ctx.fixtures.get(name) as Fixture;
    const [own, json] = [
      await loadOnce(browser, ctx.base, engine, name, fixture, "own", 1, ctx.options),
      await loadOnce(browser, ctx.base, engine, name, fixture, "json-render", 1, ctx.options),
    ];
    const a = String(own.dump?.html ?? "");
    const b = String(json.dump?.html ?? "");
    const result = {
      fixture: name,
      verdicts: { own: own.verdict, "json-render": json.verdict },
      rawEqual: a === b,
      normalizedEqual: normalize(a) === normalize(b),
      difference: firstDifference(normalize(a), normalize(b)),
      bytes: { own: a.length, "json-render": b.length },
    };
    console.log(`${engine.padEnd(8)} ${name.padEnd(12)} same DOM: ${result.normalizedEqual} (raw ${result.rawEqual}) ${result.difference ?? ""}`);
    results.push(result);
  }
  return results;
};

const applyEdits = async (session: Session, fixture: Fixture) => {
  for (const edit of fixture.edits ?? []) {
    const target = viewLocator(session, edit.selector);
    if (edit.action === "fill") await target.fill(edit.value ?? "");
    else await target.click();
  }
  await sleep(300);
};

const sameBoxes = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// Exit criterion 2 per renderer: determinism, no edit state, no network, ready after async work.
const runC2 = async (browser: Browser, engine: string, ctx: Context) => {
  const results = [];
  for (const renderer of ctx.options.renderers) {
    const atoms = ctx.fixtures.get("atoms") as Fixture;
    const first = await loadOnce(browser, ctx.base, engine, "atoms", atoms, renderer, 1, ctx.options);
    const second = await loadOnce(browser, ctx.base, engine, "atoms", atoms, renderer, 2, ctx.options);
    const determinism = String(first.dump?.html) === String(second.dump?.html);

    let edited: Record<string, unknown> | null = null;
    let remounted: Record<string, unknown> | null = null;
    let generation2 = false;
    const editLoad = await loadOnce(browser, ctx.base, engine, "atoms", atoms, renderer, 3, ctx.options, async (s) => {
      await applyEdits(s, atoms);
      edited = await command(s, "dump");
      await command(s, "remount");
      generation2 = (await waitFor(s, (e) => e.kind === "visible" && e.generation === 2)) !== null;
      await sleep(300);
      remounted = await command(s, "dump");
    });
    const e = edited as Record<string, unknown> | null;
    const r = remounted as Record<string, unknown> | null;
    const noEditState =
      generation2 &&
      e !== null &&
      r !== null &&
      normalize(String(e.html)) === normalize(String(r.html)) &&
      JSON.stringify(e.values) === JSON.stringify(r.values) &&
      JSON.stringify(e.draft) === JSON.stringify(r.draft);

    const delayed = ctx.fixtures.get("delayed") as Fixture;
    const early = ctx.fixtures.get("delayed-early") as Fixture;
    const readyCheck = async (name: string, fixture: Fixture) => {
      const load = await loadOnce(browser, ctx.base, engine, name, fixture, renderer, 1, ctx.options);
      const events = load.probe.events;
      const mount = events.find((x) => x.kind === "mount");
      const item = events.find((x) => x.kind === "ready" && x.id === fixture.delayed?.item);
      const visible = events.find((x) => x.kind === "visible");
      const after = events.find((x) => x.kind === "boxes");
      return {
        readyAfterMs: item && mount ? Math.round(item.t - mount.t) : null,
        settledBeforeReady: item && mount ? item.t - mount.t >= (fixture.delayed?.ms ?? 0) : false,
        boxesStable: visible && after ? sameBoxes(visible.boxes, after.boxes) : false,
        verdict: load.verdict,
      };
    };
    const ready = await readyCheck("delayed", delayed);
    const control = await readyCheck("delayed-early", early);
    const all = [first, second, editLoad];
    const network = all.every(
      (l) =>
        foreign(l.requests, ctx.base).length === 0 &&
        !l.probe.events.some((x) => x.kind === "violation" && x.directive === "connect-src"),
    );
    const result = {
      renderer,
      determinism,
      noEditState,
      editedDraft: e?.draft ?? null,
      noNetwork: network,
      readyAfterAsync: ready.settledBeforeReady && ready.boxesStable,
      ready,
      negativeControl: control,
      verdicts: all.map((l) => l.verdict),
    };
    console.log(
      `${engine.padEnd(8)} ${renderer.padEnd(11)} determinism ${determinism}  no edit state ${noEditState}  ` +
        `no network ${network}  ready after async ${result.readyAfterAsync} (${ready.readyAfterMs} ms)  ` +
        `control boxes stable ${control.boxesStable}`,
    );
    results.push(result);
  }
  return results;
};

const versions = async () => {
  for (const engine of Object.keys(ENGINES)) {
    try {
      const browser = await launch(engine);
      console.log(`${engine.padEnd(8)} ${browser.version()}`);
      await browser.close();
    } catch (error) {
      console.log(`${engine.padEnd(8)} untested: ${String(error).split("\n")[0]}`);
    }
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv[0] === "versions") return versions();
  if (!argv[0] || argv[0].startsWith("--")) throw new Error("usage: bun drive.ts <run> [options]");
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    throw new Error("set PLAYWRIGHT_BROWSERS_PATH to the scratch directory with the engines");
  }
  const options = parseArgs(argv);
  const board = await startBoard();
  try {
    const { loadFixtures } = await import("./board.ts");
    const fixtures = await loadFixtures();
    if (options.fixtures.length === 0) options.fixtures = [...fixtures.keys()];
    const missing = options.fixtures.filter((f) => !fixtures.has(f));
    if (missing.length) throw new Error(`no fixture ${missing.join(", ")}`);
    const ctx = { base: board.url, fixtures, options };
    const summary: Record<string, unknown> = {
      run: options.run,
      date: new Date().toISOString(),
      runtime: `bun ${Bun.version}`,
      options,
      engines: {},
    };
    for (const engine of options.engines) {
      let browser: Browser | null = null;
      try {
        browser = await launch(engine);
      } catch (error) {
        (summary.engines as Record<string, unknown>)[engine] = { untested: String(error).split("\n")[0] };
        console.log(`${engine}: untested (${String(error).split("\n")[0]})`);
        continue;
      }
      try {
        const runner = { loads: runLoads, compare: runCompare, c2: runC2 }[options.script];
        if (!runner) throw new Error(`unknown script ${options.script}`);
        const results = await runner(browser, engine, ctx);
        (summary.engines as Record<string, unknown>)[engine] = { version: browser.version(), results };
      } finally {
        await browser.close();
      }
    }
    if (options.script === "loads") summary.timing = timing(summary.engines as Record<string, { results?: { fixture: string; renderer: string; timeToVisibleMs: number | null }[] }>);
    await mkdir(join(PROBE, "runs", options.run), { recursive: true });
    await Bun.write(join(PROBE, "runs", options.run, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    board.stop();
  }
};

// Median and maximum time to visible per engine, fixture and renderer.
const timing = (
  engines: Record<string, { results?: { fixture: string; renderer: string; timeToVisibleMs: number | null }[] }>,
) =>
  Object.fromEntries(
    Object.entries(engines).map(([engine, { results = [] }]) => {
      const groups = new Map<string, number[]>();
      for (const r of results) {
        if (r.timeToVisibleMs === null) continue;
        const key = `${r.fixture}.${r.renderer}`;
        groups.set(key, [...(groups.get(key) ?? []), r.timeToVisibleMs]);
      }
      return [
        engine,
        Object.fromEntries(
          [...groups].map(([key, values]) => [key, { n: values.length, median: median(values), max: Math.max(...values) }]),
        ),
      ];
    }),
  );

if (import.meta.main) await main();
