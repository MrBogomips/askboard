// `bun build.ts`: one classic-script (IIFE) chunk per engine, minified, in dist/chunks/, and
// dist/manifest.json with each chunk's SHA-256 (base64, for the CSP), raw and gzip bytes.
// IronCalc's chunk carries wasm_bg.wasm as base64; it goes through the adapter once
// src/ironcalc/engine.ts exists, else IronCalc's API directly.

import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { BunPlugin } from "bun";

const PROBE = import.meta.dir;
export const DIST = join(PROBE, "dist");
const WASM = join(PROBE, "node_modules/@ironcalc/wasm/wasm_bg.wasm");

export type Asset = { file: string; sha256: string; bytes: number; gzip: number };
export type ChunkInfo = Asset & { name: string; entry: string; note?: string };
export type Manifest = { builtAt: string; bun: string; adapter: boolean; adapterSource: string | null; wasm: Omit<Asset, "sha256" | "file">; chunks: ChunkInfo[] };

export const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("base64");
export const gzipBytes = (data: string | Uint8Array): number =>
  Bun.gzipSync(typeof data === "string" ? Buffer.from(data) : new Uint8Array(data), { level: 9 }).byteLength;

export const adapterReady = (): boolean =>
  existsSync(join(PROBE, "src/ironcalc/engine.ts"));

const wasmBase64: BunPlugin = {
  name: "probe-wasm-base64",
  setup(build) {
    build.onResolve({ filter: /^probe:ironcalc-wasm-base64$/ }, (args) => ({ path: args.path, namespace: "probe-wasm" }));
    build.onLoad({ filter: /.*/, namespace: "probe-wasm" }, async () => ({
      contents: `export default ${JSON.stringify(Buffer.from(await Bun.file(WASM).arrayBuffer()).toString("base64"))};`,
      loader: "js",
    }));
  },
};

// A classic script cannot hold `import.meta`. IronCalc's default loader resolves its module
// against `import.meta.url`; in the async control chunk that becomes the document's base URL.
const importMetaUrl: BunPlugin = {
  name: "probe-import-meta-url",
  setup(build) {
    build.onLoad({ filter: /@ironcalc\/wasm\/wasm\.js$/ }, async (args) => ({
      contents: (await Bun.file(args.path).text()).replaceAll("import.meta.url", "document.baseURI"),
      loader: "js",
    }));
  },
};

// Inline scripts end at the first `</script`, and `<!--` changes how the rest is parsed.
const escapeForInline = (code: string): string => code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "\\x3C!--");

const CHUNKS = (adapter: boolean): { name: string; entry: string; plugins: BunPlugin[]; note?: string }[] => [
  { name: "instrument", entry: "src/view/instrument.ts", plugins: [] },
  { name: "none", entry: "src/view/none.ts", plugins: [], note: "baseline: no engine" },
  { name: "own", entry: "src/view/own.ts", plugins: [] },
  adapter
    ? { name: "ironcalc", entry: "src/view/ironcalc.ts", plugins: [wasmBase64] }
    : { name: "ironcalc", entry: "src/view/ironcalc-direct.ts", plugins: [wasmBase64], note: "IronCalc's API directly (adapter not ready)" },
  { name: "ironcalc-async", entry: "src/view/ironcalc-async.ts", plugins: [importMetaUrl], note: "negative control: init() with no bytes" },
  // The engine alone, without the probe's suite and fixtures: the bytes a board with a formula carries.
  { name: "size-own", entry: "src/view/size-own.ts", plugins: [], note: "size only: the own engine behind the port" },
  adapter
    ? { name: "size-ironcalc", entry: "src/view/size-ironcalc.ts", plugins: [wasmBase64], note: "size only: IronCalc through the adapter" }
    : { name: "size-ironcalc", entry: "src/view/size-ironcalc-direct.ts", plugins: [wasmBase64], note: "size only: IronCalc's module and API, no adapter yet" },
];

async function buildChunk(def: ReturnType<typeof CHUNKS>[number]): Promise<ChunkInfo> {
  const result = await Bun.build({
    entrypoints: [join(PROBE, def.entry)],
    format: "iife",
    target: "browser",
    minify: true,
    plugins: def.plugins,
  });
  if (!result.success) throw new AggregateError(result.logs, `build of ${def.name} failed`);
  const output = result.outputs.find((o) => o.kind === "entry-point");
  if (!output) throw new Error(`build of ${def.name}: no output`);
  const code = escapeForInline(await output.text());
  if (/\bimport\.meta\b/.test(code)) throw new Error(`${def.name}: the chunk holds import.meta, which a classic script cannot parse`);
  const file = `chunks/${def.name}.js`;
  await Bun.write(join(DIST, file), code);
  return { name: def.name, entry: def.entry, file, sha256: sha256(code), bytes: Buffer.byteLength(code), gzip: gzipBytes(code), ...(def.note ? { note: def.note } : {}) };
}

// The adapter changes while it is refined: this names the version a run used.
async function adapterSource(): Promise<string> {
  const dir = join(PROBE, "src/ironcalc");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".ts")).sort();
  const texts = await Promise.all(files.map((f) => Bun.file(join(dir, f)).text()));
  return sha256(files.map((f, i) => `${f}\n${texts[i]}`).join("\n")).slice(0, 16);
}

export async function loadManifest(): Promise<Manifest> {
  const file = Bun.file(join(DIST, "manifest.json"));
  if (!(await file.exists())) throw new Error("no dist/manifest.json: run bun build.ts");
  return (await file.json()) as Manifest;
}

async function main(): Promise<void> {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(join(DIST, "chunks"), { recursive: true });
  const adapter = adapterReady();
  const chunks: ChunkInfo[] = [];
  for (const def of CHUNKS(adapter)) chunks.push(await buildChunk(def));
  const wasm = new Uint8Array(await Bun.file(WASM).arrayBuffer());
  const manifest: Manifest = { builtAt: new Date().toISOString(), bun: Bun.version, adapter, adapterSource: adapter ? await adapterSource() : null, wasm: { bytes: wasm.byteLength, gzip: gzipBytes(wasm) }, chunks };
  await Bun.write(join(DIST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`adapter: ${adapter ? `yes, source ${manifest.adapterSource}` : "no (IronCalc used directly)"}; wasm ${wasm.byteLength}/${manifest.wasm.gzip}`);
  for (const c of chunks) console.log(`${c.name.padEnd(15)} js ${c.bytes}/${c.gzip}  ${c.entry}`);
}

if (import.meta.main) await main();
