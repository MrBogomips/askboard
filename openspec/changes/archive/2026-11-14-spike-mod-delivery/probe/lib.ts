// Shared by server.ts, hook.ts and driver.ts. Spike code: not a starting point for packages/.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SessionFile = {
  format: 1;
  key: string;
  pid: number;
  ppid: number;
  epoch: string;
  apiAddress: string;
  socketPath: string;
  sessionToken: string;
  projectDir: string | null;
  startedAt: string;
};

export function runDir(): string {
  const dir = process.env.PROBE_RUN_DIR;
  if (!dir) throw new Error("PROBE_RUN_DIR is not set");
  return dir;
}

export function ensureDir(path: string): string {
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

export const sessionsDir = (): string => ensureDir(join(runDir(), "sessions"));
export const logsDir = (): string => ensureDir(join(runDir(), "logs"));

export function logTo(file: string, entry: Record<string, unknown>): void {
  const line = JSON.stringify({ t: Date.now(), iso: new Date().toISOString(), pid: process.pid, ...entry });
  appendFileSync(join(logsDir(), file), `${line}\n`, { mode: 0o600 });
}

export function readSessionFiles(): SessionFile[] {
  const dir = sessionsDir();
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as SessionFile);
}

// The lookup AD-5 specifies: by CLAUDE_CODE_SESSION_ID only; zero or several candidates reach none.
export function findSessionFile(key: string | undefined): { file?: SessionFile; candidates: number } {
  const all = readSessionFiles();
  const matching = key ? all.filter((s) => s.key === key) : [];
  return matching.length === 1 ? { file: matching[0], candidates: 1 } : { candidates: matching.length };
}

// The alternative key a review suggested: the Claude Code process, parent of both the server and the hook.
export function findSessionFileByParent(parentPid: number): { file?: SessionFile; candidates: number } {
  const matching = readSessionFiles().filter((s) => s.ppid === parentPid);
  return matching.length === 1 ? { file: matching[0], candidates: 1 } : { candidates: matching.length };
}

export async function api(
  session: SessionFile,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${session.apiAddress}${path}`, {
    method,
    headers: { "x-probe-token": session.sessionToken, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

export function readStdin(): Promise<string> {
  return new Response(Bun.stdin.stream()).text();
}
