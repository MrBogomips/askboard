import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import {
  connectMcp,
  MCP_PROTOCOL_VERSION,
  RpcError,
  RpcPeer,
  serveMcp,
} from "../src/mcp/jsonrpc.ts";

const pair = () => {
  const toServer = new PassThrough();
  const toClient = new PassThrough();
  return {
    toServer,
    toClient,
    client: new RpcPeer(toClient, toServer),
    server: new RpcPeer(toServer, toClient),
  };
};

const linesOf = (stream: PassThrough): string[] => {
  const lines: string[] = [];
  let buffer = "";
  stream.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    lines.push(...parts);
  });
  return lines;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("RpcPeer", () => {
  test("a request gets its handler's result, with its own ID", async () => {
    const { client, server } = pair();
    server.onRequest(async (method, params) => ({ method, params }));
    expect(await client.request("echo", { a: 1 })).toEqual({ method: "echo", params: { a: 1 } });
    expect(await client.request("again")).toEqual({ method: "again", params: undefined });
  });

  test("a notification reaches its handler and gets no answer", async () => {
    const { client, server, toClient } = pair();
    const written = linesOf(toClient);
    const heard: unknown[] = [];
    server.onNotification((method, params) => heard.push({ method, params }));
    client.notify("note", { b: 2 });
    await tick();
    expect(heard).toEqual([{ method: "note", params: { b: 2 } }]);
    expect(written).toEqual([]);
  });

  test("an unknown method is an error naming it", async () => {
    const { client } = pair();
    await expect(client.request("nothing")).rejects.toThrow(
      new RpcError(-32601, 'method "nothing" not found'),
    );
  });

  test("a handler's RpcError keeps its code; any other error is an internal error", async () => {
    const { client, server } = pair();
    server.onRequest(async (method) => {
      if (method === "typed") throw new RpcError(-32602, "bad params");
      throw new Error("secret detail");
    });
    await expect(client.request("typed")).rejects.toThrow(new RpcError(-32602, "bad params"));
    await expect(client.request("other")).rejects.toThrow(new RpcError(-32603, "internal error"));
  });

  test("a malformed line is answered with a parse error", async () => {
    const { toServer, toClient, server } = pair();
    server.onRequest(async () => "unused");
    const written = linesOf(toClient);
    toServer.write("{not json\n");
    toServer.write('"a string"\n');
    await tick();
    expect(written.map((line) => JSON.parse(line))).toEqual([
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } },
    ]);
  });

  test("messages are framed by newlines, whatever the chunks", async () => {
    const { toServer, server } = pair();
    const heard: string[] = [];
    server.onNotification((method) => heard.push(method));
    const one = JSON.stringify({ jsonrpc: "2.0", method: "one" });
    const two = JSON.stringify({ jsonrpc: "2.0", method: "two" });
    toServer.write(`${one}\n${two.slice(0, 7)}`);
    toServer.write(`${two.slice(7)}\n\n`);
    await tick();
    expect(heard).toEqual(["one", "two"]);
  });

  test("a response to an unknown ID is ignored", async () => {
    const { toClient, client } = pair();
    toClient.write(`${JSON.stringify({ jsonrpc: "2.0", id: 99, result: 1 })}\n`);
    await tick();
    client.close();
  });

  test("pending requests fail when the input ends", async () => {
    const { client, toClient } = pair();
    const pending = client.request("slow");
    toClient.end();
    await expect(pending).rejects.toThrow("the connection closed");
    await expect(client.request("late")).rejects.toThrow("the connection closed");
  });
});

describe("MCP over the peer, 2025 handshake", () => {
  const TOOLS = [{ name: "approve", description: "d", inputSchema: { type: "object" } }];

  const served = () => {
    const { client, server } = pair();
    const calls: unknown[] = [];
    serveMcp(server, {
      name: "bench-test",
      version: "0.0.0",
      instructions: "Use approve.",
      tools: TOOLS,
      call: async (name, args, meta) => {
        calls.push({ name, args, meta });
        return { content: [{ type: "text", text: "ok" }] };
      },
    });
    return { client, calls };
  };

  test("initialize answers the client's 2025 version, else the latest 2025 one", async () => {
    const { client } = served();
    expect(
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "c", version: "1" },
      }),
    ).toEqual({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "bench-test", version: "0.0.0" },
      instructions: "Use approve.",
    });
    const latest = await client.request("initialize", { protocolVersion: "2026-07-28" });
    expect(latest).toMatchObject({ protocolVersion: MCP_PROTOCOL_VERSION });
    expect(MCP_PROTOCOL_VERSION).toBe("2025-11-25");
  });

  test("tools/list, tools/call and ping", async () => {
    const { client, calls } = served();
    expect(await client.request("tools/list")).toEqual({ tools: TOOLS });
    expect(await client.request("ping")).toEqual({});
    expect(
      await client.request("tools/call", {
        name: "approve",
        arguments: { x: 1 },
        _meta: { progressToken: 7 },
      }),
    ).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(calls).toEqual([{ name: "approve", args: { x: 1 }, meta: { progressToken: 7 } }]);
  });

  test("a call of an unknown tool or without a name is invalid params", async () => {
    const { client } = served();
    await expect(client.request("tools/call", { name: "nope" })).rejects.toThrow(
      new RpcError(-32602, 'unknown tool "nope"'),
    );
    await expect(client.request("tools/call", {})).rejects.toThrow(
      new RpcError(-32602, 'unknown tool "undefined"'),
    );
  });

  test("server/discover is not served, so a 2026 client falls back", async () => {
    const { client } = served();
    await expect(client.request("server/discover")).rejects.toThrow(
      new RpcError(-32601, 'method "server/discover" not found'),
    );
  });

  test("connectMcp opens with initialize and initialized", async () => {
    const { client, server } = pair();
    const heard: string[] = [];
    serveMcp(server, {
      name: "s",
      version: "1",
      tools: [],
      call: async () => ({ content: [] }),
    });
    server.onNotification((method) => heard.push(method));
    const opened = await connectMcp(client, { name: "bench", version: "0.0.0" });
    expect(opened).toEqual({
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: { name: "s", version: "1" },
      instructions: undefined,
    });
    await tick();
    expect(heard).toEqual(["notifications/initialized"]);
  });
});
