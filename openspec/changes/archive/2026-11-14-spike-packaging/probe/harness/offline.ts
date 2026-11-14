// Runs `offline` (task 3.4), `failures` (task 3.5), `parent` (task 3.6) and `windows-sim` (task 3.7).
// Usage: bun harness/offline.ts <offline|failures|parent|windows-sim>
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { downloads, freshData, handshake, LAUNCHER, PROBE, runDir, startServer, VERSION } from "./lib.ts";

const which = process.argv[2] ?? "offline";
const dir = runDir(which);
const results = join(dir, "results.jsonl");
writeFileSync(results, "");
const record = (label: string, r: unknown) => {
  writeFileSync(results, `${JSON.stringify({ label, ...(r as object) })}\n`, { flag: "a" });
  console.log(label, JSON.stringify(r));
};
const cacheDir = (data: string) => join(data, "bin", VERSION);
const leftovers = (data: string) => (existsSync(cacheDir(data)) ? readdirSync(cacheDir(data)) : []);
const NODE24 = join(homedir(), ".volta/tools/image/node/24.22.2/bin/node");
const DEAD = "http://127.0.0.1:47819/askboard/askboard/releases/download"; // nothing listens there

async function offline() {
  let data = freshData("offline-empty");
  record("server-down-empty-cache", { ...(await handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: DEAD })), left: leftovers(data) });

  data = freshData("offline-seeded");
  mkdirSync(cacheDir(data), { recursive: true });
  copyFileSync(join(PROBE, "dist", "askboard-darwin-arm64"), join(cacheDir(data), "askboard"));
  record("server-down-seeded-cache", await handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: DEAD }));

  // A mirror as a file:// tree with the release layout.
  const mirror = join(dir, "mirror");
  mkdirSync(join(mirror, `v${VERSION}`), { recursive: true });
  copyFileSync(join(PROBE, "dist", "askboard-darwin-arm64"), join(mirror, `v${VERSION}`, "askboard-darwin-arm64"));
  data = freshData("offline-file-mirror");
  record("file-mirror", { ...(await handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: `file://${mirror}` })), left: leftovers(data) });

  // A mirror as a second HTTP server, as an organization's artifact proxy would be.
  const server = await startServer({ PORT: "47806", RUN: "offline/http-mirror" });
  data = freshData("offline-http-mirror");
  record("http-mirror", { ...(await handshake({ CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url })), downloads: downloads("offline/http-mirror") });
  await server.stop();

  record("node-bundle-24.22.2", await handshake({}, [], [NODE24, join(PROBE, "dist", "askboard.mjs")]));
}

async function failures() {
  const faults = ["404", "truncate", "corrupt", "hang"];
  for (const [i, fault] of faults.entries()) {
    const port = String(47807 + i);
    const server = await startServer({ PORT: port, RUN: `failures/${fault}`, FAULT: fault });
    for (const onFailure of ["answer", "exit"]) {
      const data = freshData(`failures-${fault}-${onFailure}`);
      const r = await handshake(
        { CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url, ASKBOARD_FETCH_TIMEOUT: "25", ASKBOARD_LAUNCHER_ON_FAILURE: onFailure },
        ["--timeout-ms", "40000"],
      );
      record(`${fault}-${onFailure}`, { ...r, left: leftovers(data) });
    }
    await server.stop();
  }
  // No curl or wget: a PATH holding only the other tools the launcher uses.
  const bin = join(dir, "path-without-download-tools");
  mkdirSync(bin, { recursive: true });
  for (const tool of ["sh", "uname", "sed", "cut", "mkdir", "cat", "rm", "mv", "chmod", "dirname", "sleep", "shasum", "perl"]) {
    const found = Bun.spawnSync(["sh", "-c", `command -v ${tool}`]).stdout.toString().trim();
    if (found && !existsSync(join(bin, tool))) symlinkSync(found, join(bin, tool));
  }
  for (const onFailure of ["answer", "exit"]) {
    const data = freshData(`failures-no-tool-${onFailure}`);
    const r = await handshake({ PATH: bin, CLAUDE_PLUGIN_DATA: data, ASKBOARD_LAUNCHER_ON_FAILURE: onFailure }, ["--timeout-ms", "40000"]);
    record(`no-download-tool-${onFailure}`, { ...r, left: leftovers(data) });
  }
}

async function parent() {
  const probeLog = join(dir, "probe.jsonl");
  writeFileSync(probeLog, "");
  const server = await startServer({ PORT: "47811", RUN: "parent" });
  const data = freshData("parent");
  const env = { CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: server.url, ASKBOARD_PROBE_LOG: probeLog };
  const cold = await handshake(env);
  const warm = await handshake(env);
  const starts = readFileSync(probeLog, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((e) => e.kind === "start");
  record("cold-fetch", { clientPid: cold.clientPid, launcherPid: cold.serverPid, serverPpid: starts[0]?.ppid, serverPid: starts[0]?.pid, execPath: starts[0]?.execPath });
  record("warm", { clientPid: warm.clientPid, launcherPid: warm.serverPid, serverPpid: starts[1]?.ppid, serverPid: starts[1]?.pid });
  // Hook mode with no executable: exit 0, one stderr line, no fetch.
  const before = downloads("parent");
  const hookData = freshData("parent-hook");
  const hook = Bun.spawnSync([LAUNCHER, "hook", "PostToolUse"], {
    env: { ...process.env, CLAUDE_PLUGIN_DATA: hookData, ASKBOARD_RELEASE_URL: server.url },
    stdin: new TextEncoder().encode("{}"),
  });
  record("hook-no-executable", { exit: hook.exitCode, stderr: hook.stderr.toString().trim().split("\n"), stdout: hook.stdout.toString(), requestsBefore: before, requestsAfter: downloads("parent"), left: leftovers(hookData) });
  // Hook mode with the executable in place: the executable's hook mode runs (exit 0, no decision).
  const hookWarm = Bun.spawnSync([LAUNCHER, "hook", "PostToolUse"], { env: { ...process.env, ...env }, stdin: new TextEncoder().encode("{}") });
  record("hook-with-executable", { exit: hookWarm.exitCode, stderr: hookWarm.stderr.toString().trim(), stdout: hookWarm.stdout.toString() });
  await server.stop();
}

async function windowsSim() {
  for (const name of ["MINGW64_NT-10.0-26100", "MSYS_NT-10.0-26100", "CYGWIN_NT-10.0-26100"]) {
    const shim = join(dir, name);
    mkdirSync(shim, { recursive: true });
    writeFileSync(join(shim, "uname"), `#!/bin/sh\ncase "$1" in -s) echo ${name} ;; -m) echo x86_64 ;; *) echo ${name} ;; esac\n`, { mode: 0o755 });
    const data = freshData(`windows-${name}`);
    record(name, { ...(await handshake({ PATH: `${shim}:${process.env.PATH}`, CLAUDE_PLUGIN_DATA: data, ASKBOARD_RELEASE_URL: DEAD })), left: leftovers(data) });
  }
}

const runs: Record<string, () => Promise<void>> = { offline, failures, parent, "windows-sim": windowsSim };
await runs[which]();
