// `bun run build` (design decision 3): every chunk as a classic IIFE script, its stylesheet,
// and dist/manifest.json with each chunk's SHA-256, raw and gzip bytes, the chunks it needs,
// the components it registers, its inputs and its licence notices (AD-9).

import { mkdir, readdir, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { BunPlugin } from "bun";

const PROBE = import.meta.dir;
const DIST = join(PROBE, "dist");
const DESIGN = resolve(PROBE, "../../../../docs/ux-askboard-2026-10-27/DESIGN.md");
const PORT_FILE = join(PROBE, "port/index.ts");
const TAILWIND = join(PROBE, "node_modules/@tailwindcss/cli/dist/index.mjs");

export type Kind = "probe" | "shell" | "library" | "renderer" | "component";
type ChunkDef = { name: string; kind: Kind; entry: string };

export type Asset = { file: string; sha256: string; bytes: number; gzip: number };
// `bytes`: the package's source bytes read; `bytesInOutput`: what it adds to the minified chunk.
export type PackageInput = {
  name: string;
  version: string;
  licence: string;
  bytes: number;
  bytesInOutput: number;
};
export type Chunk = {
  name: string;
  kind: Kind;
  needs: string[];
  components: string[];
  script: Asset;
  style: Asset | null;
  inputs: { local: string[]; localBytesInOutput: number; packages: PackageInput[] };
  notices: string;
  escapedScriptEnds: number;
};
export type Manifest = { builtAt: string; bun: string; chunks: Chunk[] };

// Modules the shell exposes on `__askboard.modules`, and the library chunks with the names
// their components use. Code used by more than one component lives in a library chunk.
const SHELL_MODULES = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];
export const LIBRARIES: Record<string, { module: string; names: string[] }> = {
  "lib-radix": { module: "radix-ui", names: ["Checkbox", "RadioGroup", "Switch", "Tabs"] },
};

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const sha256 = (text: string): string =>
  new Bun.CryptoHasher("sha256").update(text).digest("base64");

const asset = (file: string, text: string): Asset => ({
  file,
  sha256: sha256(text),
  bytes: Buffer.byteLength(text),
  gzip: Bun.gzipSync(Buffer.from(text), { level: 9 }).byteLength,
});

// Maps imports of shared modules to the global, and records which chunks they come from.
const globals = (own: string, needs: Set<string>): BunPlugin => ({
  name: "askboard-globals",
  setup(build) {
    const provider = new Map<string, string>(SHELL_MODULES.map((m) => [m, "shell"]));
    for (const [chunk, library] of Object.entries(LIBRARIES)) provider.set(library.module, chunk);
    build.onResolve({ filter: /.*/ }, (args) => {
      const chunk = provider.get(args.path);
      if (chunk && chunk !== own) {
        needs.add(chunk);
        return { path: args.path, namespace: "askboard-global" };
      }
      const isPort =
        args.path.startsWith(".") && resolve(dirname(args.importer), args.path) === PORT_FILE;
      if (isPort && own !== "shell") {
        needs.add("shell");
        return { path: "port", namespace: "askboard-global" };
      }
      return undefined;
    });
    build.onLoad({ filter: /.*/, namespace: "askboard-global" }, (args) => ({
      contents: `module.exports = globalThis.__askboard.modules[${JSON.stringify(args.path)}];`,
      loader: "js",
    }));
  },
});

const definitions = async (): Promise<ChunkDef[]> => {
  const entries = join(DIST, ".entries");
  await mkdir(entries, { recursive: true });
  const libraries = await Promise.all(
    Object.entries(LIBRARIES).map(async ([name, { module, names }]) => {
      const entry = join(entries, `${name}.ts`);
      const list = names.join(", ");
      await Bun.write(
        entry,
        `import { ${list} } from ${JSON.stringify(module)};\n` +
          `(globalThis as any).__askboard.modules[${JSON.stringify(module)}] = { ${list} };\n`,
      );
      return { name, kind: "library" as const, entry };
    }),
  );
  const tsx = async (dir: string) =>
    (await readdir(join(PROBE, dir))).filter((f) => f.endsWith(".tsx") && !f.startsWith("_"));
  const renderers = (await tsx("renderers")).map((file) => ({
    name: `renderer-${basename(file, ".tsx")}`,
    kind: "renderer" as const,
    entry: join(PROBE, "renderers", file),
  }));
  const components = (await tsx("components")).map((file) => ({
    name: basename(file, ".tsx"),
    kind: "component" as const,
    entry: join(PROBE, "components", file),
  }));
  return [
    { name: "instrument", kind: "probe", entry: join(PROBE, "shell/instrument.ts") },
    { name: "shell", kind: "shell", entry: join(PROBE, "shell/shell.tsx") },
    ...libraries,
    ...renderers,
    ...components,
  ];
};

// Inline scripts end at the first `</script`; in a string or regex `<\/script` is the same text.
const escapeScriptEnds = (code: string): { code: string; count: number } => {
  let count = 0;
  const escaped = code.replace(/<\/(script)/gi, (_, word: string) => {
    count += 1;
    return `<\\/${word}`;
  });
  if (/<!--/.test(escaped)) throw new Error("a chunk contains `<!--`, which changes script parsing");
  return { code: escaped, count };
};

type Tokens = {
  colors: Record<string, string>;
  typography: Record<string, Record<string, string>>;
  rounded: Record<string, string>;
};

// DESIGN.md's tokens, light and `-dark`, as CSS variables with the `.dark` switch, and the
// Tailwind theme that maps utilities onto them.
const writeTokens = async (): Promise<void> => {
  const front = (await Bun.file(DESIGN).text()).split(/^---$/m)[1] ?? "";
  const { colors, typography, rounded } = Bun.YAML.parse(front) as Tokens;
  const light = Object.keys(colors).filter((key) => !key.endsWith("-dark"));
  const variables = (suffix: string) =>
    light
      .filter((key) => colors[`${key}${suffix}`])
      .map((key) => `--${key}:${colors[`${key}${suffix}`]};`)
      .join("");
  await Bun.write(
    join(DIST, "tokens.css"),
    `:root{${variables("")}--ab-font-sans:${SANS};--ab-font-mono:${MONO};color-scheme:light}` +
      `.dark{${variables("-dark")}color-scheme:dark}\n`,
  );
  const text = Object.entries(typography)
    .filter(([key]) => !key.endsWith("-comfortable"))
    .map(
      ([key, t]) =>
        `--text-${key}:${t.fontSize};--text-${key}--line-height:${t.lineHeight};` +
        `--text-${key}--font-weight:${t.fontWeight};` +
        (t.letterSpacing ? `--text-${key}--letter-spacing:${t.letterSpacing};` : ""),
    )
    .join("");
  const radius = Object.entries(rounded)
    .filter(([key]) => key !== "full")
    .map(([key, value]) => `--radius-${key}:${value};`)
    .join("");
  await Bun.write(
    join(DIST, "theme.css"),
    `@theme inline{--color-*:initial;${light.map((k) => `--color-${k}:var(--${k});`).join("")}` +
      `--font-sans:var(--ab-font-sans);--font-mono:var(--ab-font-mono);${text}${radius}}\n`,
  );
};

// Each chunk's stylesheet holds only the utilities its own sources use.
const tailwind = async (name: string, sources: string[], shell: boolean): Promise<string> => {
  const dir = join(DIST, ".tw");
  await mkdir(dir, { recursive: true });
  const input = join(dir, `${name}.css`);
  const lines = [
    "@layer theme, base, components, utilities;",
    '@import "tailwindcss/theme.css" layer(theme);',
    ...(shell
      ? [
          '@import "tailwindcss/preflight.css" layer(base);',
          '@import "../tokens.css";',
          `@import ${JSON.stringify(join(PROBE, "styles/base.css"))};`,
        ]
      : []),
    '@import "tailwindcss/utilities.css" layer(utilities) source(none);',
    '@import "../theme.css";',
    ...sources.map((source) => `@source ${JSON.stringify(source)};`),
  ];
  await Bun.write(input, `${lines.join("\n")}\n`);
  const output = join(dir, `${name}.out.css`);
  const run = Bun.spawnSync([process.execPath, TAILWIND, "-i", input, "-o", output, "--minify"], {
    cwd: dir,
    stderr: "pipe",
  });
  if (run.exitCode !== 0) throw new Error(`tailwind ${name}: ${run.stderr.toString()}`);
  return (await Bun.file(output).text()).trim();
};

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i;

const packageOf = (file: string): { name: string; dir: string } | null => {
  const match = [...file.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)\//g)].at(-1);
  if (!match || match.index === undefined) return null;
  return { name: match[1] as string, dir: file.slice(0, match.index + match[0].length - 1) };
};

type Notice = PackageInput & { text: string };

const noticesOf = async (
  inputs: Record<string, { bytes: number }>,
  inOutput: Record<string, number>,
): Promise<Notice[]> => {
  const found = new Map<string, Notice>();
  for (const [file, { bytes }] of Object.entries(inputs)) {
    const pkg = packageOf(resolve(file));
    if (!pkg) continue;
    const existing = found.get(pkg.dir);
    if (existing) {
      existing.bytes += bytes;
      existing.bytesInOutput += inOutput[file] ?? 0;
      continue;
    }
    const manifest = await Bun.file(join(pkg.dir, "package.json")).json();
    const licence =
      typeof manifest.license === "string" ? manifest.license : (manifest.license?.type ?? "none");
    const files = (await readdir(pkg.dir)).filter((f) => LICENCE_FILE.test(f)).sort();
    const texts = await Promise.all(files.map((f) => Bun.file(join(pkg.dir, f)).text()));
    found.set(pkg.dir, {
      name: pkg.name,
      version: manifest.version,
      licence,
      bytes,
      bytesInOutput: inOutput[file] ?? 0,
      text: texts.join("\n\n") || `(no licence file; package.json says ${licence})`,
    });
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const typesOf = (sources: string[]): Promise<string[]> =>
  Promise.all(sources.map((s) => Bun.file(s).text())).then((texts) =>
    texts.flatMap((t) => [...t.matchAll(/\bregister\(\s*"([A-Za-z0-9]+)"/g)].map((m) => m[1] as string)),
  );

const buildChunk = async (def: ChunkDef): Promise<Chunk> => {
  const needs = new Set<string>();
  const result = await Bun.build({
    entrypoints: [def.entry],
    format: "iife",
    target: "browser",
    minify: true,
    metafile: true,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [globals(def.name, needs)],
  });
  if (!result.success) throw new AggregateError(result.logs, `build of ${def.name} failed`);
  const script = result.outputs.find((o) => o.kind === "entry-point");
  if (!script) throw new Error(`build of ${def.name}: no script output`);
  const { code, count } = escapeScriptEnds(await script.text());
  const metaInputs = (result.metafile?.inputs ?? {}) as Record<string, { bytes: number }>;
  const files = Object.keys(metaInputs).filter((f) => !f.includes("askboard-global:"));
  const local = files.map((f) => resolve(f)).filter((f) => !f.includes("/node_modules/"));
  const inputs = Object.fromEntries(files.map((f) => [f, metaInputs[f] as { bytes: number }]));
  const outputs = (result.metafile?.outputs ?? {}) as Record<
    string,
    { inputs?: Record<string, { bytesInOutput: number }> }
  >;
  const inOutput: Record<string, number> = {};
  for (const output of Object.values(outputs)) {
    for (const [file, { bytesInOutput }] of Object.entries(output.inputs ?? {})) {
      inOutput[file] = (inOutput[file] ?? 0) + bytesInOutput;
    }
  }
  const notices = await noticesOf(inputs, inOutput);
  const localBytesInOutput = files
    .filter((f) => !resolve(f).includes("/node_modules/"))
    .reduce((sum, f) => sum + (inOutput[f] ?? 0), 0);

  const libraryCss = await Promise.all(
    result.outputs.filter((o) => o.path.endsWith(".css")).map((o) => o.text()),
  );
  const tailwindCss =
    def.kind === "probe" || def.kind === "library"
      ? ""
      : await tailwind(def.name, def.kind === "shell" ? [...local] : local, def.kind === "shell");
  // A stylesheet with no rule (only Tailwind's banner and layer order) is left out.
  const css = [...libraryCss, tailwindCss].filter((sheet) => sheet.includes("{")).join("\n");
  if (/<\/style/i.test(css)) throw new Error(`${def.name}: the stylesheet contains </style`);

  await Bun.write(join(DIST, "chunks", `${def.name}.js`), code);
  if (css) await Bun.write(join(DIST, "chunks", `${def.name}.css`), css);
  const noticeText = notices
    .map((n) => `${n.name}@${n.version} (${n.licence})\n\n${n.text.trim()}\n`)
    .join("\n----------------------------------------\n\n");
  await Bun.write(join(DIST, "notices", `${def.name}.txt`), noticeText || "(no third-party code)\n");
  needs.delete(def.name);
  return {
    name: def.name,
    kind: def.kind,
    needs: [...needs].sort(),
    components: def.kind === "component" ? await typesOf(local) : [],
    script: asset(`chunks/${def.name}.js`, code),
    style: css ? asset(`chunks/${def.name}.css`, css) : null,
    inputs: {
      local: local.map((f) => relative(PROBE, f)).sort(),
      localBytesInOutput,
      packages: notices.map(({ text: _, ...rest }) => rest),
    },
    notices: `notices/${def.name}.txt`,
    escapedScriptEnds: count,
  };
};

const main = async (): Promise<void> => {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await writeTokens();
  const chunks: Chunk[] = [];
  for (const def of await definitions()) chunks.push(await buildChunk(def));
  const owners = new Map<string, string>();
  for (const chunk of chunks) {
    for (const type of chunk.components) {
      const owner = owners.get(type);
      if (owner) throw new Error(`component ${type} registered by ${owner} and ${chunk.name}`);
      owners.set(type, chunk.name);
    }
  }
  const manifest: Manifest = { builtAt: new Date().toISOString(), bun: Bun.version, chunks };
  await Bun.write(join(DIST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const c of chunks) {
    const style = c.style ? ` css ${c.style.bytes}/${c.style.gzip}` : "";
    console.log(
      `${c.kind.padEnd(9)} ${c.name.padEnd(22)} js ${c.script.bytes}/${c.script.gzip}${style}` +
        `  needs ${c.needs.join(",") || "-"}  ${c.components.join(",")}`,
    );
  }
};

if (import.meta.main) await main();
