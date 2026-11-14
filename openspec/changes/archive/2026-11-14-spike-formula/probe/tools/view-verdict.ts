// A load's verdict (design decision 4's rule) and a run's summary. Pass: the view did what
// the mode asks, with zero CSP violations, zero requests other than the stand-in's own, nothing
// reaching the server, and no error. A negative control holds when the named failure shows
// and nothing reaches the server.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LoadSpec } from "./view-presets.ts";

const PROBE = join(import.meta.dir, "..");
const CSP_LINE = /content.security.policy|refused to|wasm-unsafe-eval|unsafe-eval|\bcsp\b/i;

type Event = Record<string, unknown>;
export type Load = {
  engine: string;
  label: string;
  spec: LoadSpec;
  repeat: number;
  verdict: "pass" | "fail" | "control-holds" | "control-broken";
  reasons: string[];
  result: Event | null;
  hash: string | null;
  bunHash: string | null;
  timings: Record<string, number | null>;
  violations: Event[];
  cspConsole: string[];
  console: { type: string; text: string }[];
  requests: { url: string; method: string; failure?: string }[];
  foreignRequests: { url: string; method: string; failure?: string }[];
  leaks: { method: string; path: string }[];
  errors: Event[];
  pageErrors: string[];
  wallMs: number;
  doc: { bytes: number; gzip: number } | null;
  boardFavicon: number;
  viewEnv: Record<string, unknown> | null;
  line: string;
};

const bunHashes = new Map<string, string | null>();
function bunHash(run: string, engine: string): string | null {
  const key = `${run}/${engine}`;
  if (!bunHashes.has(key)) {
    const file = join(PROBE, "runs", run, `${engine}.json`);
    const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    bunHashes.set(key, data?.suite?.hash ?? null);
  }
  return bunHashes.get(key) ?? null;
}

const round = (x: number | null): number | null => (x === null ? null : Math.round(x * 10) / 10);

type Input = {
  engine: string;
  spec: LoadSpec;
  repeat: number;
  probe: { events: Event[]; board: Event[]; t0: number | null };
  recorded: { console: { type: string; text: string }[]; requests: { url: string; method: string; failure?: string }[]; pageErrors: string[] };
  leaks: { method: string; path: string }[];
  base: string;
  snapshotFile: string | null;
  wallMs: number;
  bunRun: string;
  doc?: { bytes: number; gzip: number };
};

export function judge(input: Input): Load {
  const { spec, probe, recorded } = input;
  const events = probe.events;
  const at = (kind: string): number | null => {
    const e = events.find((x) => x.kind === kind);
    return e && probe.t0 !== null ? round((e.t as number) - probe.t0) : null;
  };
  // Firefox's own favicon request for the board page, refused by the board page's policy: the
  // browser's, not the view's (the renderer spike saw the same). Kept apart, not counted.
  const isFavicon = (e: Event) => e.directive === "img-src" && String(e.blockedURI).endsWith("/favicon.ico");
  const boardFavicon = probe.board.filter(isFavicon).length;
  const violations = [
    ...events.filter((e) => e.kind === "violation").map((e) => ({ ...e, on: "view" })),
    ...probe.board.filter((e) => !isFavicon(e)).map((e) => ({ ...e, on: "board" })),
  ];
  const cspConsole = recorded.console.map((c) => c.text).filter((t) => CSP_LINE.test(t) && !/favicon\.ico/.test(t));
  const own = (url: string) =>
    url.startsWith(`${input.base}/b?`) || url.startsWith(`${input.base}/v?`) || url === `${input.base}/favicon.ico` ||
    (input.snapshotFile !== null && url === `file://${input.snapshotFile}`) || /^(about|data|blob):/.test(url);
  const foreignRequests = recorded.requests.filter((r) => !own(r.url));
  const errors = events.filter((e) => e.kind === "error" || e.kind === "rejection" || e.kind === "failed");
  const result = events.find((e) => e.kind === "result") ?? null;
  const hash = typeof result?.hash === "string" ? result.hash : null;
  const expectedHash = spec.mode === "suite" ? bunHash(input.bunRun, spec.doc) : null;
  const reasons: string[] = [];
  let verdict: Load["verdict"];
  if (spec.csp === false) {
    // The recorders' control holds when the request shows in both recorders.
    if (input.leaks.length === 0) reasons.push("no request reached the server");
    if (!recorded.requests.some((r) => r.url.endsWith("/wasm_bg.wasm"))) reasons.push("the browser recorded no request");
    verdict = reasons.length === 0 ? "control-holds" : "control-broken";
  } else if (spec.expectFailure) {
    const compiled = result !== null && (result.pass === true || result.loaded === true);
    if (compiled) reasons.push("the engine started");
    if (input.leaks.length > 0) reasons.push(`${input.leaks.length} request(s) reached the server`);
    if (!events.some((e) => e.kind === "chunk-running")) reasons.push("the chunk never ran");
    verdict = reasons.length === 0 ? "control-holds" : "control-broken";
  } else {
    if (!result) reasons.push("no result");
    else if (spec.mode === "smoke" && result.pass !== true) reasons.push(`smoke value ${JSON.stringify(result.value)}`);
    else if ((spec.mode === "suite" || spec.mode === "timing") && result.failed !== 0) reasons.push(`${result.failed} fixture checks failed${hash && hash === expectedHash ? " (the same as in Bun: equal hash)" : ""}`);
    else if (result.unsupported) reasons.push(`mode ${spec.mode} unsupported by this chunk`);
    if (spec.mode === "suite" && hash && expectedHash && hash !== expectedHash) reasons.push("hash differs from Bun's");
    if (violations.length) reasons.push(`${violations.length} violation(s)`);
    if (foreignRequests.length) reasons.push(`${foreignRequests.length} request(s)`);
    if (input.leaks.length) reasons.push(`${input.leaks.length} reached the server`);
    if (errors.length) reasons.push(`${errors.length} error event(s)`);
    if (recorded.pageErrors.length) reasons.push(`${recorded.pageErrors.length} page error(s)`);
    verdict = reasons.length === 0 ? "pass" : "fail";
  }
  const env = events.find((e) => e.kind === "done") ?? null;
  const viewEnv = env ? { timeZone: env.timeZone, locale: env.locale, language: env.language, offsetMinutes: env.offsetMinutes, clockStepMs: env.clockStepMs } : null;
  const timings = { chunkRunning: at("chunk-running"), decoded: at("decoded"), compiled: at("compiled"), engineReady: at("engine-ready"), evaluated: at("evaluated"), done: at("done") };
  const hashNote = spec.mode === "suite" ? ` hash ${hash?.slice(0, 12) ?? "-"}${expectedHash ? (hash === expectedHash ? " =bun" : " !=bun") : " (no bun hash)"}` : "";
  const what = result ? JSON.stringify(Object.fromEntries(Object.entries(result).filter(([k]) => ["value", "passed", "failed", "loaded", "message", "editMedianMs", "editP95Ms", "loadMs", "fullRecalcMs", "batchMeanMs"].includes(k)))) : errors.map((e) => e.message).join(" | ").slice(0, 200);
  const line = `${input.engine.padEnd(8)} ${spec.label.padEnd(32)} #${input.repeat} ${verdict.padEnd(14)} ${what}${hashNote} viol ${violations.length} req ${foreignRequests.length} leaks ${input.leaks.length} t ${JSON.stringify(timings)}${reasons.length ? ` (${reasons.join("; ")})` : ""}`;
  return {
    engine: input.engine,
    label: spec.label,
    spec,
    repeat: input.repeat,
    verdict,
    reasons,
    result,
    hash,
    bunHash: expectedHash,
    timings,
    violations,
    cspConsole,
    console: recorded.console,
    requests: recorded.requests,
    foreignRequests,
    leaks: input.leaks,
    errors,
    pageErrors: recorded.pageErrors,
    wallMs: input.wallMs,
    doc: input.doc ?? null,
    boardFavicon,
    viewEnv,
    line,
  };
}

const stats = (values: (number | null | undefined)[]) => {
  const xs = values.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? (xs[mid] as number) : ((xs[mid - 1] as number) + (xs[mid] as number)) / 2;
  return { n: xs.length, median: round(median), min: round(xs[0] as number), max: round(xs[xs.length - 1] as number) };
};

export function summarise(loads: Load[], meta: Record<string, unknown>) {
  const counts: Record<string, number> = {};
  for (const l of loads) counts[l.verdict] = (counts[l.verdict] ?? 0) + 1;
  const groups = new Map<string, Load[]>();
  for (const l of loads) groups.set(`${l.engine} | ${l.label}`, [...(groups.get(`${l.engine} | ${l.label}`) ?? []), l]);
  const rows = [...groups.entries()].map(([key, ls]) => ({
    key,
    loads: ls.length,
    verdicts: [...new Set(ls.map((l) => l.verdict))],
    reasons: [...new Set(ls.flatMap((l) => l.reasons))],
    hashes: [...new Set(ls.map((l) => l.hash).filter(Boolean))],
    bunHash: ls[0]?.bunHash ?? null,
    passed: ls[0]?.result?.passed ?? null,
    failed: ls[0]?.result?.failed ?? null,
    violations: ls.reduce((n, l) => n + l.violations.length, 0),
    violationSamples: ls.flatMap((l) => l.violations).slice(0, 3).map((v) => ({ on: v.on, directive: v.directive, blockedURI: v.blockedURI, policy: v.policy })),
    boardFavicon: ls.reduce((n, l) => n + l.boardFavicon, 0),
    viewEnv: ls[0]?.viewEnv ?? null,
    cspConsole: [...new Set(ls.flatMap((l) => l.cspConsole))].slice(0, 4),
    errors: [...new Set(ls.flatMap((l) => [...l.errors.map((e) => String(e.message)), ...l.pageErrors]))].slice(0, 4),
    requests: ls.reduce((n, l) => n + l.foreignRequests.length, 0),
    requestSamples: ls.flatMap((l) => l.foreignRequests).slice(0, 3),
    leaks: ls.reduce((n, l) => n + l.leaks.length, 0),
    doc: ls[0]?.doc ?? null,
    timings: {
      chunkRunning: stats(ls.map((l) => l.timings.chunkRunning)),
      decoded: stats(ls.map((l) => l.timings.decoded)),
      compiled: stats(ls.map((l) => l.timings.compiled)),
      engineReady: stats(ls.map((l) => l.timings.engineReady)),
      evaluated: stats(ls.map((l) => l.timings.evaluated)),
    },
    latency: ls[0]?.spec.mode === "latency" ? {
      loadMs: stats(ls.map((l) => l.result?.loadMs as number)),
      fullRecalcMs: stats(ls.map((l) => l.result?.fullRecalcMs as number)),
      editMedianMs: stats(ls.map((l) => l.result?.editMedianMs as number)),
      editP95Ms: stats(ls.map((l) => l.result?.editP95Ms as number)),
      batchMeanMs: stats(ls.map((l) => l.result?.batchMeanMs as number)),
      nodes: ls[0]?.result?.nodes ?? null,
    } : undefined,
    suiteMs: ls[0]?.spec.mode === "suite" ? stats(ls.map((l) => l.result?.ms as number)) : undefined,
  }));
  return { ...meta, date: new Date().toISOString(), counts, rows };
}
