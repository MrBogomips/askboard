// Build (design decision 2): six compiled targets, plain and minified, and the plain bundle for Node.
// Writes dist/manifest.json with raw and gzip bytes and the SHA-256 of each file.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-linux-x64-musl",
  "bun-linux-arm64-musl",
] as const;

const dist = join(import.meta.dir, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

function run(args: string[]): number {
  const started = performance.now();
  const proc = Bun.spawnSync(["bun", "build", ...args], { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(`bun build ${args.join(" ")}: ${proc.stderr.toString()}`);
  return Math.round(performance.now() - started);
}

function describe(file: string, buildMs: number) {
  const bytes = readFileSync(join(dist, file));
  return {
    file,
    raw: statSync(join(dist, file)).size,
    gzip: gzipSync(bytes, { level: 9 }).length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    buildMs,
  };
}

const files = [];
for (const target of TARGETS) {
  for (const minify of [false, true]) {
    const name = `askboard-${target.slice(4)}${minify ? "-min" : ""}`;
    const ms = run(["server.ts", "--compile", `--target=${target}`, ...(minify ? ["--minify"] : []), "--outfile", join(dist, name)]);
    files.push(describe(name, ms));
  }
}
const bundleMs = run(["server.ts", "--target=node", "--minify", "--outfile", join(dist, "askboard.mjs")]);
files.push(describe("askboard.mjs", bundleMs));

const manifest = { bun: Bun.version, builtAt: new Date().toISOString(), files };
writeFileSync(join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
for (const f of files) console.log(`${f.file.padEnd(32)} ${String(f.raw).padStart(10)} raw ${String(f.gzip).padStart(10)} gzip ${f.buildMs} ms`);
