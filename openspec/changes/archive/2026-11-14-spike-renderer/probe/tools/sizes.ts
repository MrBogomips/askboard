// Criterion 6 (task 5.1, design decision 7): sizes from the manifest and the assembled files.
// Writes evidence/sizes.json and prints the tables of findings.md, § Criterion 6:
// - every chunk, raw and gzip, script and style, beside the group 1 to 4 build (`catch-all`);
// - the boards (golden, UJ-1-like, every component) as srcdoc and as Snapshot, with the diagram
//   renderer chunks or, with `--renders <run>`, with that run's light and dark renders only;
// - library chunks against a copy per chunk (`copy`);
// - Diff review with the named grammars only (`trim`) and with highlighting off (`plain`);
// - the fonts' share: those the build inlines (KaTeX, MathLive) and DESIGN.md's two faces, read
//   from the @fontsource tarballs the design names (not installed: their licence is open).
// The probe's own code is left out: the instrumentation (its hash stays in the view policy), the
// board page's bridge, and the chunks only the probe's fixtures use.
//
// Usage, from probe/: bun run build && bun tools/sizes.ts [--renders <run>]

import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Build, assemble, loadBuild, type Renders } from "../assemble.ts";
import { type Fixture, loadFixtures, rendersFile } from "../board.ts";
import type { Chunk } from "../build.ts";

const PROBE = resolve(import.meta.dir, "..");
const EVIDENCE = resolve(PROBE, "../evidence/sizes.json");

// A sensible grammar set (DESIGN.md names none): AskBoard's own stack and the languages its users'
// diffs most often hold.
export const LANGS = [
  "typescript", "tsx", "javascript", "jsx", "json", "markdown", "yaml", "toml", "css", "html",
  "shellscript", "python", "go", "rust", "java", "sql", "diff",
];
const VARIANTS: Record<string, Record<string, string>> = {
  "catch-all": { PROBE_CATCH_ALL_RESOLVE: "1" },
  copy: { PROBE_COPY_LIBRARIES: "1" },
  trim: { PROBE_SHIKI_LANGS: LANGS.join(",") },
  plain: { PROBE_SHIKI_LANGS: "" },
};
const BOARDS = ["golden", "golden-smetana", "size-uj1", "size-all"];
// Chunks only the probe's own fixtures use: harness items, negative controls, superseded variants.
const PROBE_ONLY = new Set([
  "probe-items", "negative", "neg-chunk", "pattern", "form-ajv", "tailwind", "app-channel", "renderer-json-render",
]);
const FONTS = [
  { name: "@fontsource/inter", version: "5.3.0", sheets: ["400.css", "500.css", "600.css"] },
  { name: "@fontsource/jetbrains-mono", version: "5.3.0", sheets: ["400.css"] },
  { name: "@fontsource-variable/inter", version: "5.3.0", sheets: ["wght.css"] },
];

type Size = { raw: number; gzip: number };
const size = (text: string): Size => ({
  raw: Buffer.byteLength(text),
  gzip: Bun.gzipSync(Buffer.from(text), { level: 9 }).byteLength,
});
const add = (a: Size, b: Size): Size => ({ raw: a.raw + b.raw, gzip: a.gzip + b.gzip });
const ZERO: Size = { raw: 0, gzip: 0 };
const mb = (n: number) => (n / 1_000_000).toFixed(2);
const kb = (n: number) => (n / 1_000).toFixed(1);

const buildVariant = async (name: string, env: Record<string, string>): Promise<Build> => {
  const dist = join(PROBE, "dist", "variants", name);
  const run = Bun.spawnSync([process.execPath, join(PROBE, "build.ts")], {
    env: { ...process.env, ...env, PROBE_DIST: dist },
    stdout: "ignore",
    stderr: "pipe",
  });
  if (run.exitCode !== 0) throw new Error(`build ${name}: ${run.stderr.toString()}`);
  return loadBuild(dist);
};

const chunkSize = (chunk: Chunk): { script: Size; style: Size | null; total: Size } => {
  const script = { raw: chunk.script.bytes, gzip: chunk.script.gzip };
  const style = chunk.style ? { raw: chunk.style.bytes, gzip: chunk.style.gzip } : null;
  return { script, style, total: add(script, style ?? ZERO) };
};

// The view as a board loads it, without the probe's instrumentation. Each chunk is gzipped on its
// own in the manifest; the whole file here, as a server or an archive would send it.
const view = (fixture: Fixture, build: Build, renders?: Renders) => {
  const assembled = assemble(fixture.board, build, { renderer: "own", renders });
  const instrument = build.texts.get("chunks/instrument.js") as string;
  const html = assembled.html.replace(`<script>${instrument}</script>\n`, "");
  if (html === assembled.html) throw new Error(`${fixture.board.id}: no instrumentation to leave out`);
  return { ...size(html), chunks: assembled.chunks.filter((c) => c !== "instrument") };
};

const DATA_FONT = /url\(data:font\/[a-z0-9]+;base64,[A-Za-z0-9+/=]+\)/g;

// The fonts a chunk's stylesheet inlines as `data:` URLs (KaTeX's, MathLive's).
const inlinedFonts = (build: Build) =>
  build.manifest.chunks.flatMap((chunk) => {
    const css = chunk.style ? (build.texts.get(chunk.style.file) as string) : "";
    const urls = css.match(DATA_FONT) ?? [];
    if (urls.length === 0) return [];
    return [{ chunk: chunk.name, faces: urls.length, fonts: size(urls.join("")), style: size(css) }];
  });

// DESIGN.md's faces as the shell's stylesheet would carry them: each package's own @font-face
// rules, woff2 only, inlined as `data:` URLs, for a set of subsets.
const fetchFonts = async (dir: string) => {
  const out: Record<string, string> = {};
  for (const font of FONTS) {
    const meta = (await (await fetch(`https://registry.npmjs.org/${font.name}/${font.version}`)).json()) as {
      dist: { tarball: string; integrity: string };
    };
    const tarball = new Uint8Array(await (await fetch(meta.dist.tarball)).arrayBuffer());
    const digest = `sha512-${new Bun.CryptoHasher("sha512").update(tarball).digest("base64")}`;
    if (digest !== meta.dist.integrity) throw new Error(`${font.name}: integrity mismatch`);
    const target = join(dir, font.name.replace("/", "__"));
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await Bun.write(join(target, "package.tgz"), tarball);
    const untar = Bun.spawnSync(["tar", "-xzf", join(target, "package.tgz"), "-C", target]);
    if (untar.exitCode !== 0) throw new Error(`${font.name}: tar failed`);
    out[font.name] = join(target, "package");
  }
  return out;
};

const FACE = /\/\* ([a-z0-9-]+) \*\/\s*@font-face\s*\{[^}]*\}/g;

const faceSheet = async (root: string, sheets: string[], subsets: string[] | null): Promise<{ css: string; woff2: number }> => {
  let css = "";
  let woff2 = 0;
  for (const sheet of sheets) {
    const text = await Bun.file(join(root, sheet)).text();
    for (const match of text.matchAll(FACE)) {
      const [block, name] = match as unknown as [string, string];
      if (subsets && !subsets.some((s) => new RegExp(`-${s}-(\\d+|wght)-normal$`).test(name))) continue;
      const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block)?.[1];
      if (!file) continue;
      const bytes = await Bun.file(join(root, "files", file)).bytes();
      woff2 += bytes.byteLength;
      css += block
        .replace(/^\/\*[^*]*\*\/\s*/, "")
        .replace(/src:[^;]*;/, `src:url(data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}) format("woff2");`);
    }
  }
  return { css, woff2 };
};

const designFonts = async () => {
  try {
    const roots = await fetchFonts(join(PROBE, "dist", "fonts"));
    const sets: Record<string, string[] | null> = { latin: ["latin"], "latin + latin-ext": ["latin", "latin-ext"], "every subset": null };
    const rows = [];
    for (const [label, subsets] of Object.entries(sets)) {
      for (const inter of ["@fontsource/inter", "@fontsource-variable/inter"]) {
        const interFont = FONTS.find((f) => f.name === inter) as (typeof FONTS)[number];
        const a = await faceSheet(roots[inter] as string, interFont.sheets, subsets);
        const b = await faceSheet(roots["@fontsource/jetbrains-mono"] as string, ["400.css"], subsets);
        rows.push({
          subsets: label,
          inter: inter === "@fontsource/inter" ? "static 400, 500, 600" : "variable (wght)",
          woff2: a.woff2 + b.woff2,
          css: size(a.css + b.css),
        });
      }
    }
    return { packages: FONTS.map((f) => `${f.name}@${f.version}`), rows };
  } catch (error) {
    return { untested: String(error) };
  }
};

// A shim's own minified bytes, outside any chunk.
const shimSize = async (file: string): Promise<Size> => {
  const result = await Bun.build({ entrypoints: [join(PROBE, "components", file)], minify: true, target: "browser" });
  if (!result.success) throw new AggregateError(result.logs, `build of ${file} failed`);
  return size(await (result.outputs[0] as Blob).text());
};

const main = async () => {
  const rendersAt = process.argv.indexOf("--renders");
  const rendersRun = rendersAt > 0 ? process.argv[rendersAt + 1] : undefined;
  const built = await loadBuild(join(PROBE, "dist"));
  const variants = Object.fromEntries(
    await Promise.all(Object.entries(VARIANTS).map(async ([name, env]) => [name, await buildVariant(name, env)] as const)),
  ) as Record<string, Build>;
  const fixtures = await loadFixtures();
  const renders = async (name: string): Promise<Renders | undefined> => {
    if (!rendersRun) return undefined;
    const file = Bun.file(rendersFile(rendersRun, name));
    return (await file.exists()) ? ((await file.json()) as Renders) : undefined;
  };

  // Boards: srcdoc, and the Snapshot in its two diagram options, in each build.
  const boards = [];
  for (const name of BOARDS) {
    const fixture = fixtures.get(name) as Fixture;
    const svg = await renders(name);
    const hasDiagrams = (fixture.expectDiagrams ?? []).length > 0;
    const row = {
      board: name,
      items: JSON.stringify(fixture.board.items).match(/"type":/g)?.length ?? 0,
      ...Object.fromEntries(
        (["main", ...Object.keys(VARIANTS)] as string[]).map((build) => {
          const b = build === "main" ? built : (variants[build] as Build);
          const srcdoc = view(fixture, b);
          return [
            build,
            {
              srcdoc,
              snapshotChunks: srcdoc,
              snapshotRenders: hasDiagrams ? (svg ? view(fixture, b, svg) : "not measured: no --renders run") : srcdoc,
            },
          ];
        }),
      ),
    };
    boards.push(row);
  }

  // Chunks, beside the group 1 to 4 build; which boards inline each.
  const before = new Map(variants["catch-all"]?.manifest.chunks.map((c) => [c.name, c]));
  const usedBy = (chunk: string) =>
    boards.filter((b) => (b.main as { srcdoc: { chunks: string[] } }).srcdoc.chunks.includes(chunk)).map((b) => b.board);
  const chunks = built.manifest.chunks
    .filter((c) => c.kind !== "probe")
    .map((c) => {
      const old = before.get(c.name);
      return {
        name: c.name,
        kind: c.kind,
        probeOnly: PROBE_ONLY.has(c.name),
        usedBy: usedBy(c.name),
        ...chunkSize(c),
        before: old ? chunkSize(old).total : null,
        largestPackages: c.inputs.packages
          .toSorted((a, b) => b.bytesInOutput - a.bytesInOutput)
          .slice(0, 4)
          .map((p) => ({ name: p.name, version: p.version, bytesInOutput: p.bytesInOutput })),
      };
    });

  // Library chunks against a copy per chunk: each component's copy is its bytes in the `copy`
  // build minus its bytes here.
  const copy = variants.copy as Build;
  const byName = (build: Build) => new Map(build.manifest.chunks.map((c) => [c.name, c]));
  const copyChunks = byName(copy);
  const libraries = built.manifest.chunks
    .filter((c) => c.kind === "library")
    .map((lib) => {
      const users = built.manifest.chunks.filter((c) => c.needs.includes(lib.name) && !PROBE_ONLY.has(c.name));
      const copies = users.map((u) => ({
        chunk: u.name,
        copy: (copyChunks.get(u.name)?.script.bytes ?? 0) - u.script.bytes,
      }));
      return {
        library: lib.name,
        shared: chunkSize(lib).script,
        users: copies,
        copiesTotal: copies.reduce((sum, c) => sum + c.copy, 0),
      };
    });

  const result = {
    date: new Date().toISOString(),
    bun: Bun.version,
    manifest: { builtAt: built.manifest.builtAt, file: "probe/dist/manifest.json" },
    variants: Object.fromEntries(
      Object.entries(VARIANTS).map(([n, env]) => [n, { env, builtAt: variants[n]?.manifest.builtAt }]),
    ),
    renders: rendersRun ?? null,
    note: "srcdoc and Snapshot files without the probe's instrumentation; gzip at level 9 of the whole file",
    boards,
    chunks,
    libraries,
    fonts: { inlined: inlinedFonts(built), design: await designFonts() },
    shims: {
      "_style-shim.ts": await shimSize("_style-shim.ts"),
      "_markup-shim.ts": await shimSize("_markup-shim.ts"),
    },
  };
  await Bun.write(EVIDENCE, `${JSON.stringify(result, null, 2)}\n`);
  print(result);
};

type Result = Record<string, unknown> & {
  boards: Record<string, unknown>[];
  chunks: { name: string; kind: string; probeOnly: boolean; usedBy: string[]; script: Size; style: Size | null; total: Size; before: Size | null }[];
  libraries: { library: string; shared: Size; copiesTotal: number; users: { chunk: string; copy: number }[] }[];
  fonts: { inlined: { chunk: string; faces: number; fonts: Size; style: Size }[]; design: unknown };
};

const print = (r: Result) => {
  const cell = (s: Size | string | undefined) => (typeof s === "object" ? `${mb(s.raw)} / ${mb(s.gzip)}` : String(s));
  console.log("| Chunk | Kind | Script raw / gzip | Style raw / gzip | Total MB raw / gzip | Before, MB raw / gzip | Boards |");
  for (const c of r.chunks.filter((c) => !c.probeOnly)) {
    console.log(
      `| ${c.name} | ${c.kind} | ${c.script.raw} / ${c.script.gzip} | ${c.style ? `${c.style.raw} / ${c.style.gzip}` : "—"} | ${cell(c.total)} | ${c.before ? cell(c.before) : "—"} | ${c.usedBy.join(", ")} |`,
    );
  }
  console.log("\n| Board | Build | srcdoc MB raw / gzip | Snapshot, renderer chunks | Snapshot, renders only |");
  for (const b of r.boards) {
    for (const build of ["main", ...Object.keys(VARIANTS)]) {
      const v = b[build] as { srcdoc: Size; snapshotChunks: Size; snapshotRenders: Size | string };
      console.log(`| ${b.board} | ${build} | ${cell(v.srcdoc)} | ${cell(v.snapshotChunks)} | ${cell(v.snapshotRenders)} |`);
    }
  }
  console.log("\n| Library | Shared chunk, bytes | Copies, bytes | Per user |");
  for (const l of r.libraries) {
    console.log(`| ${l.library} | ${l.shared.raw} | ${l.copiesTotal} | ${l.users.map((u) => `${u.chunk} ${u.copy}`).join(", ")} |`);
  }
  console.log("\nInlined fonts:", r.fonts.inlined.map((f) => `${f.chunk}: ${f.faces} faces, ${kb(f.fonts.raw)} / ${kb(f.fonts.gzip)} KB of a ${kb(f.style.raw)} KB style`).join("; "));
  console.log("DESIGN.md faces:", JSON.stringify(r.fonts.design, null, 1));
  console.log("Shims:", JSON.stringify(r.shims));
};

if (import.meta.main) await main();
