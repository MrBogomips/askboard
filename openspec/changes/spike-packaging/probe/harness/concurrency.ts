// Run `concurrency` (task 3.3): 8 launchers and a probe sibling on one empty cache; a launcher killed mid-download
// (SIGKILL, then SIGTERM) and the next start; and the lock-free control.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { downloads, freshData, handshake, LAUNCHER, MBIT, PROBE, runDir, startServer, VERSION } from "./lib.ts";

const dir = runDir("concurrency");
const release = readFileSync(join(PROBE, "plugin", "scripts", "release.txt"), "utf8");
const expected = /^darwin-arm64 (\S+)$/m.exec(release)?.[1];
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const leftovers = (data: string) => (existsSync(join(data, "bin", VERSION)) ? readdirSync(join(data, "bin", VERSION), { withFileTypes: true }).map((e) => e.name) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const curlsFor = (port: number) => {
  const out = Bun.spawnSync(["pgrep", "-fl", `curl.*127.0.0.1:${port}`]).stdout.toString().trim();
  return out ? out.split("\n") : [];
};
const report: Record<string, unknown> = {};

async function parallel(label: string, port: number, launcher: string, extraEnv: Record<string, string> = {}) {
  const server = await startServer({ PORT: String(port), RUN: `concurrency/${label}`, RATE: String(50 * MBIT) });
  const data = freshData(`concurrency-${label}`);
  const probeLog = join(dir, `${label}-probe.jsonl`);
  writeFileSync(probeLog, "");
  const env = {
    CLAUDE_PLUGIN_DATA: data,
    ASKBOARD_PROBE_LOG: probeLog,
    ASKBOARD_RELEASE_URL: server.url,
    ASKBOARD_FETCH_TIMEOUT: "25",
    ...extraEnv,
  };
  const runs = [...Array(8)].map(() => handshake(env, ["--timeout-ms", "60000"], [launcher]));
  runs.push(handshake(env, ["--timeout-ms", "60000", "--kill-after-init"], [launcher]));
  const results = await Promise.all(runs);
  await server.stop();
  const starts = readFileSync(probeLog, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.kind === "start");
  const bin = join(data, "bin", VERSION, "askboard");
  report[label] = {
    outcomes: results.map((r) => `${r.outcome}${r.instructions ? " (unavailable)" : ""} ${r.initializeMs ?? r.totalMs} ms`),
    downloads: downloads(`concurrency/${label}`),
    serverStarts: starts.length,
    parentIsClient: starts.every((s) => results.some((r) => r.clientPid === s.ppid)),
    binSha256Matches: existsSync(bin) && sha(bin) === expected,
    leftInVersionDir: leftovers(data),
  };
  console.log(label, JSON.stringify(report[label]));
}

async function killed(label: string, port: number, signal: "SIGKILL" | "SIGTERM") {
  const server = await startServer({ PORT: String(port), RUN: `concurrency/${label}`, RATE: String(20 * MBIT) });
  const data = freshData(`concurrency-${label}`);
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url, ASKBOARD_FETCH_TIMEOUT: "60" };
  const victim = Bun.spawn([LAUNCHER], { env, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  await sleep(3000);
  const before = leftovers(data);
  victim.kill(signal);
  await sleep(500);
  const orphanCurls = curlsFor(port);
  const afterKill = leftovers(data);
  const lockPid = existsSync(join(data, "bin", VERSION, ".lock", "pid")) ? readFileSync(join(data, "bin", VERSION, ".lock", "pid"), "utf8").trim() : null;
  const next = await handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url, ASKBOARD_FETCH_TIMEOUT: "60" }, ["--timeout-ms", "90000"]);
  const bin = join(data, "bin", VERSION, "askboard");
  report[label] = {
    victimPid: victim.pid,
    duringDownload: before,
    afterKill,
    lockPidAfterKill: lockPid,
    orphanCurlsAfterKill: orphanCurls,
    next: `${next.outcome}${next.instructions ? ` (${next.instructions})` : ""} ${next.initializeMs ?? next.totalMs} ms`,
    downloads: downloads(`concurrency/${label}`),
    binSha256Matches: existsSync(bin) && sha(bin) === expected,
    leftInVersionDir: leftovers(data),
    orphanCurlsAtEnd: curlsFor(port),
  };
  // Stop any orphaned download this run left, so nothing keeps running.
  for (const line of curlsFor(port)) process.kill(Number(line.split(" ")[0]), "SIGKILL");
  await server.stop();
  console.log(label, JSON.stringify(report[label]));
}

// The lock-free control: the same launcher without the lock loop.
const noLock = join(import.meta.dir, "askboard-nolock");
const source = readFileSync(LAUNCHER, "utf8");
const start = source.indexOf("# Lock: mkdir is atomic.");
const end = source.indexOf("# Remove partial files");
writeFileSync(noLock, `${source.slice(0, start)}LOCKED=0\nwaited=0\n${source.slice(end)}`, { mode: 0o755 });

await parallel("locked", 47802, LAUNCHER);
await killed("sigkill", 47803, "SIGKILL");
await killed("sigterm", 47804, "SIGTERM");
await parallel("lock-free", 47805, noLock, { ASKBOARD_RELEASE_FILE: join(PROBE, "plugin", "scripts", "release.txt") });
writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
