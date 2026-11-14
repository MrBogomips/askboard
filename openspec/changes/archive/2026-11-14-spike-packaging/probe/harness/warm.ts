// Warm starts (task 3.2): the executable already in the cache, so the launcher only execs it.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { freshData, handshake, median, runDir, startServer } from "./lib.ts";

const results = join(runDir("cold"), "results.jsonl");
const data = freshData("cold-warm");
const seed = await startServer({ PORT: "47812", RUN: "cold/warm-seed" });
const first = await handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: seed.url });
await seed.stop();
if (first.instructions) throw new Error(`seeding failed: ${first.instructions}`);
const warm: number[] = [];
for (let i = 0; i < 5; i++) {
  const r = await handshake({ CLAUDE_PLUGIN_DATA: data });
  warm.push(r.initializeMs ?? r.totalMs);
  appendFileSync(results, `${JSON.stringify({ build: "plain", label: "warm", rep: i, ...r })}\n`);
}
console.log(`seed (cold, unthrottled): ${first.initializeMs} ms; warm: median ${median(warm)} ms (${warm.join(", ")})`);
