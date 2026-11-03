import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { AskCore, type CorePorts } from "@askboard/core";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import {
  EXIT_FLUSH_MS,
  type ExitSignal,
  type SessionProcess,
  serveSession,
} from "../../src/mcp-tools/index.ts";
import { ASK_ID, jsonOf, LINK, manualTimers, runtimeClock } from "./helpers.ts";

// MCP adapter spec: No side effect before the first request; Exit (design decision 4, task 5.5).

const TOKEN = new URL(LINK).searchParams.get("t") as string;
const [question] = plainChoiceBoardDocument.items;
const plainChoice = {
  askId: ASK_ID,
  items: [{ type: question.type, id: question.id, props: question.props }],
};

const recordingPorts = () => {
  const calls: string[] = [];
  const ports: CorePorts = {
    randomness: { bytes: (count) => new Uint8Array(count).fill(11) },
    showing: {
      check: async () => {
        calls.push("check");
        return { showable: true };
      },
      open: () => calls.push("open"),
    },
    address: {
      link: async () => {
        calls.push("link");
        return LINK;
      },
    },
    identity: {
      gitUserName: async () => {
        calls.push("git");
        return "Paola Greco";
      },
      loginName: async () => "paola",
    },
    report: (error) => calls.push(`report ${String(error)}`),
    clock: runtimeClock,
  };
  return { ports, calls };
};

const fakeProcess = () => {
  const handlers = new Map<ExitSignal, () => void>();
  const exits: number[] = [];
  const process: SessionProcess = {
    onSignal: (signal, handler) => handlers.set(signal, handler),
    exit: (code) => exits.push(code),
  };
  return { process, exits, emit: (signal: ExitSignal) => handlers.get(signal)?.() };
};

const session = async (
  options: {
    beforeExit?: () => Promise<void>;
    negotiation?: "auto" | "legacy";
    firstRequest?: () => void;
  } = {},
) => {
  const { ports, calls } = recordingPorts();
  const core = new AskCore(ports);
  const clock = manualTimers();
  const written: string[] = [];
  const proc = fakeProcess();
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const order: string[] = [];
  const served = serveSession({
    deps: { core, timers: clock.timers, diagnostics: { write: (line) => written.push(line) } },
    process: proc.process,
    transport: serverEnd,
    beforeExit: async () => {
      order.push(`beforeExit after ${core.board(ASK_ID)?.state ?? "no ask"}`);
      await options.beforeExit?.();
    },
    ...(options.firstRequest ? { firstRequest: options.firstRequest } : {}),
  });
  const client = new Client(
    { name: "test", version: "0.0.0" },
    { versionNegotiation: { mode: options.negotiation ?? "legacy" } },
  );
  await client.connect(clientEnd);
  return { core, calls, clock, written, proc, client, served, order };
};

describe("no side effect before the first request", () => {
  test("server/discover alone calls no port: no board listener, no opener, no git", async () => {
    const { client, calls, served } = await session({ negotiation: "auto" });
    await client.discover();
    await client.close();
    await served.ended;
    expect(calls).toEqual([]);
  });

  test("initialize and tools/list call no port either", async () => {
    const { client, calls, served } = await session();
    await client.listTools();
    await client.close();
    await served.ended;
    expect(calls).toEqual([]);
  });
});

// Push delivery (task 4.7; AD-2): the entry point starts the local API at the first request other
// than `server/discover`.

describe("the first request", () => {
  test("server/discover alone is not one", async () => {
    let started = 0;
    const { client, served } = await session({
      negotiation: "auto",
      firstRequest: () => {
        started += 1;
      },
    });
    await client.discover();
    await client.close();
    await served.ended;
    expect(started).toBe(0);
  });

  test("a start that throws is written to diagnostics, and the request is still served", async () => {
    const { client, proc, served, written } = await session({
      firstRequest: () => {
        throw new RangeError("no session folder");
      },
    });
    expect((await client.listTools()).tools).toHaveLength(4);
    expect(written).toEqual(["askboard: starting at the first request failed: RangeError"]);
    proc.emit("SIGTERM");
    await served.ended;
  });

  test("the next request is, once, whichever handshake ran", async () => {
    for (const negotiation of ["auto", "legacy"] as const) {
      let started = 0;
      const { client, proc, served, calls } = await session({
        negotiation,
        firstRequest: () => {
          started += 1;
        },
      });
      await client.listTools();
      await client.listTools();
      expect(started).toBe(1);
      expect(calls).toEqual([]);
      proc.emit("SIGTERM");
      await served.ended;
    }
  });
});

describe("exit", () => {
  test("stdin's end discards the open asks and exits", async () => {
    const { client, core, proc, served, written, order } = await session();
    await client.callTool({ name: "ask", arguments: plainChoice });
    await client.close();
    expect(await served.ended).toBe(0);
    expect(proc.exits).toEqual([0]);
    expect(core.board(ASK_ID)?.state).toBe("discarded");
    expect(order).toEqual(["beforeExit after discarded"]);
    expect(written).toEqual(["askboard: session ending (stdin closed): 1 open ask discarded"]);
  });

  test.each(["SIGINT", "SIGTERM", "SIGHUP"] as const)(
    "%s discards the open asks, answers a waiting collect, then exits",
    async (signal) => {
      const { client, core, proc, served, written } = await session();
      const asked = jsonOf(await client.callTool({ name: "ask", arguments: plainChoice })) as {
        cursor: string;
      };
      const waiting = client.callTool({
        name: "collect",
        arguments: {
          asks: [{ askId: ASK_ID, after: asked.cursor }],
          wait: { askId: ASK_ID, itemId: "database" },
        },
      });
      await Bun.sleep(5);
      proc.emit(signal);
      expect(jsonOf(await waiting)).toMatchObject({
        asks: [{ state: "discarded", events: [{ type: "discarded", reason: "session-exit" }] }],
      });
      expect(await served.ended).toBe(0);
      expect(proc.exits).toEqual([0]);
      expect(core.board(ASK_ID)?.state).toBe("discarded");
      expect(written).toEqual([`askboard: session ending (${signal}): 1 open ask discarded`]);
    },
  );

  test("a second signal during the exit exits once", async () => {
    const { proc, served } = await session();
    proc.emit("SIGINT");
    proc.emit("SIGTERM");
    await served.ended;
    await Bun.sleep(5);
    expect(proc.exits).toEqual([0]);
  });

  test("a close that hangs is bounded: the process exits after the flush bound", async () => {
    const { proc, clock, served } = await session({ beforeExit: () => new Promise(() => {}) });
    proc.emit("SIGTERM");
    await Bun.sleep(5);
    expect(proc.exits).toEqual([]);
    await clock.advance(EXIT_FLUSH_MS);
    expect(await served.ended).toBe(0);
  });

  test("a close that fails is written to diagnostics, and the process still exits", async () => {
    const { proc, served, written } = await session({
      beforeExit: async () => {
        throw new RangeError("listener close failed");
      },
    });
    proc.emit("SIGHUP");
    expect(await served.ended).toBe(0);
    expect(written).toContain("askboard: closing the board listener failed: RangeError");
  });

  test("a diagnostics writer that throws does not keep the process from exiting", async () => {
    const { ports } = recordingPorts();
    const proc = fakeProcess();
    const [, serverEnd] = InMemoryTransport.createLinkedPair();
    const served = serveSession({
      deps: {
        core: new AskCore(ports),
        timers: manualTimers().timers,
        diagnostics: {
          write: () => {
            throw new Error("EPIPE");
          },
        },
      },
      process: proc.process,
      transport: serverEnd,
    });
    proc.emit("SIGTERM");
    expect(await served.ended).toBe(0);
    expect(proc.exits).toEqual([0]);
  });

  test("a discard that fails is written to diagnostics, and the process still exits", async () => {
    const { ports } = recordingPorts();
    const core = new AskCore(ports);
    Object.assign(core, {
      discardAll: () => {
        throw new TypeError("discard failed");
      },
    });
    const proc = fakeProcess();
    const written: string[] = [];
    const [, serverEnd] = InMemoryTransport.createLinkedPair();
    const served = serveSession({
      deps: { core, timers: manualTimers().timers, diagnostics: { write: (l) => written.push(l) } },
      process: proc.process,
      transport: serverEnd,
    });
    proc.emit("SIGINT");
    expect(await served.ended).toBe(0);
    expect(written).toEqual(["askboard: ending the session failed: TypeError"]);
  });

  test("stderr never holds a board token or question text", async () => {
    const { client, proc, served, written } = await session();
    await client.callTool({ name: "ask", arguments: plainChoice });
    await client.callTool({ name: "ask", arguments: { ...plainChoice, title: 7 } });
    proc.emit("SIGINT");
    await served.ended;
    const stderr = written.join("\n");
    expect(stderr).not.toContain(TOKEN);
    expect(stderr).not.toContain(question.props.text);
    expect(stderr).not.toContain("PostgreSQL");
  });
});
