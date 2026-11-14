// Session-process stand-in (design decision 2): the code paths the real executable carries, no Bun-only API,
// so the same file runs compiled by Bun and as the plain bundle on Node.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport, serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const VERSION = process.env.ASKBOARD_PROBE_VERSION ?? "0.0.1-spike";
const startedAt = Date.now();

function log(entry: Record<string, unknown>): void {
  const file = process.env.ASKBOARD_PROBE_LOG;
  if (file) appendFileSync(file, `${JSON.stringify({ t: Date.now(), pid: process.pid, ...entry })}\n`);
}

function onPath(command: string): boolean {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// "No reachable browser" (design decision 9): one rule, its inputs printed with the verdict.
export function detect(): { reachable: boolean; reason: string; inputs: Record<string, unknown> } {
  const env = process.env;
  const container = existsSync("/.dockerenv") || existsSync("/run/.containerenv") || !!env.REMOTE_CONTAINERS || !!env.DEVCONTAINER;
  const wsl = process.platform === "linux" && (!!env.WSL_DISTRO_NAME || !!env.WSL_INTEROP);
  const inputs = {
    platform: process.platform,
    ssh: !!(env.SSH_CONNECTION || env.SSH_TTY),
    codespaces: !!env.CODESPACES,
    container,
    containerOptIn: env.ASKBOARD_BIND_CONTAINER === "1",
    ci: !!(env.CI || env.GITHUB_ACTIONS),
    wsl,
    browserVar: env.BROWSER ?? null,
    display: !!(env.DISPLAY || env.WAYLAND_DISPLAY),
    open: process.platform === "darwin" && onPath("open"),
    xdgOpen: process.platform === "linux" && onPath("xdg-open"),
    wslview: wsl && onPath("wslview"),
    explorer: wsl && onPath("explorer.exe"),
  };
  if (inputs.codespaces || inputs.ssh) return { reachable: false, reason: "remote-host", inputs };
  if (inputs.container && !inputs.containerOptIn) return { reachable: false, reason: "container-without-binding", inputs };
  if (inputs.container) return { reachable: true, reason: "container-binding-opt-in (terminal link only)", inputs };
  if (inputs.ci && !inputs.browserVar) return { reachable: false, reason: "ci-runner", inputs };
  if (inputs.browserVar) return { reachable: true, reason: "BROWSER", inputs };
  if (inputs.open) return { reachable: true, reason: "open", inputs };
  if (inputs.wslview || inputs.explorer) return { reachable: true, reason: inputs.wslview ? "wslview" : "explorer.exe", inputs };
  if (inputs.xdgOpen && inputs.display) return { reachable: true, reason: "xdg-open", inputs };
  return { reachable: false, reason: "no-opener", inputs };
}

let board: { server: Server; port: number } | undefined;

// Board listener: 127.0.0.1, or every interface on the container opt-in (AD-11), with a stderr warning.
function startBoard(): Promise<{ server: Server; port: number }> {
  if (board) return Promise.resolve(board);
  const optIn = process.env.ASKBOARD_BIND_CONTAINER === "1";
  const host = optIn ? "0.0.0.0" : "127.0.0.1";
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain", "referrer-policy": "no-referrer" });
    res.end(`askboard board stand-in ${req.url}\n`);
  });
  return new Promise((resolve) => {
    server.listen(Number(process.env.ASKBOARD_PORT ?? 0), host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      if (optIn) process.stderr.write(`askboard: warning: board listener bound to ${host}:${port}, a non-loopback interface (container opt-in)\n`);
      board = { server, port };
      log({ kind: "board", host, port });
      resolve(board);
    });
  });
}

function boardLink(port: number, askId: string): string {
  const host = process.env.ASKBOARD_LINK_HOST ?? "127.0.0.1";
  return `http://${host}:${port}/b/${askId}?t=${randomBytes(16).toString("hex")}`;
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "askboard", version: VERSION }, { capabilities: { tools: {} } });
  server.registerTool(
    "ask",
    {
      description: "Packaging spike stand-in: returns a board link, or unavailable with its reason.",
      inputSchema: z.object({ askId: z.string(), question: z.string() }),
    },
    async ({ askId }) => {
      const verdict = detect();
      if (!verdict.reachable) {
        return { content: [{ type: "text", text: JSON.stringify({ result: "unavailable", reason: verdict.reason }) }] };
      }
      const { port } = await startBoard();
      return { content: [{ type: "text", text: JSON.stringify({ result: "created", askId, link: boardLink(port, askId) }) }] };
    },
  );
  return server;
}

async function hook(event: string | undefined): Promise<void> {
  // Hook: read the hook input and exit 0 without a decision (AD-19).
  for await (const _chunk of process.stdin) {
    /* drain */
  }
  log({ kind: "hook", event: event ?? null });
}

function serve(): void {
  const shutdown = (reason: string) => {
    log({ kind: "exit", reason, uptimeMs: Date.now() - startedAt });
    board?.server.close();
    process.exit(0);
  };
  process.stdin.on("end", () => shutdown("stdin-end"));
  for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"] as const) process.on(signal, () => shutdown(signal));
  serveStdio(buildServer, { transport: new StdioServerTransport(process.stdin, process.stdout) });
}

const commands: Record<string, (args: string[]) => Promise<void> | void> = {
  hook: (args) => hook(args[0]),
  doctor: () => {
    const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
    process.stdout.write(`${JSON.stringify({ version: VERSION, pid: process.pid, ppid: process.ppid, platform: process.platform, arch: process.arch, runtime })}\n`);
  },
  detect: () => {
    process.stdout.write(`${JSON.stringify(detect())}\n`);
  },
  // Devcontainer check (task 5.2): the board listener alone, its link printed.
  "serve-board": async () => {
    const { port } = await startBoard();
    process.stdout.write(`${boardLink(port, "devcontainer-check")}\n`);
  },
};

const [command, ...args] = process.argv.slice(2);
log({ kind: "start", command: command ?? "server", ppid: process.ppid, execPath: process.execPath });
const run = command ? commands[command] : undefined;
if (run) await run(args);
else serve();
