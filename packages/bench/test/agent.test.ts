import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { TOOL_DEFINITIONS } from "@askboard/contract";
import { startServer } from "../src/agent.ts";
import { QUESTIONS } from "../src/scenarios.ts";

const STUB = join(import.meta.dir, "stub", "server.ts");
const question = QUESTIONS[0];
if (question === undefined) throw new Error("no question");

const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("the scripted MCP client", () => {
  test("opens the stub, lists its tools, asks, collects and closes it", async () => {
    const session = await startServer({
      command: process.execPath,
      args: [STUB],
      env: { PATH: process.env.PATH ?? "", BROWSER: "/usr/bin/true" },
    });
    expect(session.opened.protocolVersion).toBe("2025-11-25");
    expect(await session.listTools()).toEqual(TOOL_DEFINITIONS.map((tool) => tool.name));
    const asked = await session.call("ask", {
      askId: "order-db-k9",
      items: [
        {
          type: "question",
          id: "database",
          props: { text: question.text, header: question.header, options: question.options },
        },
      ],
    });
    expect(asked.isError).toBe(false);
    const result = JSON.parse(asked.text);
    expect(result).toMatchObject({ askId: "order-db-k9", state: "waiting" });
    const collected = await session.call("collect", {
      asks: [{ askId: "order-db-k9", after: result.cursor }],
    });
    expect(JSON.parse(collected.text).asks[0]).toMatchObject({ state: "waiting", events: [] });
    const pid = session.pid;
    expect(await session.close()).toBe(0);
    expect(isRunning(pid)).toBe(false);
  });

  test("a command that cannot start is an error naming it", async () => {
    await expect(
      startServer({ command: "/nonexistent/askboard", args: [], env: {} }),
    ).rejects.toThrow("/nonexistent/askboard");
  });

  test("a server that ignores stdin's end is killed at the bound", async () => {
    const session = await startServer(
      {
        command: process.execPath,
        args: [
          "-e",
          `process.stdin.on("data", (d) => { for (const line of String(d).split("\\n").filter(Boolean)) { const m = JSON.parse(line); if (m.id) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: "2025-11-25" } }) + "\\n"); } }); process.stdin.on("end", () => {}); setInterval(() => {}, 1000);`,
        ],
        env: { PATH: process.env.PATH ?? "" },
      },
      { closeBoundMs: 200 },
    );
    const pid = session.pid;
    expect(await session.close()).not.toBe(0);
    expect(isRunning(pid)).toBe(false);
  });
});
