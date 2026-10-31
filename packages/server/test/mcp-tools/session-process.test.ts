import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";

// MCP adapter spec, Exit: a real process over real stdio (task 5.5). Stdout carries only protocol,
// stdin's end and each signal discard the open asks and exit, and stderr holds no token and no
// question text.

const HARNESS = join(import.meta.dir, "session-harness.ts");
const TOKEN = "pV3xK9qLmT2wR7nB4cYh8A";
const [question] = plainChoiceBoardDocument.items;
const plainChoice = {
  askId: plainChoiceBoardDocument.askId,
  items: [{ type: question.type, id: question.id, props: question.props }],
};

type Message = { id?: number; result?: { content: { text: string }[] }; method?: string };

const start = () => {
  const child = Bun.spawn(["bun", HARNESS], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  const lines: string[] = [];
  const reading = (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of child.stdout) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      lines.push(...parts);
    }
    if (buffer) lines.push(buffer);
  })();
  const send = (message: object) => {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    child.stdin.flush();
  };
  const response = async (id: number): Promise<Message> => {
    for (let tries = 0; tries < 400; tries += 1) {
      const found = lines.map((line) => JSON.parse(line) as Message).find((m) => m.id === id);
      if (found) return found;
      await Bun.sleep(10);
    }
    throw new Error(`no response ${id}`);
  };
  const open = async () => {
    send({
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      },
    });
    await response(1);
    send({ method: "notifications/initialized" });
    send({ id: 2, method: "tools/call", params: { name: "ask", arguments: plainChoice } });
    return JSON.parse((await response(2)).result?.content[0]?.text ?? "{}") as { cursor: string };
  };
  const ended = async () => {
    const code = await child.exited;
    await reading;
    return { code, stdout: lines, stderr: await new Response(child.stderr).text() };
  };
  return { child, send, response, open, ended };
};

const onlyProtocol = (stdout: readonly string[]) => {
  expect(stdout.length).toBeGreaterThan(0);
  for (const line of stdout) expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
};

const clean = (stderr: string) => {
  expect(stderr).not.toContain(TOKEN);
  expect(stderr).not.toContain(question.props.text);
  expect(stderr).not.toContain("PostgreSQL");
};

describe("the session process over real stdio", () => {
  test("stdin's end discards the open ask and exits 0, with only protocol on stdout", async () => {
    const session = start();
    await session.open();
    session.child.stdin.end();
    const { code, stdout, stderr } = await session.ended();
    expect(code).toBe(0);
    onlyProtocol(stdout);
    expect(stderr).toContain("askboard: session ending (stdin closed): 1 open ask discarded");
    clean(stderr);
  });

  test.each(["SIGINT", "SIGTERM", "SIGHUP"] as const)(
    "%s answers the waiting collect with the discard, then exits 0",
    async (signal) => {
      const session = start();
      const { cursor } = await session.open();
      session.send({
        id: 3,
        method: "tools/call",
        params: {
          name: "collect",
          arguments: {
            asks: [{ askId: plainChoice.askId, after: cursor }],
            wait: { askId: plainChoice.askId, itemId: "database" },
          },
        },
      });
      await Bun.sleep(100);
      session.child.kill(signal);
      const collected = await session.response(3);
      expect(JSON.parse(collected.result?.content[0]?.text ?? "{}")).toMatchObject({
        asks: [{ state: "discarded", events: [{ type: "discarded", reason: "session-exit" }] }],
      });
      const { code, stdout, stderr } = await session.ended();
      expect(code).toBe(0);
      onlyProtocol(stdout);
      expect(stderr).toContain(`askboard: session ending (${signal}): 1 open ask discarded`);
      clean(stderr);
    },
  );
});
