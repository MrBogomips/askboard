// The board-page stand-in (design decision 4): `Bun.serve` on 127.0.0.1, random port. `/b`
// serves the board page with its CSP as a header; its script fetches the view document, marks
// t0, sets it as the srcdoc of an iframe with exactly `sandbox="allow-scripts"`, and keeps the
// view's messages in `window.__probe` for the driver. `/v` is the view document, `/s` the same
// text for a Snapshot file. Any other path is a request that should not exist: it is recorded
// and listed at `/leaks`.
//
// Query: doc=own|ironcalc|ironcalc-async, mode=smoke|suite|timing|latency|async-loader,
// repeats=N, board=as-written|wasm (default as-written), viewWasm=0 (negative control),
// csp=0 (no policy on either page: the control that shows a request is seen when one is made).
// Usage: bun board.ts   (prints the URL and waits; drive.ts starts it in-process)

import { type Assembled, assemble, boardPolicy, type Build, DOCS, type Doc, loadBuild } from "./assemble.ts";
import { sha256 } from "./build.ts";
import type { ViewParams } from "./src/view/api.ts";

const BOARD_STYLE = "html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100vh}";

const BOARD_SCRIPT = `(async () => {
  const frame = document.getElementById("view");
  const now = () => performance.timeOrigin + performance.now();
  const probe = (window.__probe = { events: [], board: [], t0: null });
  window.addEventListener("message", (e) => {
    if (e.source === frame.contentWindow && e.data && e.data.askboardProbe) probe.events.push(e.data);
  });
  document.addEventListener("securitypolicyviolation", (e) => {
    probe.board.push({ kind: "violation", directive: e.effectiveDirective, blockedURI: e.blockedURI,
      sample: e.sample, source: e.sourceFile, policy: e.originalPolicy, t: now() });
  });
  const response = await fetch("/v" + location.search);
  const html = await response.text();
  probe.t0 = now();
  frame.srcdoc = html;
})();`;

export const BOARD_SCRIPT_HASH = sha256(BOARD_SCRIPT);

const boardPage = (): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    `<head><meta charset="utf-8"><title>AskBoard board stand-in</title><style>${BOARD_STYLE}</style></head>`,
    '<body><iframe id="view" sandbox="allow-scripts" title="AskBoard view"></iframe>',
    `<script>${BOARD_SCRIPT}</script></body>`,
    "</html>",
  ].join("\n");

export type Leak = { method: string; path: string; t: number };

const viewOf = (build: Build, url: URL): Assembled => {
  const doc = (url.searchParams.get("doc") ?? "own") as Doc;
  if (!DOCS.includes(doc)) throw new Error(`unknown doc ${doc}`);
  const params: ViewParams = {
    mode: (url.searchParams.get("mode") ?? "smoke") as ViewParams["mode"],
    ...(url.searchParams.has("repeats") ? { repeats: Number(url.searchParams.get("repeats")) } : {}),
  };
  const viewWasm = url.searchParams.get("viewWasm");
  const csp = url.searchParams.get("csp") !== "0";
  return assemble(build, doc, { params, csp, ...(viewWasm === null ? {} : { viewWasm: viewWasm === "1" }) });
};

export function boardPolicyFor(view: Assembled, url: URL): string {
  return boardPolicy([BOARD_SCRIPT_HASH, ...view.scripts], [sha256(BOARD_STYLE), ...view.styles], url.searchParams.get("board") === "wasm");
}

export async function startBoard(port = 0) {
  const build = await loadBuild();
  const leaks: Leak[] = [];
  const cache = new Map<string, Assembled>();
  const view = (url: URL): Assembled => {
    const key = url.search;
    const hit = cache.get(key);
    if (hit) return hit;
    const made = viewOf(build, url);
    cache.set(key, made);
    return made;
  };
  const html = (body: string, headers: Record<string, string> = {}) =>
    new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers } });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch(request) {
      const url = new URL(request.url);
      try {
        if (url.pathname === "/b" && url.searchParams.get("csp") === "0") return html(boardPage());
        if (url.pathname === "/b") return html(boardPage(), { "content-security-policy": boardPolicyFor(view(url), url) });
        if (url.pathname === "/v" || url.pathname === "/s") return html(view(url).html);
        if (url.pathname === "/leaks") return Response.json(leaks);
      } catch (e) {
        return new Response(String(e), { status: 400 });
      }
      leaks.push({ method: request.method, path: url.pathname + url.search, t: Date.now() });
      return new Response("not found", { status: 404 });
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    leaks,
    build,
    view,
    stop: () => server.stop(true),
  };
}

if (import.meta.main) {
  const board = await startBoard();
  console.log(`board stand-in: ${board.url}/b?doc=own&mode=smoke  (Ctrl+C stops it)`);
}
