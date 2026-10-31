import { describe, expect, test } from "bun:test";
import type { JSONRPCMessage } from "@modelcontextprotocol/client";
import { type Child, ChildTransport, describeExit, spawnChild } from "./child.ts";
import { FakeChild } from "./fake-child.ts";

const ENV = { PATH: process.env.PATH ?? "" };
const sh = (script: string): Child => spawnChild("sh", ["-c", script], { env: ENV, cwd: "/" });

const collect = (child: Child) => {
  const out: string[] = [];
  const err: string[] = [];
  child.onOutput((chunk) => out.push(Buffer.from(chunk).toString()));
  child.onErrorOutput((chunk) => err.push(Buffer.from(chunk).toString()));
  return { out: () => out.join(""), err: () => err.join("") };
};

describe("spawnChild", () => {
  test("writes to the process, reads its two outputs and its exit code", async () => {
    const child = sh('read line; printf "got %s\\n" "$line"; printf oops >&2; exit 3');
    const seen = collect(child);
    child.write("hello\n");
    expect(await child.exited).toEqual({ code: 3, signal: null });
    expect(seen.out()).toBe("got hello\n");
    expect(seen.err()).toBe("oops");
    expect(child.pid).toBeGreaterThan(0);
  });

  test("ends the process's input, which ends a process that reads it to the end", async () => {
    const child = sh("cat >/dev/null; exit 0");
    child.endInput();
    expect(await child.exited).toEqual({ code: 0, signal: null });
  });

  test("passes the environment and the folder it is given, and nothing else", async () => {
    const child = spawnChild("sh", ["-c", 'printf "%s %s %s" "$A" "$HOME" "$PWD"'], {
      env: { ...ENV, A: "a" },
      cwd: "/",
    });
    const seen = collect(child);
    await child.exited;
    expect(seen.out()).toBe("a  /");
  });

  test("reports a kill by its signal, and a write after the end is no error", async () => {
    const child = sh("sleep 30");
    child.kill("SIGKILL");
    expect(await child.exited).toEqual({ code: null, signal: "SIGKILL" });
    child.write("late\n");
    child.endInput();
  });

  test("reports a command that cannot start, which takes input and signals as no-ops", async () => {
    const child = spawnChild("/nonexistent/askboard", [], { env: ENV, cwd: "/" });
    const seen = collect(child);
    child.write("hello\n");
    child.endInput();
    child.kill("SIGKILL");
    const exit = await child.exited;
    expect(exit.code).toBeNull();
    expect(exit.error).toContain("ENOENT");
    expect(child.pid).toBeUndefined();
    expect(seen.out()).toBe("");
  });
});

describe("describeExit", () => {
  test("says how a process ended", () => {
    expect(describeExit({ code: 0, signal: null })).toBe("exit code 0");
    expect(describeExit({ code: null, signal: "SIGKILL" })).toBe("signal SIGKILL");
    expect(describeExit({ code: null, signal: null, error: "Error: spawn x ENOENT" })).toBe(
      "no start: Error: spawn x ENOENT",
    );
  });
});

describe("ChildTransport", () => {
  const request: JSONRPCMessage = { jsonrpc: "2.0", id: 1, method: "tools/list" };

  test("sends each message as one line of JSON on the child's input", async () => {
    const child = new FakeChild();
    const transport = new ChildTransport(child);
    await transport.start();
    await transport.send(request);
    expect(child.received).toEqual([request]);
  });

  test("hands on each message of the child's output, across chunks", async () => {
    const child = new FakeChild();
    const transport = new ChildTransport(child);
    const messages: JSONRPCMessage[] = [];
    transport.onmessage = (message) => messages.push(message);
    await transport.start();
    const reply = JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} });
    child.emit(`${reply.slice(0, 10)}`);
    child.emit(`${reply.slice(10)}\n${reply}\n`);
    expect(messages).toHaveLength(2);
  });

  test("skips a line that is not JSON, reports JSON that is no message, and goes on", async () => {
    const child = new FakeChild();
    const transport = new ChildTransport(child);
    const messages: JSONRPCMessage[] = [];
    const errors: Error[] = [];
    transport.onmessage = (message) => messages.push(message);
    transport.onerror = (error) => errors.push(error);
    await transport.start();
    // The SDK's ReadBuffer drops a line that is not JSON, as a stray log line would be.
    child.emit(`not json\n{"not":"a message"}\n`);
    child.emit(`${JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })}\n`);
    expect(errors).toHaveLength(1);
    expect(messages).toHaveLength(1);
  });

  test("close ends the child's input; the child's exit closes the transport", async () => {
    const child = new FakeChild();
    const transport = new ChildTransport(child);
    let closes = 0;
    transport.onclose = () => {
      closes += 1;
    };
    await transport.start();
    await transport.close();
    expect(child.inputEnded).toBe(true);
    await child.exited;
    await Bun.sleep(0);
    expect(closes).toBe(1);
  });
});
