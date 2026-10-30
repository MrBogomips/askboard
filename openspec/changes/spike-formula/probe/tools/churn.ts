// Criterion 7 (design decision 6): API churn of @ironcalc/wasm across its 0.x releases.
// Usage: GITHUB_TOKEN=$(gh auth token) bun tools/churn.ts [--scratch <dir>] [--since YYYY-MM-DD]
// Tarballs are downloaded into the scratch directory, one new directory per version; only
// wasm.d.ts is extracted and read as text. Nothing from a tarball is executed.

import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type GitHubRelease, readChangelog, readReleases } from "./churn-notes.ts";
import { classifyChange, diffSurface, extractSurface, type Surface } from "./dts-surface.ts";

const PACKAGE = "@ironcalc/wasm";
const REGISTRY = `https://registry.npmjs.org/${PACKAGE}`;
const RUN_DATE = "2026-10-30";
const OUT = join(import.meta.dir, "..", "..", "evidence", "churn.json");

// What an adapter calls (design decision 2), plus the types it passes in.
const ADAPTER_KEYS: Record<string, string> = {
  initSync: "function initSync",
  "default init": "default",
  "Model constructor": "Model.constructor",
  setUserInput: "Model.setUserInput",
  evaluate: "Model.evaluate",
  getCellContent: "Model.getCellContent",
  getFormattedCellValue: "Model.getFormattedCellValue",
  getCellType: "Model.getCellType",
  newDefinedName: "Model.newDefinedName",
  isValidDefinedName: "Model.isValidDefinedName",
  updateRangeStyle: "Model.updateRangeStyle",
  pauseEvaluation: "Model.pauseEvaluation",
  resumeEvaluation: "Model.resumeEvaluation",
  "type SyncInitInput": "type SyncInitInput",
  "interface Area": "interface Area",
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return (i >= 0 ? process.argv[i + 1] : undefined) ?? fallback;
}

function semverKey(v: string): number[] {
  return (v.split("-")[0] ?? "").split(".").map(Number);
}

function compareSemver(a: string, b: string): number {
  const [x, y] = [semverKey(a), semverKey(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

function run(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`${cmd.join(" ")}: ${p.stderr.toString()}`);
  return p.stdout.toString();
}

interface VersionMeta {
  version: string;
  date: string;
  tarball: string;
  integrity: string;
}

async function download(meta: VersionMeta, scratch: string): Promise<{ dtsPath: string; dts: string }> {
  const dir = join(scratch, meta.version);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const res = await fetch(meta.tarball);
  if (!res.ok) throw new Error(`${meta.tarball}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const [algo, expected] = meta.integrity.split("-");
  const actual = new Bun.CryptoHasher(algo as "sha512").update(bytes).digest("base64");
  if (actual !== expected) throw new Error(`${meta.version}: integrity mismatch`);
  const tgz = join(dir, "package.tgz");
  await Bun.write(tgz, bytes);
  const entries = run(["tar", "-tzf", tgz]).split("\n");
  const dtsPath = entries.find((e) => e === "package/wasm.d.ts") ?? entries.find((e) => e.endsWith(".d.ts"));
  if (!dtsPath) throw new Error(`${meta.version}: no .d.ts in the tarball`);
  run(["tar", "-xzf", tgz, "-C", dir, dtsPath]);
  return { dtsPath, dts: await Bun.file(join(dir, dtsPath)).text() };
}

// GitHub tags and npm versions do not match one to one: each npm release gets the notes of
// every tag after the previous npm release, up to and including its own version.
function notesFor(version: string, previous: string | null, releases: GitHubRelease[]): GitHubRelease[] {
  return releases.filter((r) => {
    const v = r.tag.replace(/^v/, "");
    return compareSemver(v, version) <= 0 && (previous === null || compareSemver(v, previous) > 0);
  });
}

function adapterChanges(prev: Surface | null, next: Surface) {
  type Change = { method: string; change: string; from: string | null; to: string | null };
  const breaking: Change[] = [];
  const compatible: Change[] = [];
  const added: string[] = [];
  for (const [method, key] of Object.entries(ADAPTER_KEYS)) {
    const before = prev?.exported.get(key) ?? null;
    const after = next.exported.get(key) ?? null;
    if (before === null && after !== null && prev !== null) added.push(method);
    else if (before !== null && after === null) breaking.push({ method, change: "removed", from: before, to: null });
    else if (before !== null && after !== null && before !== after) {
      const c = classifyChange(before, after);
      (c.breaking ? breaking : compatible).push({ method, change: c.reason, from: before, to: after });
    }
  }
  return { breaking, compatible, added };
}

async function main(): Promise<void> {
  const scratch = arg("--scratch", join(tmpdir(), "askboard-spike-formula-churn"));
  const since = arg("--since", "2025-10-30");
  const token = process.env.GITHUB_TOKEN;
  const reg = (await (await fetch(REGISTRY)).json()) as {
    time: Record<string, string>;
    versions: Record<string, { dist: { tarball: string; integrity: string } }>;
  };
  const metas: VersionMeta[] = Object.entries(reg.versions)
    .filter(([v]) => v.startsWith("0."))
    .map(([version, m]) => ({ version, date: reg.time[version] ?? "", tarball: m.dist.tarball, integrity: m.dist.integrity }))
    .sort((a, b) => compareSemver(a.version, b.version));
  const [releases, changelog] = await Promise.all([readReleases(token), readChangelog(token)]);

  const rows = [];
  let prev: Surface | null = null;
  let prevVersion: string | null = null;
  for (const meta of metas) {
    const { dtsPath, dts } = await download(meta, scratch);
    const surface = extractSurface(dts);
    const diff = prev ? diffSurface(prev.exported, surface.exported) : { added: [], removed: [], changed: [] };
    const localDiff = prev ? diffSurface(prev.local, surface.local) : { added: [], removed: [], changed: [] };
    const adapter = adapterChanges(prev, surface);
    const notes = notesFor(meta.version, prevVersion, releases);
    rows.push({
      version: meta.version,
      date: meta.date,
      tarball: meta.tarball,
      dtsPath,
      baseline: prev === null,
      exportedCount: surface.exported.size,
      localCount: surface.local.size,
      initOutputMembers: surface.initOutputMembers,
      added: diff.added,
      removed: diff.removed,
      changed: diff.changed.map((c) => ({ ...c, ...classifyChange(c.from, c.to) })),
      localTypes: {
        added: localDiff.added,
        removed: localDiff.removed,
        changed: localDiff.changed.map((c) => c.key),
      },
      adapterBreaking: adapter.breaking,
      adapterCompatible: adapter.compatible,
      adapterAdded: adapter.added,
      adapterPresent: Object.fromEntries(
        Object.entries(ADAPTER_KEYS).map(([m, k]) => [m, surface.exported.get(k) ?? null]),
      ),
      notes: notes.map((r) => ({ tag: r.tag, publishedAt: r.publishedAt, url: r.url, apiLines: r.apiLines })),
    });
    prev = surface;
    prevVersion = meta.version;
  }

  const recent = rows.filter((r) => r.date.slice(0, 10) >= since);
  const report = {
    generatedAt: new Date().toISOString(),
    runDate: RUN_DATE,
    package: PACKAGE,
    sources: {
      registry: REGISTRY,
      releases: "https://api.github.com/repos/ironcalc/IronCalc/releases?per_page=100",
      changelog: "https://api.github.com/repos/ironcalc/IronCalc/contents/CHANGELOG.md",
      changelogHistory: "https://api.github.com/repos/ironcalc/IronCalc/commits?path=CHANGELOG.md",
    },
    method:
      "Exported declarations of each release's wasm.d.ts, whitespace-normalised, diffed against the previous 0.x release. " +
      "InitOutput (raw WebAssembly exports) is excluded; non-exported types are reported apart under localTypes. " +
      "A changed callable is breaking when a required parameter is added, a parameter removed, an accepted type " +
      "dropped or the return type changed; renamed parameters and widened types are compatible. " +
      "A changed type or interface is counted as breaking without further analysis.",
    adapterMethods: ADAPTER_KEYS,
    changelog: {
      presentOnMain: changelog.presentOnMain,
      history: changelog.history,
      lastContentRef: changelog.lastContentRef,
      lastContent: changelog.lastContent,
    },
    releases: rows,
    summary: {
      since,
      releasesTotal: rows.length,
      releasesLast12Months: recent.length,
      releasesWithAdapterBreakingLast12Months: recent.filter((r) => r.adapterBreaking.length > 0).length,
      breakingLast12Months: recent.reduce((n, r) => n + r.adapterBreaking.length, 0),
      exportedRemovedLast12Months: recent.reduce((n, r) => n + r.removed.length, 0),
      exportedChangedLast12Months: recent.reduce((n, r) => n + r.changed.length, 0),
      exportedChangedBreakingLast12Months: recent.reduce((n, r) => n + r.changed.filter((c) => c.breaking).length, 0),
      adapterCompatibleChangesLast12Months: recent.reduce((n, r) => n + r.adapterCompatible.length, 0),
    },
  };
  await Bun.write(OUT, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`${PACKAGE}: ${rows.length} 0.x releases; wrote ${OUT}`);
  console.log("version\tdate\texported\t+added\t-removed\t~changed\tadapter breaking\tadapter compatible\tadapter added");
  for (const r of rows) {
    const mark = r.date.slice(0, 10) >= since ? "*" : " ";
    const brk = r.adapterBreaking.map((b) => `${b.method} (${b.change})`).join(", ") || "-";
    const compat = r.adapterCompatible.map((b) => b.method).join(", ") || "-";
    console.log(
      `${mark}${r.version}\t${r.date.slice(0, 10)}\t${r.exportedCount}\t${r.added.length}\t${r.removed.length}\t${r.changed.length}\t${brk}\t${compat}\t${r.adapterAdded.join(", ") || "-"}`,
    );
  }
  console.log(`* = published on or after ${since}`, report.summary);
}

await main();
