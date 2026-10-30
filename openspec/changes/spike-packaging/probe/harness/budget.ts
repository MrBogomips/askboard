// Run `budget` (task 3.3, after the launcher change): one budget for the lock wait and the download.
// A holder whose download cannot finish in 25 s, and a waiter started 1 s later, must both answer within 30 s;
// then 3 launchers at once at 50 Mbit/s still share one download.
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { downloads, freshData, handshake, MBIT, runDir, startServer } from "./lib.ts";

const results = join(runDir("budget"), "results.jsonl");
writeFileSync(results, "");
const record = (label: string, r: object) => {
  appendFileSync(results, `${JSON.stringify({ label, ...r })}\n`);
  console.log(label, JSON.stringify(r).slice(0, 400));
};

let server = await startServer({ PORT: "47813", RUN: "budget/slow", RATE: String(20 * MBIT) });
let data = freshData("budget-slow");
const holder = handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url }, ["--timeout-ms", "60000"]);
await new Promise((r) => setTimeout(r, 1000));
const waiter = handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url }, ["--timeout-ms", "60000"]);
const [h, w] = await Promise.all([holder, waiter]);
record("holder", { ms: h.initializeMs ?? h.totalMs, instructions: h.instructions });
record("waiter-started-1s-later", { ms: (w.initializeMs ?? w.totalMs) + 1000, instructions: w.instructions });
await server.stop();

server = await startServer({ PORT: "47814", RUN: "budget/shared", RATE: String(50 * MBIT) });
data = freshData("budget-shared");
const three = await Promise.all([0, 1, 2].map(() => handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url }, ["--timeout-ms", "60000"])));
record("three-at-once-50mbit", { outcomes: three.map((r) => `${r.outcome} ${r.initializeMs} ms ${r.instructions ? "unavailable" : ""}`), downloads: downloads("budget/shared") });
await server.stop();
