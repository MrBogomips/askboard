import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { DRAFT_DEBOUNCE_MS } from "../../../src/board-page/draft-mirror.ts";
import { RECONNECT_DELAYS_MS } from "../../../src/board-page/reconnect.ts";
import {
  draftSettled,
  flushBoardPage,
  flushViewFrame,
  hostSettled,
  NO_RECONNECT_WAIT_MS,
  QUIET_MS,
  quiet,
  type Settleable,
  timerSettled,
  viewSettled,
} from "./probes.ts";
import { quietWaitProblems } from "./quiet-guard.ts";

// Decision 7 (e2e-cadence): the round-trip probes that replace the fixed quiet wait, and the guard
// that keeps the wait out of the browser files. The probes' behaviour in a browser, with a positive
// control for each, is `probes.browser.ts`.

type Call = { on: "view" | "page"; at: number };

// A board that records each evaluate it is given, with the time it ran.
const fakeBoard = (calls: Call[]): Settleable => {
  const record = (on: Call["on"]) => async () => {
    calls.push({ on, at: performance.now() });
  };
  return {
    page: { evaluate: record("page") },
    viewFrame: async () => ({ evaluate: record("view") }),
  } as unknown as Settleable;
};

const order = (calls: readonly Call[]): string[] => calls.map((call) => call.on);

// What `evaluate` runs in the browser, run here with a stand-in for the animation frame.
describe("the functions the probes run in the page", () => {
  const scope = globalThis as unknown as { requestAnimationFrame?: unknown };

  test("flushViewFrame waits two animation frames and then a macrotask", async () => {
    const events: string[] = [];
    scope.requestAnimationFrame = (frame: () => void) => {
      events.push("frame");
      setTimeout(frame, 0);
    };
    try {
      await flushViewFrame().then(() => events.push("done"));
    } finally {
      scope.requestAnimationFrame = undefined;
    }
    expect(events).toEqual(["frame", "frame", "done"]);
  });

  test("flushViewFrame ends on its own in a hidden page, which runs no animation frame", async () => {
    scope.requestAnimationFrame = () => 0;
    const began = performance.now();
    try {
      await flushViewFrame();
    } finally {
      scope.requestAnimationFrame = undefined;
    }
    expect(performance.now() - began).toBeGreaterThanOrEqual(950);
  });

  test("flushBoardPage resolves on a macrotask", async () => {
    let queued = false;
    setTimeout(() => {
      queued = true;
    }, 0);
    await flushBoardPage();
    expect(queued).toBe(true);
  });
});

describe("viewSettled", () => {
  test("flushes the view frame, then the board page: one round trip each, in that order", async () => {
    const calls: Call[] = [];
    await viewSettled(fakeBoard(calls));
    expect(order(calls)).toEqual(["view", "page"]);
  });

  test("fails with the frame's own error when the board has no view frame", async () => {
    const board = {
      page: { evaluate: async () => undefined },
      viewFrame: async () => {
        throw new Error("the board has no view frame");
      },
    } as unknown as Settleable;
    await expect(viewSettled(board)).rejects.toThrow("the board has no view frame");
  });
});

describe("hostSettled", () => {
  test("ends with a board-page evaluate of its own after the one that flushes the view (Firefox, decision 7)", async () => {
    const calls: Call[] = [];
    await hostSettled(fakeBoard(calls));
    expect(order(calls)).toEqual(["view", "page", "page"]);
  });
});

describe("draftSettled", () => {
  test("takes the view's message first, then waits at least DRAFT_DEBOUNCE_MS, then settles the host", async () => {
    const calls: Call[] = [];
    const began = performance.now();
    await draftSettled(fakeBoard(calls));
    const ended = performance.now();
    expect(order(calls)).toEqual(["view", "page", "view", "page", "page"]);
    const firstFlushEnd = calls[1]?.at ?? 0;
    const lastCall = calls.at(-1)?.at ?? 0;
    // The board page's debounce starts when it receives the view's message, which the first flush
    // guarantees has happened: the whole debounce falls between that flush and the last evaluate.
    expect(lastCall - firstFlushEnd).toBeGreaterThanOrEqual(DRAFT_DEBOUNCE_MS - 5);
    expect(ended - began).toBeGreaterThanOrEqual(DRAFT_DEBOUNCE_MS - 5);
    // A fixed wait of a third of the quiet wait, not the quiet wait itself.
    expect(ended - began).toBeLessThan(QUIET_MS);
  });
});

describe("timerSettled", () => {
  test("waits the timer's own time before it settles the view", async () => {
    const calls: Call[] = [];
    const began = performance.now();
    await timerSettled(80, fakeBoard(calls));
    expect(order(calls)).toEqual(["view", "page"]);
    expect((calls[0]?.at ?? 0) - began).toBeGreaterThanOrEqual(75);
  });

  test("refuses a time that is not a finite, non-negative number", async () => {
    const board = fakeBoard([]);
    await expect(timerSettled(-1, board)).rejects.toThrow(/finite/);
    await expect(timerSettled(Number.NaN, board)).rejects.toThrow(/finite/);
  });

  test("the no-reconnect wait is the board page's first reconnect delay, imported", () => {
    expect(NO_RECONNECT_WAIT_MS).toBe(RECONNECT_DELAYS_MS[0] as number);
    expect(NO_RECONNECT_WAIT_MS).toBeLessThan(QUIET_MS);
  });
});

describe("quiet", () => {
  test("refuses an empty reason, with no wait", async () => {
    const began = performance.now();
    await expect(quiet("")).rejects.toThrow(/reason/);
    await expect(quiet("   ")).rejects.toThrow(/reason/);
    expect(performance.now() - began).toBeLessThan(QUIET_MS / 2);
  });

  test("waits QUIET_MS and returns when it has a reason", async () => {
    const began = performance.now();
    await quiet("a unit test of the wait itself");
    expect(performance.now() - began).toBeGreaterThanOrEqual(QUIET_MS - 5);
  });
});

describe("the guard: no fixed quiet wait outside quiet()", () => {
  const refused = (text: string): string[] =>
    quietWaitProblems({ "scratch.browser.ts": text }, 1_500);

  test("refuses Bun.sleep(QUIET_MS) and each fraction of it", () => {
    expect(refused("await Bun.sleep(QUIET_MS);")).toEqual([
      expect.stringMatching(/^scratch\.browser\.ts:1: waits on QUIET_MS/),
    ]);
    expect(refused("await Bun.sleep(QUIET_MS / 3);")).toHaveLength(1);
    expect(refused("await Bun.sleep(QUIET_MS*2)")).toHaveLength(1);
  });

  test("refuses the literal the constant holds, written 1500 or 1_500, and its fractions (C4)", () => {
    expect(refused("await Bun.sleep(1500);")).toEqual([
      expect.stringMatching(/^scratch\.browser\.ts:1: sleeps 1500 ms/),
    ]);
    expect(refused("await Bun.sleep(1_500);")).toHaveLength(1);
    expect(refused("await Bun.sleep( 1500 / 3 );")).toHaveLength(1);
  });

  test("lets another duration through: Bun.sleep(500), the draft debounce, the polling interval", () => {
    expect(refused("await Bun.sleep(500);")).toEqual([]);
    expect(refused("await Bun.sleep(300);\nawait Bun.sleep(50);\nawait Bun.sleep(1_000);")).toEqual(
      [],
    );
  });

  test("gives each refusal its line, and reads an argument over several lines", () => {
    const text = [
      "const a = 1;",
      "await Bun.sleep(",
      "  QUIET_MS,",
      ");",
      "await Bun.sleep(1500);",
    ];
    expect(refused(text.join("\n"))).toEqual([
      expect.stringMatching(/:2: /),
      expect.stringMatching(/:5: /),
    ]);
  });

  test("ignores a comment and a string that name the call", () => {
    expect(refused("// await Bun.sleep(QUIET_MS);\n/* Bun.sleep(1500) */")).toEqual([]);
    expect(refused('const url = "http://x"; await Bun.sleep(QUIET_MS);')).toHaveLength(1);
  });

  test("accepts quiet() with a string literal reason, and refuses one without", () => {
    expect(refused('await quiet("a blob fetch has no message to wait for");')).toEqual([]);
    expect(refused("await quiet(`a reason`);")).toEqual([]);
    expect(refused("await quiet();")).toHaveLength(1);
    expect(refused('await quiet("");')).toHaveLength(1);
    expect(refused('await quiet("   ");')).toHaveLength(1);
    expect(refused("await quiet(reason);")).toHaveLength(1);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: scratch text for the guard, not a template
    expect(refused("await quiet(`a ${reason}`);")).toHaveLength(1);
  });

  test("does not take the definition of quiet, or a method of that name, for a call", () => {
    expect(refused("export const quiet = async (reason: string) => {};")).toEqual([]);
    expect(refused("await thing.quiet(1);")).toEqual([]);
  });

  test("passes every browser file: none waits QUIET_MS or its value outside quiet()", () => {
    const root = join(import.meta.dir, "..");
    const files: Record<string, string> = {};
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".ts"))
          files[relative(root, path)] = readFileSync(path, "utf8");
      }
    };
    walk(root);
    // The guard and its own test name the calls they refuse.
    delete files[join("harness", "quiet-guard.ts")];
    delete files[join("harness", "probes.test.ts")];
    expect(Object.keys(files).length).toBeGreaterThan(145);
    expect(quietWaitProblems(files, QUIET_MS)).toEqual([]);
  });
});
