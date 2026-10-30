// Background-tab probe (criterion 13, design decision 10).
//
//   bun tab.ts serve [--run NAME] [--engine LABEL] [--port N] [--drop-every SECONDS]
//     Serves a board stand-in on 127.0.0.1 and logs every page and WebSocket event as JSONL
//     to runs/<run>/<engine>.jsonl. Prints one JSON line with the board URL and the log path.
//     --drop-every closes every open WebSocket from the server side at that interval, to time
//     the board's reconnect.
//   bun tab.ts report FILE.jsonl [...]
//     Summarises a log: disconnects, heartbeat gaps, visibility, lifecycle events.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ServerWebSocket } from "bun";

const HEARTBEAT_MS = 5000;
const RECONNECT_MS = 1000;
const BUCKET_MIN = 5;

type Entry = { ms: number; at: string; ev: string; [k: string]: unknown };

function arg(argv: string[], name: string, fallback: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

// The page under test: a WebSocket back to the server, a 5 s heartbeat, lifecycle listeners.
const BOARD_HTML = `<!doctype html><meta charset="utf-8"><title>Board stand-in</title>
<h1>Board stand-in</h1><pre id="out"></pre><script>
const load = Math.random().toString(36).slice(2, 10);
const loads = Number(sessionStorage.getItem("loads") || 0) + 1;
sessionStorage.setItem("loads", String(loads));
const queue = []; let ws, attempt = 0, seq = 0, lastClose = null;
function send(ev, extra) {
  const msg = JSON.stringify({ ev, seq: seq++, load, pnow: Math.round(performance.now()),
    vis: document.visibilityState, focus: document.hasFocus(), ...extra });
  if (ws && ws.readyState === 1) ws.send(msg); else queue.push(msg);
  document.getElementById("out").textContent = ev + " " + new Date().toISOString();
}
function connect() {
  attempt++;
  ws = new WebSocket("ws://" + location.host + "/ws?load=" + load);
  ws.onopen = () => {
    send("hello", { attempt, loads, wasDiscarded: "wasDiscarded" in document ? document.wasDiscarded : null,
      ua: navigator.userAgent, lastClose });
    while (queue.length) ws.send(queue.shift());
  };
  ws.onclose = (e) => {
    lastClose = { code: e.code, reason: e.reason, clean: e.wasClean, pnow: Math.round(performance.now()) };
    setTimeout(connect, ${RECONNECT_MS});
  };
}
connect();
setInterval(() => send("hb"), ${HEARTBEAT_MS});
document.addEventListener("visibilitychange", () => send("visibilitychange"));
document.addEventListener("freeze", () => send("freeze"));
document.addEventListener("resume", () => send("resume"));
addEventListener("pagehide", (e) => send("pagehide", { persisted: e.persisted }));
addEventListener("pageshow", (e) => send("pageshow", { persisted: e.persisted }));
</script>`;

const BLANK_HTML = `<!doctype html><meta charset="utf-8"><title>Front tab</title><p>Front tab.</p>`;

function serve(argv: string[]): void {
  const run = arg(argv, "run", `manual-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const engine = arg(argv, "engine", "browser");
  const logPath = join(import.meta.dir, "runs", run, `${engine}.jsonl`);
  mkdirSync(dirname(logPath), { recursive: true });
  const log = (ev: string, data: Record<string, unknown> = {}) => {
    const now = Date.now();
    appendFileSync(logPath, `${JSON.stringify({ ms: now, at: new Date(now).toISOString(), ev, ...data })}\n`);
  };
  let nextConn = 0;
  const sockets = new Set<ServerWebSocket<{ conn: number; load: string }>>();
  const dropEvery = Number(arg(argv, "drop-every", "0"));
  if (dropEvery > 0) {
    setInterval(() => {
      for (const ws of sockets) {
        log("server-drop", { ...ws.data });
        ws.close(4000, "probe drop");
      }
    }, dropEvery * 1000);
  }
  const server = Bun.serve<{ conn: number; load: string }>({
    hostname: "127.0.0.1",
    port: Number(arg(argv, "port", "0")),
    async fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const data = { conn: ++nextConn, load: url.searchParams.get("load") ?? "" };
        return srv.upgrade(req, { data }) ? undefined : new Response("upgrade failed", { status: 400 });
      }
      if (url.pathname === "/note" && req.method === "POST") {
        log("note", (await req.json()) as Record<string, unknown>);
        return new Response("ok");
      }
      if (url.pathname === "/board") {
        log("http-board", { ua: req.headers.get("user-agent") });
        return new Response(BOARD_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (url.pathname === "/blank") return new Response(BLANK_HTML, { headers: { "content-type": "text/html" } });
      return new Response("not found", { status: 404 });
    },
    websocket: {
      open: (ws) => {
        sockets.add(ws);
        log("ws-open", { ...ws.data });
      },
      message: (ws, msg) => {
        let page: Record<string, unknown>;
        try {
          page = JSON.parse(String(msg)) as Record<string, unknown>;
        } catch {
          page = { ev: "bad-message", raw: String(msg).slice(0, 200) };
        }
        const { ev, ...rest } = page;
        log(`page-${String(ev)}`, { conn: ws.data.conn, ...rest });
      },
      close: (ws, code, reason) => {
        sockets.delete(ws);
        log("ws-close", { ...ws.data, code, reason });
      },
    },
  });
  const base = `http://127.0.0.1:${server.port}`;
  log("server-start", { run, engine, board: `${base}/board`, pid: process.pid });
  console.log(JSON.stringify({ board: `${base}/board`, blank: `${base}/blank`, log: logPath }));
  const stop = () => {
    log("server-stop");
    server.stop(true);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

export function summarise(file: string) {
  const entries = readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Entry);
  const t0 = entries[0]?.ms ?? 0;
  const min = (ms: number) => Math.round(((ms - t0) / 60000) * 10) / 10;
  const notes = entries.filter((e) => e.ev === "note");
  // The driver notes when the front tab opened; a manual run falls back to the first hidden event.
  const hiddenAt =
    notes.find((e) => e.step === "front-tab-opened")?.ms ??
    entries.find((e) => e.ev === "page-visibilitychange" && e.vis === "hidden")?.ms;
  const beats = entries.filter((e) => e.ev === "page-hb");
  const gaps = beats.slice(1).map((b, i) => ({ at: b.ms, gapS: (b.ms - beats[i].ms) / 1000 }));
  const longest = gaps.reduce((a, g) => (g.gapS > a.gapS ? g : a), { at: t0, gapS: 0 });
  const buckets: Record<string, number> = {};
  for (const g of gaps) {
    const key = `${Math.floor((g.at - t0) / 60000 / BUCKET_MIN) * BUCKET_MIN}m`;
    buckets[key] = Math.max(buckets[key] ?? 0, g.gapS);
  }
  const firstLongGap = gaps.find((g) => g.gapS > (HEARTBEAT_MS / 1000) * 1.5);
  const visAfterHidden: Record<string, number> = {};
  for (const b of beats.filter((b) => hiddenAt === undefined || b.ms > hiddenAt + 2000)) {
    visAfterHidden[String(b.vis)] = (visAfterHidden[String(b.vis)] ?? 0) + 1;
  }
  const lifecycle = entries
    .filter((e) => /^page-(visibilitychange|freeze|resume|pagehide|pageshow)$/.test(e.ev))
    .map((e) => ({ min: min(e.ms), ev: e.ev.slice(5), vis: e.vis, pnow: e.pnow }));
  const hellos = entries.filter((e) => e.ev === "page-hello");
  return {
    file,
    engine: entries[0]?.engine,
    browser: notes.find((e) => e.browserVersion)?.browserVersion,
    mode: notes.find((e) => e.mode)?.mode,
    minutes: min(entries.at(-1)?.ms ?? t0),
    hiddenAtMin: hiddenAt === undefined ? null : min(hiddenAt),
    // Distinct page loads: a tab restored after a discard may come from the cache, unseen by HTTP.
    pageLoads: new Set(hellos.map((h) => h.load)).size,
    wasDiscarded: hellos.map((h) => h.wasDiscarded),
    wsOpens: entries.filter((e) => e.ev === "ws-open").length,
    wsCloses: entries
      .filter((e) => e.ev === "ws-close")
      .map((e) => {
        const reopen = entries.find((o) => o.ev === "ws-open" && o.ms > e.ms);
        return { min: min(e.ms), code: e.code, reason: e.reason, reopenedAfterS: reopen ? (reopen.ms - e.ms) / 1000 : null };
      }),
    heartbeats: beats.length,
    longestGapS: longest.gapS,
    longestGapAtMin: min(longest.at),
    firstGapOver7_5sAtMin: firstLongGap ? min(firstLongGap.at) : null,
    maxGapPer5MinS: buckets,
    visibilityAfterFrontTab: visAfterHidden,
    focusAfterFrontTab: [...new Set(beats.filter((b) => hiddenAt && b.ms > hiddenAt + 2000).map((b) => b.focus))],
    lifecycle,
  };
}

const [cmd, ...rest] = Bun.argv.slice(2);
if (import.meta.main) {
  if (cmd === "serve") serve(rest);
  else if (cmd === "report") for (const f of rest) console.log(JSON.stringify(summarise(f), null, 2));
  else {
    console.error("usage: bun tab.ts serve [--run NAME] [--engine LABEL] [--port N] [--drop-every S] | bun tab.ts report FILE.jsonl...");
    process.exit(2);
  }
}
