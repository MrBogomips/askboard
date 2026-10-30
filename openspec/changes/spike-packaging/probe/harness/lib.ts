// Shared helpers for the launcher runs (tasks 3.2 to 3.7): a release-server stand-in per case, and handshakes.
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export const PROBE = join(import.meta.dir, "..");
export const LAUNCHER = join(PROBE, "plugin", "scripts", "askboard");
export const SCRATCH = "/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard--claude-worktrees-feature-spike-mod-delivery/50fdda78-5b18-488d-8821-6ced6d989c7e/scratchpad/pkg";
export const VERSION = "0.0.1-spike";
export const MBIT = 125_000; // bytes per second in one Mbit/s

export type Handshake = {
  outcome: string;
  totalMs: number;
  initializeMs?: number;
  instructions?: string | null;
  tools?: string[];
  exit?: { code: number | null; signal: string | null; atMs: number };
  stderr?: string | null;
  clientPid: number;
  serverPid: number;
};

export function runDir(run: string): string {
  const dir = join(PROBE, "runs", run);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function freshData(name: string): string {
  const dir = join(SCRATCH, `data-${name}`);
  rmSync(dir, { recursive: true, force: true });
  return dir;
}

// Starts release-server.ts with the given settings; never rewrites plugin/scripts/release.txt.
export async function startServer(env: Record<string, string>): Promise<{ stop: () => Promise<void>; url: string }> {
  const port = env.PORT ?? "47800";
  // Each case logs its own requests: clear the log a previous run of the same case left.
  rmSync(join(PROBE, "runs", env.RUN ?? "release", "release-server.jsonl"), { force: true });
  const proc = Bun.spawn([process.execPath, join(PROBE, "release-server.ts")], {
    env: { ...process.env, WRITE_RELEASE: "0", PORT: port, ...env },
    stdout: "pipe",
    stderr: "inherit",
  });
  const reader = proc.stdout.getReader();
  const first = await reader.read(); // the "release server on …" line
  if (first.done) throw new Error(`release server on port ${port} did not start`);
  const stop = async () => {
    proc.kill("SIGKILL");
    await proc.exited;
  };
  return { stop, url: `http://127.0.0.1:${port}/askboard/askboard/releases/download` };
}

export async function handshake(env: Record<string, string>, opts: string[] = [], command: string[] = [LAUNCHER]): Promise<Handshake> {
  const proc = Bun.spawn([process.execPath, join(PROBE, "handshake.ts"), ...opts, ...command], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "inherit",
  });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return JSON.parse(text.trim().split("\n").pop() ?? "{}");
}

export function downloads(run: string): { release: number; download: number } {
  let file = "";
  try {
    file = readFileSync(join(PROBE, "runs", run, "release-server.jsonl"), "utf8");
  } catch {
    return { release: 0, download: 0 };
  }
  const kinds = file.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).kind);
  return { release: kinds.filter((k) => k === "release").length, download: kinds.filter((k) => k === "download").length };
}

export const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
