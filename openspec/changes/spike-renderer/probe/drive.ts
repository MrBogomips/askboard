// The browser driver (design decision 2). Loads fixtures through the board-page stand-in in
// Playwright's Chromium, Firefox and WebKit and the installed Chrome and Edge, and records CSP
// violations, console messages, requests, storage and worker accesses, ready times and a
// screenshot per load, then a verdict (design decision 2's rule).
//
//   bun drive.ts versions
//   bun drive.ts <run> [--fixtures a,b] [--engines chromium,firefox,webkit,chrome,msedge]
//       [--renderers own,json-render] [--repeat N] [--repeat-only a,b] [--control] [--snapshot]
//       [--color-scheme light|dark] [--variants a,b] [--script loads|compare|c2|measure|golden]
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
  // Fixtures the repeat applies to; the others load once. Empty: all of them.
  repeatOnly: string[];
  control: boolean;
  snapshot: boolean;
  colorScheme: "light" | "dark";
  // Candidate amendments of AD-8 (csp.ts, VARIANTS), applied to both policies.
  variants: string[];
  script: string;
  // Added to the file names of a load, so two modes of one fixture keep separate records.
  suffix?: string;
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
    repeatOnly: list("--repeat-only", ""),
    control: argv.includes("--control"),
    snapshot: argv.includes("--snapshot"),
    colorScheme: value("--color-scheme", "light") as "light" | "dark",
    variants: list("--variants", ""),
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

// Requests other than the stand-in's own board page and view document. `blob:` URLs are the
// view's own diagram images, made in memory.
const foreign = (requests: Recorded["requests"], base: string) =>
  requests.filter(
    (r) =>
      !r.url.startsWith(`${base}/b/`) &&
      !r.url.startsWith(`${base}/v/`) &&
      !r.url.startsWith("file:") &&
      !r.url.startsWith("about:") &&
      !r.url.startsWith("data:") &&
      !r.url.startsWith("blob:"),
  );

type Load = {
  engine: string;
  fixture: string;
  renderer: string;
  repeat: number;
  mode: "board" | "control" | "snapshot";
  visible: boolean;
  timeToVisibleMs: number | null;
  // From the renderer's mount to visible: the renderer's own work, without parsing the chunks.
  mountToVisibleMs: number | null;
  probe: Snapshot;
  check: Record<string, unknown> | null;
  dump: Record<string, unknown> | null;
} & Recorded & { verdict: string; reasons: string[]; signals?: unknown };

const loadUrl = (base: string, fixture: string, renderer: string, options: Options): string => {
  const query = new URLSearchParams({ renderer });
  if (options.control) query.set("control", "1");
  if (options.variants.length > 0) query.set("variants", options.variants.join(","));
  return `${base}/b/${fixture}?${query}`;
};

const snapshotFile = async (base: string, fixture: string, renderer: string, options: Options) => {
  const query = new URLSearchParams({ renderer });
  if (options.variants.length > 0) query.set("variants", options.variants.join(","));
  const html = await (await fetch(`${base}/s/${fixture}?${query}`)).text();
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

// The latest render of each diagram item shows as a loaded `blob:` image, and its hit map holds
// the anchors the fixture expects.
const diagramReasons = (events: ProbeEvent[], fixture: Fixture): string[] => {
  const reasons: string[] = [];
  const last = (kind: string, id: string) => events.filter((e) => e.kind === kind && e.id === id).at(-1);
  for (const id of fixture.expectDiagrams ?? []) {
    const image = last("diagram-image", id);
    const error = last("diagram-error", id);
    if (error && (!image || Number(error.generation) > Number(image.generation))) {
      reasons.push(`diagram ${id}: render error: ${String(error.message).slice(0, 200)}`);
    } else if (!image) reasons.push(`diagram ${id}: no image`);
    else if (image.loaded !== true) reasons.push(`diagram ${id}: the ${image.scheme} image did not load`);
    else if (image.scheme !== "blob:") reasons.push(`diagram ${id}: image scheme ${image.scheme}`);
  }
  for (const id of fixture.expectDiagramErrors ?? []) {
    if (!last("diagram-error", id)) reasons.push(`diagram ${id}: rendered, expected an error`);
    if (last("diagram-image", id)) reasons.push(`diagram ${id}: an image shows`);
  }
  for (const [id, keys] of Object.entries(fixture.expectAnchors ?? {})) {
    const render = last("diagram-render", id);
    const found = new Set(((render?.anchors ?? []) as { key: string }[]).map((a) => a.key));
    const missing = keys.filter((key) => !found.has(key));
    if (missing.length) reasons.push(`diagram ${id}: no anchor for ${missing.join(", ")}`);
  }
  return reasons;
};

// Criterion 5: what a renderer's SVG carries besides the drawing. Embedded images, and text that
// advertises, asks for money or support, or names PlantUML's sites.
const SPONSOR = /sponsor|advert|patreon|liberapay|paypal|professional|donat|plantuml\.com|plantuml@|upgrad|qrcode/gi;
const contentOf = (svg: string) => ({
  svgBytes: svg.length,
  embeddedImages: (svg.match(/<image\b/g) ?? []).length,
  dataImages: (svg.match(/data:image\//g) ?? []).length,
  sponsorText: [...new Set((svg.replace(/<\?plantuml-src[^?]*\?>/g, "").match(SPONSOR) ?? []).map((m) => m.toLowerCase()))],
  firstLines: [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].slice(0, 3).map((m) => m[1]),
});

// The diagram events of a load, without the SVG text and with the anchors counted.
const diagramsOf = (events: ProbeEvent[]) =>
  events
    .filter((e) => e.kind.startsWith("diagram-"))
    .map(({ svg, anchors, ...rest }) => ({
      ...rest,
      ...(Array.isArray(anchors) ? { anchors: anchors.length } : {}),
      ...(typeof svg === "string" ? contentOf(svg) : {}),
    }));

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
  reasons.push(...diagramReasons(events, fixture));
  // The ready rule (AD-9): nothing moves once the question counts as visible.
  const visible = events.find((e) => e.kind === "visible");
  const after = events.find((e) => e.kind === "boxes" && e.generation === visible?.generation);
  if (visible && after && JSON.stringify(visible.boxes) !== JSON.stringify(after.boxes)) {
    reasons.push("boxes moved after visible");
  }
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
    const stem = `${name}.${renderer}${options.suffix ?? ""}${repeat > 1 || options.repeat > 1 ? `.${repeat}` : ""}`;
    session.setPhase("screenshot");
    await session.page.screenshot({ path: join(dir, `${stem}.png`), caret: "initial" });
    // Each diagram whole, for the product owner (tasks 3.5 and 3.6); not in repeated loads.
    if (repeat === 1 && options.repeat === 1) {
      for (const id of fixture.expectDiagrams ?? []) {
        // The image with its overlay; the figure itself spans the column.
        const figure = viewLocator(session, `[data-item-id=${id}] figure > div`);
        if ((await figure.count()) === 0) continue;
        await figure
          .screenshot({ path: join(dir, `${stem}.${id}.png`), caret: "initial" })
          .catch((error) => console.log(`${engine} ${stem}: no screenshot of ${id}: ${String(error).split("\n")[0]}`));
      }
    }
    const ok = visible?.kind === "visible";
    const load = {
      engine,
      fixture: name,
      renderer,
      repeat,
      mode: (options.snapshot ? "snapshot" : options.control ? "control" : "board") as Load["mode"],
      visible: ok,
      timeToVisibleMs: ok && probe.t0 !== null ? Math.round((visible.t - probe.t0) * 10) / 10 : null,
      mountToVisibleMs: (() => {
        const mount = probe.events.find((e) => e.kind === "mount");
        return ok && mount ? Math.round((visible.t - mount.t) * 10) / 10 : null;
      })(),
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

// IDs from React's useId (19.3 writes `_r_2_`) differ between mounts; the rest must match.
export const normalize = (html: string): string =>
  html.replace(/«r[0-9a-z]+»|_r_[0-9a-z]+_|:r[0-9a-z]+:/g, "«id»");

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
    const { repeat, repeatOnly } = ctx.options;
    const times = repeatOnly.length > 0 && !repeatOnly.includes(name) ? 1 : repeat;
    for (const renderer of ctx.options.renderers) {
      for (let n = 1; n <= times; n += 1) {
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
    diagrams: diagramsOf(probe.events),
    consoleErrors: c.filter((m) => (m.type === "error" || m.type === "warning") && m.phase === "load"),
    foreignRequests: foreign(requests, ctx.base),
  }));
};

// Task 2.1: the same fixture through each renderer gives the same DOM as the first renderer.
const runCompare = async (browser: Browser, engine: string, ctx: Context) => {
  const results = [];
  const [first, ...others] = ctx.options.renderers as [string, ...string[]];
  for (const name of ctx.options.fixtures) {
    const fixture = ctx.fixtures.get(name) as Fixture;
    const base = await loadOnce(browser, ctx.base, engine, name, fixture, first, 1, ctx.options);
    const a = String(base.dump?.html ?? "");
    for (const renderer of others) {
      const other = await loadOnce(browser, ctx.base, engine, name, fixture, renderer, 1, ctx.options);
      const b = String(other.dump?.html ?? "");
      const result = {
        fixture: name,
        renderers: [first, renderer],
        verdicts: [base.verdict, other.verdict],
        rawEqual: a === b,
        normalizedEqual: normalize(a) === normalize(b),
        difference: firstDifference(normalize(a), normalize(b)),
        bytes: [a.length, b.length],
      };
      console.log(
        `${engine.padEnd(8)} ${name.padEnd(12)} ${first} vs ${renderer}: same DOM ${result.rawEqual} ` +
          `(${a.length} chars) ${result.difference ?? ""}`,
      );
      results.push(result);
    }
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
    let external = "";
    const editLoad = await loadOnce(browser, ctx.base, engine, "atoms", atoms, renderer, 3, ctx.options, async (s) => {
      await applyEdits(s, atoms);
      edited = await command(s, "dump");
      await command(s, "remount");
      generation2 = (await waitFor(s, (e) => e.kind === "visible" && e.generation === 2)) !== null;
      await sleep(300);
      remounted = await command(s, "dump");
      await command(s, "setDraft", { id: "tf1", value: "Set by the board page" });
      await sleep(300);
      external = await viewLocator(s, "#tf1-input").inputValue();
    });
    const e = edited as Record<string, unknown> | null;
    const r = remounted as Record<string, unknown> | null;
    // Radix bookkeeping that a remount resets and that is not an edit, reported apart: roving
    // focus keeps the last-focused radio as the tab stop (tabindex 0), and Presence sets
    // `animation-duration: 0s` through the CSSOM on a panel's first mount.
    const withoutTabStops = (html: string) =>
      normalize(html)
        .replace(/<[^>]*data-radix-collection-item[^>]*>/g, (tag) =>
          tag.replace(/ tabindex="(0|-1)"/, ""),
        )
        .replace(/ style="(animation-duration: 0s;)?"/g, "");
    const sameValues =
      generation2 &&
      e !== null &&
      r !== null &&
      JSON.stringify(e.values) === JSON.stringify(r.values) &&
      JSON.stringify(e.draft) === JSON.stringify(r.draft);
    const strictDom = normalize(String(e?.html)) === normalize(String(r?.html));
    const domWithoutTabStops = withoutTabStops(String(e?.html)) === withoutTabStops(String(r?.html));
    const noEditState = sameValues && domWithoutTabStops;

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
    const dir = join(PROBE, "runs", ctx.options.run, engine);
    await Bun.write(join(dir, `c2.${renderer}.edited.html`), String(e?.html ?? ""));
    await Bun.write(join(dir, `c2.${renderer}.remounted.html`), String(r?.html ?? ""));
    const remountDifference = {
      html: firstDifference(withoutTabStops(String(e?.html ?? "")), withoutTabStops(String(r?.html ?? ""))),
      values: JSON.stringify(e?.values) === JSON.stringify(r?.values) ? null : [e?.values, r?.values],
      draft: JSON.stringify(e?.draft) === JSON.stringify(r?.draft) ? null : [e?.draft, r?.draft],
    };
    const result = {
      renderer,
      determinism,
      noEditState,
      strictDom,
      remountDifference,
      editedDraft: e?.draft ?? null,
      // The draft record written from outside shows in the field: the renderer holds no copy.
      readsDraftRecord: external === "Set by the board page",
      noNetwork: network,
      readyAfterAsync: ready.settledBeforeReady && ready.boxesStable,
      ready,
      negativeControl: control,
      verdicts: all.map((l) => l.verdict),
    };
    console.log(
      `${engine.padEnd(8)} ${renderer.padEnd(11)} determinism ${determinism}  no edit state ${noEditState} (strict DOM ${strictDom})  ` +
        `no network ${network}  ready after async ${result.readyAfterAsync} (${ready.readyAfterMs} ms)  ` +
        `control boxes stable ${control.boxesStable}  reads draft record ${result.readsDraftRecord}`,
    );
    results.push(result);
  }
  return results;
};

// Task 3.5: a diagram's final SVG measured in a page with no CSP, in the same engine, where its
// own `<style>` applies as it does inside the image, drawn at one pixel per user unit. A label overflows when its text extends past
// its box: a node's shape, an edge label's background, a participant's or a note's rectangle, or
// for a message the span between its two lifelines.
const overflowIn = (page: Page, svg: string) =>
  page.evaluate((markup) => {
    document.body.innerHTML = markup;
    const root = document.querySelector("svg") as SVGSVGElement;
    // One pixel per user unit in every engine: Mermaid's root says `width="100%"`.
    const view = root.viewBox.baseVal;
    root.style.maxWidth = "none";
    root.setAttribute("width", String(view.width));
    root.setAttribute("height", String(view.height));
    const box = (element: Element) => element.getBoundingClientRect();
    const round = (n: number) => Math.round(n * 10) / 10;
    const labels: { kind: string; label: string; text: number[]; box: number[]; overflow: number }[] = [];
    const push = (kind: string, text: Element, shape: Element) => {
      const t = box(text);
      const b = box(shape);
      const overflow = Math.max(0, b.left - t.left, t.right - b.right, b.top - t.top, t.bottom - b.bottom);
      labels.push({
        kind,
        label: (text.textContent ?? "").trim().slice(0, 60),
        text: [round(t.width), round(t.height)],
        box: [round(b.width), round(b.height)],
        overflow: round(overflow),
      });
    };
    for (const node of root.querySelectorAll("g.node")) {
      const text = node.querySelector("text");
      const shape = node.querySelector(".label-container, polygon, circle, rect");
      if (text?.textContent?.trim() && shape) push("node", text, shape);
    }
    for (const edge of root.querySelectorAll("g.edgeLabel")) {
      const text = edge.querySelector("text");
      const background = edge.querySelector("rect");
      if (text?.textContent?.trim() && background) push("edge label", text, background);
    }
    for (const kind of ["participant", "note"]) {
      for (const group of root.querySelectorAll(`[data-et=${kind}]`)) {
        const text = group.querySelector("text");
        const shape = group.querySelector("rect");
        if (text && shape) push(kind, text, shape);
      }
    }
    const texts = [...root.querySelectorAll("text.messageText")];
    [...root.querySelectorAll("[data-et=message]")].forEach((line, index) => {
      const text = texts[index];
      const span = box(line).width;
      if (!text || span < 1) return;
      const width = box(text).width;
      labels.push({
        kind: "message",
        label: (text.textContent ?? "").trim().slice(0, 60),
        text: [round(width)],
        box: [round(span)],
        overflow: round(Math.max(0, width - span)),
      });
    });
    return labels;
  }, svg);

const lastRender = (events: ProbeEvent[], id: string) =>
  events.filter((e) => e.kind === "diagram-render" && e.id === id).at(-1);

type BoardItem = { id: string; props?: Record<string, unknown>; children?: BoardItem[] };
const findItem = (items: BoardItem[], id: string): BoardItem | undefined => {
  for (const item of items) {
    const found = item.id === id ? item : findItem(item.children ?? [], id);
    if (found) return found;
  }
  return undefined;
};

// The measurement mitigation of a Mermaid item (`props.measure`, or the style shim).
const measureOf = (fixture: Fixture, id: string): string => {
  const props = findItem(fixture.board.items as BoardItem[], id)?.props ?? {};
  if ((props.probe as { shim?: boolean } | undefined)?.shim) return "shim";
  return typeof props.measure === "string" ? props.measure : "none";
};

const runMeasure = async (browser: Browser, engine: string, ctx: Context) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];
  try {
    for (const name of ctx.options.fixtures) {
      const fixture = ctx.fixtures.get(name) as Fixture;
      for (const mode of ["board", "control"] as const) {
        const options = { ...ctx.options, control: mode === "control", suffix: mode === "control" ? ".control" : "" };
        const load = await loadOnce(browser, ctx.base, engine, name, fixture, "own", 1, options);
        for (const id of fixture.expectDiagrams ?? []) {
          const render = lastRender(load.probe.events, id);
          const item = measureOf(fixture, id);
          const labels = typeof render?.svg === "string" ? await overflowIn(page, render.svg) : [];
          const overflowing = labels.filter((l) => l.overflow > 0.5);
          const worst = Math.max(0, ...labels.map((l) => l.overflow));
          results.push({
            fixture: name,
            mode,
            id,
            measure: item,
            verdict: load.verdict,
            violations: violationsOf(load.probe).length,
            labels: labels.length,
            overflowing: overflowing.length,
            worst,
            details: overflowing,
          });
          console.log(
            `${engine.padEnd(8)} ${name.padEnd(18)} ${mode.padEnd(7)} ${id} ${item.padEnd(10)} labels ${labels.length} overflowing ${overflowing.length} worst ${worst} px  (${load.verdict}, ${violationsOf(load.probe).length} violations)`,
          );
        }
      }
    }
  } finally {
    await context.close();
  }
  return results;
};

// Task 3.7: cold loads of the golden board. Per load: the times from t0 to the renderer's mount,
// to the PlantUML render's start and end, to the image loaded, to the diagram item's ready and to
// the question visible; then the golden flow's source edit, written to the draft record, and the
// time from that render's start to its image.
type GoldenRow = { fixture: string; n: number; [metric: string]: unknown };

const runGolden = async (browser: Browser, engine: string, ctx: Context) => {
  const rows: GoldenRow[] = [];
  for (const name of ctx.options.fixtures) {
    const fixture = ctx.fixtures.get(name) as Fixture;
    const id = fixture.rerender?.item ?? fixture.expectDiagrams?.[0] ?? "";
    for (let n = 1; n <= ctx.options.repeat; n += 1) {
      const load = await loadOnce(browser, ctx.base, engine, name, fixture, "own", n, ctx.options, async (s) => {
        if (!fixture.rerender) return;
        await command(s, "setDraft", { id, value: fixture.rerender.source });
        await waitFor(s, (e) => e.kind.startsWith("diagram-") && e.id === id && e.generation === 2, 15_000);
        await sleep(200);
      });
      const events = load.probe.events;
      const t0 = load.probe.t0 ?? 0;
      const at = (e: ProbeEvent | undefined) => (e ? Math.round((e.t - t0) * 10) / 10 : null);
      const find = (kind: string, generation?: number) =>
        events.find((e) => e.kind === kind && (e.id === undefined || e.id === id) && (generation === undefined || e.generation === generation));
      const render1 = find("diagram-render", 1);
      const render2 = find("diagram-render", 2);
      const image2 = find("diagram-image", 2);
      const labelY = (render: ProbeEvent | undefined, key: string) =>
        ((render?.anchors ?? []) as { key: string; box: { y: number } }[]).find((a) => a.key === key)?.box.y ?? null;
      const row = {
        fixture: name,
        n,
        verdict: load.verdict,
        reasons: load.reasons,
        mount: at(find("mount")),
        renderStart: render1 ? Math.round((Number(render1.t0) - t0) * 10) / 10 : null,
        renderEnd: at(render1),
        renderMs: render1?.renderMs ?? null,
        imageLoaded: at(find("diagram-image", 1)),
        diagramReady: at(events.find((e) => e.kind === "ready" && e.id === id)),
        visible: load.timeToVisibleMs,
        rerenderMs: render2 && image2 ? Math.round((image2.t - Number(render2.t0)) * 10) / 10 : null,
        rerenderRenderMs: render2?.renderMs ?? null,
        // The pin's element after the source edit: by label it re-attaches to the moved message.
        createOrderY: [labelY(render1, "message:label:create order#1"), labelY(render2, "message:label:create order#1")],
      };
      console.log(
        `${engine.padEnd(8)} ${name.padEnd(14)} ${String(n).padStart(2)} ${load.verdict.padEnd(5)} mount ${row.mount} render ${row.renderStart}->${row.renderEnd} (${row.renderMs}) image ${row.imageLoaded} ready ${row.diagramReady} visible ${row.visible} rerender ${row.rerenderMs} create order y ${row.createOrderY.join("->")}`,
      );
      rows.push(row);
    }
  }
  const stats = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => typeof v === "number");
    return present.length ? { n: present.length, median: median(present), max: Math.max(...present) } : null;
  };
  const metrics = ["mount", "renderStart", "renderEnd", "renderMs", "imageLoaded", "diagramReady", "visible", "rerenderMs", "rerenderRenderMs"] as const;
  const byFixture = Object.fromEntries(
    ctx.options.fixtures.map((name) => {
      const mine = rows.filter((r) => r.fixture === name);
      return [name, Object.fromEntries(metrics.map((m) => [m, stats(mine.map((r) => r[m] as number | null))]))];
    }),
  );
  return { rows, stats: byFixture };
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
        const runner = { loads: runLoads, compare: runCompare, c2: runC2, measure: runMeasure, golden: runGolden }[
          options.script
        ];
        if (!runner) throw new Error(`unknown script ${options.script}`);
        const results = await runner(browser, engine, ctx);
        (summary.engines as Record<string, unknown>)[engine] = { version: browser.version(), results };
      } finally {
        await browser.close();
      }
    }
    if (options.script === "loads") summary.timing = timing(summary.engines as Record<string, { results?: Timed[] }>);
    await mkdir(join(PROBE, "runs", options.run), { recursive: true });
    await Bun.write(join(PROBE, "runs", options.run, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    board.stop();
  }
};

type Timed = { fixture: string; renderer: string; timeToVisibleMs: number | null; mountToVisibleMs: number | null };

// Median and maximum time to visible (from t0, and from the renderer's mount) per engine,
// fixture and renderer.
const timing = (engines: Record<string, { results?: Timed[] }>) =>
  Object.fromEntries(
    Object.entries(engines).map(([engine, { results = [] }]) => {
      const groups = new Map<string, Timed[]>();
      for (const r of results) {
        if (r.timeToVisibleMs === null) continue;
        const key = `${r.fixture}.${r.renderer}`;
        groups.set(key, [...(groups.get(key) ?? []), r]);
      }
      const stats = (values: number[]) => ({ median: median(values), max: Math.max(...values) });
      return [
        engine,
        Object.fromEntries(
          [...groups].map(([key, rows]) => [
            key,
            {
              n: rows.length,
              fromT0: stats(rows.map((r) => r.timeToVisibleMs as number)),
              fromMount: stats(rows.map((r) => r.mountToVisibleMs as number)),
            },
          ]),
        ),
      ];
    }),
  );

if (import.meta.main) await main();
