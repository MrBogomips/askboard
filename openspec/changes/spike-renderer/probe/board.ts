// The board-page stand-in (design decision 2): `Bun.serve` on 127.0.0.1, random port. It serves
// `/b/<fixture>` with the board page's CSP as a header and a page script that fetches the
// assembled view, marks t0, sets it as the srcdoc of an iframe with exactly
// `sandbox="allow-scripts"`, and keeps the view's messages for the driver.
//
// Query: `renderer=own|json-render` (default own), `control=1` (no CSP, no sandbox),
// `theme=light|dark|system`, `variants=a,b` (candidate amendments of AD-8, csp.ts).
// `/v/<fixture>` is the assembled view, `/s/<fixture>` the Snapshot file, `/leak/*` records any
// request that escapes the view, `/leaks` lists them.
//
// Usage: bun board.ts [--port N] [--json]   (prints the URLs; --json prints one line for drive.ts)

import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { type AssembleOptions, type Assembled, assemble, loadBuild } from "./assemble.ts";
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
};

const BOARD_STYLE =
  "html,body{margin:0;height:100%;background:#d9d4ca}" +
  "iframe{display:block;border:0;width:100%;height:100vh;background:#fff}";

const BOARD_SCRIPT = `(async () => {
  const frame = document.getElementById("view");
  const now = () => performance.timeOrigin + performance.now();
  const probe = (window.__probe = { events: [], board: [], t0: null });
  window.addEventListener("message", (e) => {
    if (e.source === frame.contentWindow) probe.events.push(e.data);
  });
  document.addEventListener("securitypolicyviolation", (e) => {
    probe.board.push({ kind: "violation", directive: e.effectiveDirective,
      blockedURI: e.blockedURI, sample: e.sample, source: e.sourceFile,
      policy: e.originalPolicy, t: now() });
  });
  window.__probeSend = (command, args, id) =>
    frame.contentWindow.postMessage({ askboardProbeCommand: command, args, id }, "*");
  const response = await fetch(location.pathname.replace(/^\\/b\\//, "/v/") + location.search);
  const html = await response.text();
  probe.t0 = now();
  frame.srcdoc = html;
})();`;

const sha256 = (text: string): string =>
  new Bun.CryptoHasher("sha256").update(text).digest("base64");

const boardPage = (control: boolean): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>AskBoard board stand-in</title>',
    `<style>${BOARD_STYLE}</style></head>`,
    `<body><iframe id="view" ${control ? "" : 'sandbox="allow-scripts" '}title="AskBoard view"></iframe>`,
    `<script>${BOARD_SCRIPT}</script></body>`,
    "</html>",
  ].join("\n");

export const loadFixtures = async (): Promise<Map<string, Fixture>> => {
  const dir = join(PROBE, "fixtures");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const entries = await Promise.all(
    files.map(async (f) => [basename(f, ".json"), await Bun.file(join(dir, f)).json()] as const),
  );
  return new Map(entries as [string, Fixture][]);
};

const optionsOf = (url: URL, fixture: Fixture): AssembleOptions => ({
  renderer: url.searchParams.get("renderer") ?? "own",
  csp: url.searchParams.get("control") !== "1",
  draft: fixture.draft,
  theme: (url.searchParams.get("theme") as AssembleOptions["theme"]) ?? "system",
  variants: (url.searchParams.get("variants") ?? "").split(",").filter(Boolean),
});

export const startBoard = async (port = 0) => {
  const build = await loadBuild(join(PROBE, "dist"));
  const fixtures = await loadFixtures();
  const leaks: { method: string; path: string; t: number }[] = [];
  const cache = new Map<string, Assembled>();
  const assembled = (name: string, url: URL): Assembled => {
    const fixture = fixtures.get(name) as Fixture;
    const options = optionsOf(url, fixture);
    const key = JSON.stringify([name, options.renderer, options.csp, options.theme, options.variants]);
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
    fetch(request) {
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
      const view = assembled(name, url);
      if (route === "v") return html(view.html);
      if (route === "s") {
        return html(view.html, { "content-disposition": `attachment; filename="${name}.html"` });
      }
      if (route !== "b") return new Response("not found", { status: 404 });
      const control = url.searchParams.get("control") === "1";
      if (control) return html(boardPage(true));
      const omit = new Set(fixture.omitFromBoardPolicy ?? []);
      const policy = boardPolicy(
        [sha256(BOARD_SCRIPT), ...view.scripts.filter((s) => !omit.has(s.chunk)).map((s) => s.sha256)],
        [sha256(BOARD_STYLE), ...view.styles.filter((s) => !omit.has(s.chunk)).map((s) => s.sha256)],
        optionsOf(url, fixture).variants,
      );
      return html(boardPage(false), { "content-security-policy": policy });
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
