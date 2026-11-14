// Handshake timer (design decision 5): spawn a command with stdio pipes as Claude Code does, send `initialize`
// and `tools/list`, and print the times to each answer, the server's instructions and the tools, as one JSON line.
// Usage: bun handshake.ts [--timeout-ms N] [--kill-after-init] <command> [args...]
import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
// Options come first; the first argument that is not an option starts the command.
let first = 0;
while (argv[first]?.startsWith("--")) first += argv[first] === "--timeout-ms" ? 2 : 1;
const opts = argv.slice(0, first);
const command = argv.slice(first);
const timeoutMs = Number(opts[opts.indexOf("--timeout-ms") + 1] ?? 0) || 60_000;
const killAfterInit = opts.includes("--kill-after-init");
if (command.length === 0) throw new Error("usage: bun handshake.ts [--timeout-ms N] [--kill-after-init] <command> [args...]");

const t0 = performance.now();
const child = spawn(command[0], command.slice(1), { stdio: ["pipe", "pipe", "pipe"], env: process.env });
const result: Record<string, unknown> = { command: command.join(" "), clientPid: process.pid, serverPid: child.pid };
let stderr = "";
let buffer = "";
let done = false;

function finish(outcome: string): void {
  if (done) return;
  done = true;
  result.outcome = outcome;
  result.totalMs = Math.round(performance.now() - t0);
  result.stderr = stderr.trim().split("\n").slice(-3).join(" | ") || null;
  process.stdout.write(`${JSON.stringify(result)}\n`);
  child.stdin.end();
  setTimeout(() => {
    child.kill("SIGTERM");
    process.exit(0);
  }, 300);
}

function send(message: Record<string, unknown>): void {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

child.stderr.on("data", (chunk: Buffer) => {
  stderr += chunk.toString();
});
child.on("exit", (code, signal) => {
  result.exit = { code, signal, atMs: Math.round(performance.now() - t0) };
  finish(result.initializeMs ? "exited-after-init" : "exited-before-init");
});
child.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines.filter((l) => l.trim())) {
    const message = JSON.parse(line);
    if (message.id === 1) {
      result.initializeMs = Math.round(performance.now() - t0);
      result.serverInfo = message.result?.serverInfo ?? null;
      result.instructions = message.result?.instructions ?? null;
      result.initError = message.error ?? null;
      if (killAfterInit) {
        child.kill("SIGKILL");
        finish("killed-after-init");
        return;
      }
      send({ method: "notifications/initialized" });
      send({ id: 2, method: "tools/list" });
    } else if (message.id === 2) {
      result.toolsMs = Math.round(performance.now() - t0);
      result.tools = (message.result?.tools ?? []).map((t: { name: string }) => t.name);
      finish("ok");
    }
  }
});
setTimeout(() => finish("timeout"), timeoutMs);
send({ id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "handshake-probe", version: "0.0.1" } } });
