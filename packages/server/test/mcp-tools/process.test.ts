import { describe, expect, test } from "bun:test";
import { EXIT_FLUSH_MS, processOf, systemTimers } from "../../src/mcp-tools/index.ts";

// The adapters to the running process that the subprocess run exercises: the system timers, and
// the process's signals and exit (task 5.5).

const fakeRunning = (flushes: boolean) => {
  const handlers: [string, () => void][] = [];
  const exits: number[] = [];
  const written: string[] = [];
  const running = {
    on: (signal: string, handler: () => void) => handlers.push([signal, handler]),
    stdout: {
      write: (chunk: string, done: () => void) => {
        written.push(chunk);
        if (flushes) done();
        return true;
      },
    },
    exit: (code: number) => exits.push(code),
  };
  return { running: running as unknown as NodeJS.Process, handlers, exits, written };
};

describe("the system timers", () => {
  test("run once after the delay, unless cancelled", async () => {
    const ran: string[] = [];
    systemTimers.after(1, () => ran.push("kept"));
    const cancel = systemTimers.after(1, () => ran.push("cancelled"));
    cancel();
    await Bun.sleep(20);
    expect(ran).toEqual(["kept"]);
  });
});

describe("the running process", () => {
  test("hands its signals to the session", () => {
    const { running, handlers } = fakeRunning(true);
    const handler = () => undefined;
    processOf(running).onSignal("SIGHUP", handler);
    expect(handlers).toEqual([["SIGHUP", handler]]);
  });

  test("exits once stdout reports what it wrote as flushed", () => {
    const { running, exits, written } = fakeRunning(true);
    processOf(running).exit(0);
    expect(written).toEqual([""]);
    expect(exits).toEqual([0]);
  });

  test("exits after the flush bound when stdout never reports the flush", async () => {
    const { running, exits } = fakeRunning(false);
    processOf(running).exit(0);
    expect(exits).toEqual([]);
    await Bun.sleep(EXIT_FLUSH_MS + 100);
    expect(exits).toEqual([0]);
  });
});
