// Run `cold` (task 3.2): first start through the launcher on an empty cache, per bandwidth and first-byte delay,
// for the plain and the minified build, then warm starts. The launcher's fetch is capped at 25 s.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { freshData, handshake, MBIT, median, PROBE, runDir, startServer, VERSION } from "./lib.ts";

const dir = runDir("cold");
const results = join(dir, "results.jsonl");
// RERUN (a JSON list of cases) reruns some cases, appending to the results and skipping the warm starts.
const rerun = process.env.RERUN ? (JSON.parse(process.env.RERUN) as Case[]) : undefined;
if (!rerun) writeFileSync(results, "");

// The minified build gets its own release file: same layout, the -min hashes.
const manifest = JSON.parse(readFileSync(join(PROBE, "dist", "manifest.json"), "utf8"));
const minRelease = join(dir, "release-min.txt");
const minLines = [`version ${VERSION}`, "url http://127.0.0.1:47800/askboard/askboard/releases/download"];
for (const f of manifest.files) {
  const m = /^askboard-(.+)-min$/.exec(f.file);
  if (m) minLines.push(`${m[1]} ${f.sha256}`);
}
writeFileSync(minRelease, `${minLines.join("\n")}\n`);

type Case = { build: "plain" | "min"; mbit: number; delay: number; reps: number };
const all: Case[] = [
  { build: "plain", mbit: 0, delay: 0, reps: 5 },
  { build: "plain", mbit: 0, delay: 300, reps: 3 },
  { build: "plain", mbit: 100, delay: 0, reps: 3 },
  { build: "plain", mbit: 100, delay: 300, reps: 1 },
  { build: "plain", mbit: 50, delay: 0, reps: 3 },
  { build: "plain", mbit: 50, delay: 300, reps: 1 },
  { build: "plain", mbit: 30, delay: 0, reps: 1 },
  { build: "plain", mbit: 25, delay: 0, reps: 1 },
  { build: "plain", mbit: 20, delay: 0, reps: 1 },
  { build: "plain", mbit: 10, delay: 0, reps: 1 },
  { build: "plain", mbit: 5, delay: 0, reps: 1 },
  { build: "min", mbit: 0, delay: 0, reps: 3 },
  { build: "min", mbit: 100, delay: 0, reps: 3 },
  { build: "min", mbit: 50, delay: 0, reps: 3 },
];
const cases = rerun ?? all;

for (const c of cases) {
  const label = `${c.build}-${c.mbit || "max"}mbit-${c.delay}ms`;
  const server = await startServer({ RUN: `cold/${label}`, RATE: String(c.mbit * MBIT), DELAY: String(c.delay), SUFFIX: c.build === "min" ? "-min" : "" });
  const times: number[] = [];
  for (let i = 0; i < c.reps; i++) {
    const env: Record<string, string> = { CLAUDE_PLUGIN_DATA: freshData(`cold-${label}-${i}`), ASKBOARD_FETCH_TIMEOUT: "25" };
    if (c.build === "min") env.ASKBOARD_RELEASE_FILE = minRelease;
    const r = await handshake(env, ["--timeout-ms", "40000"]);
    const unavailable = typeof r.instructions === "string" && r.instructions.includes("cannot start");
    appendFileSync(results, `${JSON.stringify({ ...c, label, rep: i, ...r, unavailable })}\n`);
    times.push(r.initializeMs ?? r.totalMs);
    console.log(`${label} rep ${i}: ${r.outcome} init ${r.initializeMs} ms ${unavailable ? "UNAVAILABLE" : ""}`);
  }
  await server.stop();
  console.log(`${label}: median ${median(times)} ms`);
}

if (rerun) process.exit(0);
// Warm: the file is in place, no server needed.
const warmData = freshData("cold-warm");
const seed = await startServer({ RUN: "cold/warm-seed" });
await handshake({ CLAUDE_PLUGIN_DATA: warmData });
await seed.stop();
const warm: number[] = [];
for (let i = 0; i < 5; i++) {
  const r = await handshake({ CLAUDE_PLUGIN_DATA: warmData });
  warm.push(r.initializeMs ?? r.totalMs);
  appendFileSync(results, `${JSON.stringify({ build: "plain", label: "warm", rep: i, ...r })}\n`);
}
console.log(`warm: median ${median(warm)} ms (${warm.join(", ")})`);
