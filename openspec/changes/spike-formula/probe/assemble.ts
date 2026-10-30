// The `assemble` stand-in (AD-9): a view document per engine, with AD-8's view CSP as a meta
// tag, the instrument script first, a JSON data block with the run's parameters, then the
// engine's chunk, all inline and allowed by SHA-256 hash. The same text serves as the srcdoc
// and, saved to a file, as the Snapshot opened from file://.

import { join } from "node:path";
import { DIST, loadManifest, type Manifest, sha256 } from "./build.ts";
import type { ViewParams } from "./src/view/api.ts";

export type Doc = "none" | "own" | "ironcalc" | "ironcalc-async";
export const DOCS: readonly Doc[] = ["none", "own", "ironcalc", "ironcalc-async"];

export type AssembleOptions = {
  params: ViewParams;
  // `'wasm-unsafe-eval'` in the view's policy: by default only in IronCalc's documents (AD-8);
  // false gives the negative control.
  viewWasm?: boolean;
  // false: no policy at all, the control that shows the recorders see a request when one is made.
  csp?: boolean;
};

export type Assembled = { html: string; policy: string; scripts: string[]; styles: string[] };

// The view has no visible UI; one style block exercises styles by hash.
export const VIEW_STYLE = "body{font:12px ui-monospace,monospace;margin:8px}";

const hashes = (list: readonly string[]): string => (list.length ? list.map((h) => `'sha256-${h}'`).join(" ") : "'none'");

export function viewPolicy(scripts: readonly string[], styles: readonly string[], wasm: boolean): string {
  return [
    "default-src 'none'",
    `script-src ${hashes(scripts)}${wasm ? " 'wasm-unsafe-eval'" : ""}`,
    `style-src ${hashes(styles)}`,
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/** The board page's policy as AD-8 writes it; `wasm` is the candidate amendment (variant `board-wasm`). */
export function boardPolicy(scripts: readonly string[], styles: readonly string[], wasm: boolean): string {
  return [
    "default-src 'none'",
    `script-src ${hashes(scripts)}${wasm ? " 'wasm-unsafe-eval'" : ""}`,
    `style-src ${hashes(styles)}`,
    "connect-src 'self'",
    "frame-src 'self'",
  ].join("; ");
}

export type Build = { manifest: Manifest; texts: Map<string, string> };

export async function loadBuild(): Promise<Build> {
  const manifest = await loadManifest();
  const texts = new Map<string, string>();
  for (const c of manifest.chunks) texts.set(c.name, await Bun.file(join(DIST, c.file)).text());
  return { manifest, texts };
}

const chunkOf = (build: Build, name: string): { text: string; sha256: string } => {
  const info = build.manifest.chunks.find((c) => c.name === name);
  const text = build.texts.get(name);
  if (!info || text === undefined) throw new Error(`assemble: no chunk ${name}; run bun build.ts`);
  return { text, sha256: info.sha256 };
};

export function assemble(build: Build, doc: Doc, options: AssembleOptions): Assembled {
  const instrument = chunkOf(build, "instrument");
  const engine = chunkOf(build, doc);
  const scripts = [instrument.sha256, engine.sha256];
  const styles = [sha256(VIEW_STYLE)];
  const wasm = options.viewWasm ?? doc.startsWith("ironcalc");
  const policy = viewPolicy(scripts, styles, wasm);
  // `<` escaped so nothing in the data can end the block.
  const data = JSON.stringify(options.params).replaceAll("<", "\\u003c");
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    options.csp === false ? "" : `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    `<title>AskBoard formula view (${doc})</title>`,
    `<script>${instrument.text}</script>`,
    `<style>${VIEW_STYLE}</style>`,
    "</head>",
    "<body>",
    `<script type="application/json" id="probe-data">${data}</script>`,
    `<script>${engine.text}</script>`,
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");
  return { html, policy: options.csp === false ? "" : policy, scripts, styles };
}
