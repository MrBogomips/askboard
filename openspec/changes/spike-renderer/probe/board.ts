// The board-page stand-in (design decision 2): `Bun.serve` on 127.0.0.1, random port. It serves
// `/b/<fixture>` with the board page's CSP as a header and a page script that fetches the
// assembled view, marks t0, sets it as the srcdoc of an iframe with exactly
// `sandbox="allow-scripts"`, and keeps the view's messages for the driver.
//
// Query: `renderer=own|json-render` (default own), `control=1` (no CSP, no sandbox),
// `theme=light|dark|system`, `variants=a,b` (candidate amendments of AD-8, csp.ts).
// `/v/<fixture>` is the assembled view, `/s/<fixture>` the Snapshot file, `/leak/*` records any
// request that escapes the view, `/leaks` lists them. `/s/<fixture>?renders=<run>` is a Snapshot
// that carries the diagram renders `bun drive.ts <run> --script renders` kept, in place of the
// diagram renderers (task 5.2).
//
// Usage: bun board.ts [--port N] [--json]   (prints the URLs; --json prints one line for drive.ts)

import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { type AssembleOptions, type Assembled, assemble, loadBuild, type Renders } from "./assemble.ts";
import { boardPolicy } from "./csp.ts";
import type { BoardDocument, Draft } from "./port/index.ts";

const PROBE = import.meta.dir;

export type Fixture = {
  description: string;
  board: BoardDocument;
  draft?: Draft;
  check?: { selector: string; text: string };
  negative?: Record<string, unknown>[];
  omitFromBoardPolicy?: string[];
  edits?: { action: "fill" | "click"; selector: string; value?: string }[];
  delayed?: { item: string; ms: number };
  // Diagram items whose latest render must show as a loaded `blob:` image.
  expectDiagrams?: string[];
  // Per diagram item, the anchor keys its hit map must hold (task 3.6).
  expectAnchors?: Record<string, string[]>;
  // The golden flow's source edit (task 3.7): the corrected source, written to the draft record.
  rerender?: { item: string; source: string };
  // Diagram items whose source must not render: an error shows, and no image (task 3.4).
  expectDiagramErrors?: string[];
  // Group 4: user actions run after "visible" in every load, each followed by a record of the
  // view's state; the draft values and computed styles the fixture expects afterwards.
  actions?: Action[];
  expectDraft?: Record<string, unknown>;
  expectComputed?: { selector: string; property: string; equals: string }[];
  // The board page hosts an ext-apps `AppBridge` for the view's `App` (task 4.1).
  bridge?: boolean;
  // JSON-RPC methods the bridge must have received from the view.
  expectBridge?: string[];
  // Per diagram item, the theme of its latest render (task 4.6).
  expectThemes?: Record<string, "light" | "dark">;
};

export type Action = {
  do: "click" | "fill" | "type" | "press" | "drag" | "hover" | "wheel" | "focus" | "command" | "wait";
  selector?: string;
  // `drag`: the drop target; `click`: a position inside the element ({ x, y } in pixels).
  to?: string;
  at?: { x: number; y: number };
  value?: string;
  key?: string;
  delta?: { x: number; y: number };
  command?: string;
  args?: Record<string, unknown>;
  ms?: number;
  // Locate in the board page rather than in the view.
  board?: boolean;
};

const BOARD_STYLE =
  "html,body{margin:0;height:100%;background:#d9d4ca}" +
  "iframe{display:block;border:0;width:100%;height:100vh;background:#fff}";

const BOARD_SCRIPT = `(async () => {
  const frame = document.getElementById("view");
  const now = () => performance.timeOrigin + performance.now();
  const probe = (window.__probe = { events: [], board: [], t0: null });
  window.addEventListener("message", (e) => {
    if (e.source === frame.contentWindow && e.data && e.data.askboardProbe) probe.events.push(e.data);
  });
  document.addEventListener("securitypolicyviolation", (e) => {
    probe.board.push({ kind: "violation", directive: e.effectiveDirective,
      blockedURI: e.blockedURI, sample: e.sample, source: e.sourceFile,
      policy: e.originalPolicy, t: now() });
  });
  window.__probeSend = (command, args, id) =>
    frame.contentWindow.postMessage({ askboardProbeCommand: command, args, id }, "*");
  if (window.__askboardBridge) window.__askboardBridge(frame).catch(() => undefined);
  const response = await fetch(location.pathname.replace(/^\\/b\\//, "/v/") + location.search);
  const html = await response.text();
  probe.t0 = now();
  frame.srcdoc = html;
})();`;

const sha256 = (text: string): string =>
  new Bun.CryptoHasher("sha256").update(text).digest("base64");

// `bridge`: the AppBridge chunk's script, inlined before the page script for fixtures that ask.
const boardPage = (control: boolean, bridge?: string): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>AskBoard board stand-in</title>',
    `<style>${BOARD_STYLE}</style></head>`,
    `<body><iframe id="view" ${control ? "" : 'sandbox="allow-scripts" '}title="AskBoard view"></iframe>`,
    bridge ? `<script>${bridge}</script>` : "",
    `<script>${BOARD_SCRIPT}</script></body>`,
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");

export const loadFixtures = async (): Promise<Map<string, Fixture>> => {
  const dir = join(PROBE, "fixtures");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const entries = await Promise.all(
    files.map(async (f) => [basename(f, ".json"), await Bun.file(join(dir, f)).json()] as const),
  );
  return new Map(entries as [string, Fixture][]);
};

// The renders a run kept for a fixture (`--script renders` in drive.ts).
export const rendersFile = (run: string, fixture: string): string =>
  join(PROBE, "runs", run, "renders", `${fixture}.json`);

const optionsOf = (url: URL, fixture: Fixture): AssembleOptions => ({
  renderer: url.searchParams.get("renderer") ?? "own",
  csp: url.searchParams.get("control") !== "1",
  draft: fixture.draft,
  theme: (url.searchParams.get("theme") as AssembleOptions["theme"]) ?? "system",
  variants: (url.searchParams.get("variants") ?? "").split(",").filter(Boolean),
});

export const startBoard = async (port = 0) => {
  // `PROBE_DIST` serves a size variant of the build (group 5, `tools/sizes.ts`).
  const build = await loadBuild(resolve(PROBE, process.env.PROBE_DIST ?? "dist"));
  const fixtures = await loadFixtures();
  const leaks: { method: string; path: string; t: number }[] = [];
  const cache = new Map<string, Assembled>();
  const assembled = async (name: string, url: URL): Promise<Assembled> => {
    const fixture = fixtures.get(name) as Fixture;
    const rendersRun = url.searchParams.get("renders");
    const renders = rendersRun ? ((await Bun.file(rendersFile(rendersRun, name)).json()) as Renders) : undefined;
    const options = { ...optionsOf(url, fixture), renders };
    const key = JSON.stringify([name, options.renderer, options.csp, options.theme, options.variants, rendersRun]);
    const hit = cache.get(key);
    if (hit) return hit;
    const result = assemble(fixture.board, build, options);
    cache.set(key, result);
    return result;
  };
  const html = (body: string, headers: Record<string, string> = {}) =>
    new Response(body, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const url = new URL(request.url);
      const [, route, name = ""] = url.pathname.split("/");
      if (route === "leak") {
        leaks.push({ method: request.method, path: url.pathname, t: Date.now() });
        console.error(`leak: ${request.method} ${url.pathname}`);
        return new Response(null, { status: 204 });
      }
      if (route === "leaks") return Response.json(leaks);
      if (route === "" || route === undefined) {
        const links = [...fixtures.keys()].map(
          (f) => `<li><a href="/b/${f}">${f}</a> · <a href="/b/${f}?renderer=json-render">json-render</a></li>`,
        );
        return html(`<!doctype html><title>Fixtures</title><ul>${links.join("")}</ul>`);
      }
      const fixture = fixtures.get(name);
      if (!fixture) return new Response(`no fixture ${name}`, { status: 404 });
      const view = await assembled(name, url);
      if (route === "v") return html(view.html);
      if (route === "s") {
        return html(view.html, { "content-disposition": `attachment; filename="${name}.html"` });
      }
      if (route !== "b") return new Response("not found", { status: 404 });
      const control = url.searchParams.get("control") === "1";
      const bridge = fixture.bridge ? build.texts.get("chunks/bridge.js") : undefined;
      if (fixture.bridge && bridge === undefined) return new Response("no bridge chunk: run bun run build", { status: 500 });
      if (control) return html(boardPage(true, bridge));
      const omit = new Set(fixture.omitFromBoardPolicy ?? []);
      const policy = boardPolicy(
        [
          sha256(BOARD_SCRIPT),
          ...(bridge ? [sha256(bridge)] : []),
          ...view.scripts.filter((s) => !omit.has(s.chunk)).map((s) => s.sha256),
        ],
        [sha256(BOARD_STYLE), ...view.styles.filter((s) => !omit.has(s.chunk)).map((s) => s.sha256)],
        optionsOf(url, fixture).variants,
      );
      return html(boardPage(false, bridge), { "content-security-policy": policy });
    },
  });
  return { server, url: `http://127.0.0.1:${server.port}`, fixtures };
};

if (import.meta.main) {
  const portArg = process.argv.indexOf("--port");
  const { url, fixtures } = await startBoard(portArg > 0 ? Number(process.argv[portArg + 1]) : 0);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ url }));
  } else {
    console.log(`board stand-in: ${url}/`);
    for (const name of fixtures.keys()) {
      console.log(`  ${url}/b/${name}   (json-render: ${url}/b/${name}?renderer=json-render)`);
    }
  }
}
