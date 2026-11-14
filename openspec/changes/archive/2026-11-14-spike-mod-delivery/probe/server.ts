// Stub session process: stdio MCP server, local API on loopback TCP and a Unix socket, session file.
// Spike code: it logs what Claude Code sends and stands in for ask-core and board-host.
import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport, serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { logTo, runDir, type SessionFile, sessionsDir } from "./lib.ts";

const LOG = "server.jsonl";
const RECORD_TIMEOUT_MS = 30_000;
// AD-2: a process that only answers these has no side effects (no port, no session file).
const HANDSHAKE = new Set(["initialize", "server/discover", "notifications/initialized", "ping"]);

type AgentRecord = {
  tool_use_id?: string;
  agent_id?: string;
  agent_type?: string;
  cwd?: string;
  session_id?: string;
  tool_name?: string;
  askId?: string;
  t: number;
  boundTo?: string;
};
type Ask = { askId: string; owner: string | null; ownerType: string | null; cwd: string | null; createdAt: number; boundBy: string; link: string };
type ProbeEvent = { seq: number; askId: string; owner: string | null; nonce: string; text: string; t0: number };
type Delivery = { seq: number; via: string; agentId: string | null; result: unknown; t1?: number; t2: number; at: number };

const epoch = randomBytes(2).toString("hex");
const token = randomBytes(16).toString("hex");
const key = process.env.CLAUDE_CODE_SESSION_ID ?? `no-session-id-${process.pid}`;
const records: AgentRecord[] = [];
const asks = new Map<string, Ask>();
const events: ProbeEvent[] = [];
const deliveries: Delivery[] = [];
let api: { tcp: ReturnType<typeof Bun.serve>; unix: ReturnType<typeof Bun.serve>; file: string; socket: string } | undefined;

logTo(LOG, {
  kind: "start",
  ppid: process.ppid,
  argv: process.argv,
  env: {
    CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID ?? null,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? null,
    MCP_PROTOCOL_NEGOTIATION: process.env.MCP_PROTOCOL_NEGOTIATION ?? null,
  },
  epoch,
});

function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name] = name === "x-probe-token" ? (value === token ? "<valid>" : "<invalid>") : value;
  });
  return out;
}

async function handle(request: Request, transport: "tcp" | "unix"): Promise<Response> {
  const url = new URL(request.url);
  logTo(LOG, { kind: "api", transport, method: request.method, path: url.pathname + url.search, headers: redactHeaders(request.headers) });
  if (request.headers.get("x-probe-token") !== token) return new Response("bad token", { status: 401 });
  const body = request.method === "POST" ? await request.json() : undefined;
  const json = (value: unknown) => Response.json(value);
  switch (`${request.method} ${url.pathname}`) {
    case "POST /record":
      records.push({ ...(body as AgentRecord), t: Date.now() });
      return json({ ok: true });
    case "GET /events": {
      const after = Number(url.searchParams.get("after") ?? 0);
      const delivered = new Set(deliveries.map((d) => d.seq));
      return json({ epoch, now: Date.now(), events: events.filter((e) => e.seq > after && !delivered.has(e.seq)) });
    }
    case "POST /delivered":
      deliveries.push({ ...(body as Delivery), at: Date.now() });
      logTo(LOG, { kind: "delivered", ...(body as Delivery) });
      return json({ ok: true });
    case "POST /log":
      logTo("mod.jsonl", body as Record<string, unknown>);
      return json({ ok: true });
    case "POST /answer": {
      const { askId, text } = body as { askId: string; text?: string };
      const ask = asks.get(askId);
      if (!ask) return new Response("unknown ask", { status: 404 });
      const nonce = `N-${randomBytes(4).toString("hex")}`;
      const event: ProbeEvent = { seq: events.length + 1, askId, owner: ask.owner, nonce, text: text ?? "yes", t0: Date.now() };
      events.push(event);
      logTo(LOG, { kind: "answer", ...event });
      return json(event);
    }
    case "POST /stop": {
      const agentId = (body as { agent_id?: string }).agent_id ?? null;
      const delivered = new Set(deliveries.map((d) => d.seq));
      const pending = events.filter((e) => e.owner === agentId && !delivered.has(e.seq));
      return json({ pending });
    }
    case "GET /state":
      return json({ epoch, key, records, asks: [...asks.values()], events, deliveries });
    default:
      return new Response("not found", { status: 404 });
  }
}

function startApi(): void {
  if (api) return;
  const socket = join(runDir(), `api-${process.pid}.sock`);
  const tcp = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (r) => handle(r, "tcp") });
  const unix = Bun.serve({ unix: socket, fetch: (r) => handle(r, "unix") });
  const session: SessionFile = {
    format: 1,
    key,
    pid: process.pid,
    ppid: process.ppid,
    epoch,
    apiAddress: `http://127.0.0.1:${tcp.port}`,
    socketPath: socket,
    sessionToken: token,
    projectDir: process.env.CLAUDE_PROJECT_DIR ?? null,
    startedAt: new Date().toISOString(),
  };
  const file = join(sessionsDir(), `${key}.json`);
  writeFileSync(file, JSON.stringify(session, null, 2), { mode: 0o600 });
  api = { tcp, unix, file, socket };
  logTo(LOG, { kind: "api-start", apiAddress: session.apiAddress, socket, file });
}

// Binding per AD-5: by tool_use_id when the call carries it, else the next unbound record for that tool and ask.
function bindRecord(toolName: string, askId: string, toolUseId: string | undefined, callId: string): AgentRecord | undefined {
  const now = Date.now();
  const byId = toolUseId ? records.find((r) => r.tool_use_id === toolUseId && !r.boundTo) : undefined;
  const byNext =
    byId ??
    records.find((r) => !r.boundTo && r.askId === askId && r.tool_name?.endsWith(`__${toolName}`) && now - r.t < RECORD_TIMEOUT_MS);
  if (byNext) byNext.boundTo = callId;
  logTo(LOG, { kind: "bind", toolName, askId, toolUseId: toolUseId ?? null, rule: byId ? "tool_use_id" : byNext ? "next-call" : "none" });
  return byNext;
}

function findToolUseId(meta: Record<string, unknown> | undefined): string | undefined {
  if (!meta) return undefined;
  const entry = Object.entries(meta).find(([name]) => /tool_?use_?id/i.test(name));
  return typeof entry?.[1] === "string" ? entry[1] : undefined;
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "probe", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.registerTool(
    "probe_ask",
    {
      description: "Probe: put a question to the user. Returns at once; answers arrive later as messages or through probe_collect.",
      inputSchema: z.object({ askId: z.string(), question: z.string() }),
    },
    async ({ askId, question }, ctx) => {
      startApi();
      const meta = ctx.mcpReq._meta as Record<string, unknown> | undefined;
      logTo(LOG, { kind: "tools/call", tool: "probe_ask", askId, question, meta: meta ?? null, envelope: ctx.mcpReq.envelope ?? null, clientVersion: server.server.getClientVersion() ?? null });
      const record = bindRecord("probe_ask", askId, findToolUseId(meta), String(ctx.mcpReq.id));
      const ask: Ask = {
        askId,
        owner: record ? (record.agent_id ?? null) : null,
        ownerType: record?.agent_type ?? null,
        cwd: record?.cwd ?? null,
        createdAt: Date.now(),
        boundBy: record ? "record" : "unbound",
        link: `${api?.tcp.url.href}b/${askId}`,
      };
      if (!asks.has(askId)) asks.set(askId, ask);
      const result = { askId, epoch, link: ask.link, owner: ask.owner ?? "main", bound: ask.boundBy };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
  server.registerTool(
    "probe_collect",
    {
      description: "Probe: collect answers to an ask after a given sequence number.",
      inputSchema: z.object({ askId: z.string(), after: z.number().int().default(0) }),
    },
    async ({ askId, after }, ctx) => {
      startApi();
      logTo(LOG, { kind: "tools/call", tool: "probe_collect", askId, after, meta: ctx.mcpReq._meta ?? null });
      const found = events.filter((e) => e.askId === askId && e.seq > after);
      for (const e of found) {
        deliveries.push({ seq: e.seq, via: "collect", agentId: e.owner, result: null, t2: Date.now(), at: Date.now() });
        logTo(LOG, { kind: "delivered", seq: e.seq, via: "collect", agentId: e.owner });
      }
      return { content: [{ type: "text", text: JSON.stringify({ askId, epoch, events: found }) }] };
    },
  );
  return server;
}

// Tee stdin so every raw JSON-RPC message is logged (methods, _meta, client info) before the SDK sees it.
const tee = new PassThrough();
let pending = "";
process.stdin.on("data", (chunk: Buffer) => {
  pending += chunk.toString("utf8");
  const lines = pending.split("\n");
  pending = lines.pop() ?? "";
  for (const line of lines.filter((l) => l.trim())) {
    try {
      const message = JSON.parse(line);
      logTo(LOG, { kind: "rpc-in", method: message.method ?? null, id: message.id ?? null, params: message.method === "tools/call" || message.method === "initialize" || message.method === "server/discover" ? message.params : undefined });
      if (typeof message.method === "string" && !HANDSHAKE.has(message.method)) startApi();
    } catch {
      logTo(LOG, { kind: "rpc-in-unparsed", length: line.length });
    }
  }
  tee.write(chunk);
});
process.stdin.on("end", () => shutdown("stdin-end"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));
// Claude Code 2.1.312 stops stdio servers with SIGINT (findings.md, criterion 12); AD-2 names only the other three.
process.on("SIGINT", () => shutdown("SIGINT"));

function shutdown(reason: string): void {
  logTo(LOG, { kind: "exit", reason, asks: asks.size, events: events.length, deliveries: deliveries.length });
  if (api) {
    api.tcp.stop(true);
    api.unix.stop(true);
    rmSync(api.file, { force: true });
    rmSync(api.socket, { force: true });
  }
  process.exit(0);
}

serveStdio(buildServer, { transport: new StdioServerTransport(tee, process.stdout), onerror: (error) => logTo(LOG, { kind: "sdk-error", message: error.message }) });
