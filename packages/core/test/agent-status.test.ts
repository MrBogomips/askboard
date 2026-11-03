import { describe, expect, test } from "bun:test";
import { BACKGROUND_THRESHOLD_DEFAULT_MS } from "@askboard/contract";
import { backgroundThreshold, type CoreEvent } from "../src/index.ts";
import { answer, plainChoiceAsk } from "./fakes.ts";
import { callOf, MAIN_ORIGIN, type PushFakeOptions, pushCoreWith } from "./push-fakes.ts";

// Core spec: Agent status of an ask (task 8.2, design decision 12; AD-4). Presence only: each ask is
// `working` from its creation; `waiting` while a waiting `collect` on it is pending, except a
// main-conversation call past Claude Code's background threshold, or while the mod reports that
// the owner has no turn running. Each change is published once, and nothing is logged.

const ASK_ID = "order-db-choice-x7k2";
const THRESHOLD = 120_000;

// ask-core with the header's ports, and the agent statuses it published.
const statusCore = async (
  options: PushFakeOptions & { readonly owner?: string } = {},
  threshold: number | null = THRESHOLD,
) => {
  const made = pushCoreWith({ git: "Paola Greco", header: { backgroundThresholdMs: threshold } });
  if (options.owner !== undefined) {
    made.table.add({ ownerKey: options.owner, tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
  }
  const outcome = await made.core.ask(
    plainChoiceAsk(),
    options.owner === undefined ? undefined : callOf("ask", ASK_ID),
  );
  if (outcome.kind !== "created") throw new Error(`ask not created: ${outcome.kind}`);
  const published = () =>
    made.heard.flatMap((event: CoreEvent) =>
      event.type === "agent" ? [`${event.askId} ${event.status}`] : [],
    );
  return { ...made, published };
};

const waiting = `${ASK_ID} waiting`;
const working = `${ASK_ID} working`;

describe("the background threshold", () => {
  test("is Claude Code's default when the variable is unset or empty", () => {
    expect(backgroundThreshold(undefined)).toBe(BACKGROUND_THRESHOLD_DEFAULT_MS);
    expect(backgroundThreshold("")).toBe(BACKGROUND_THRESHOLD_DEFAULT_MS);
    expect(BACKGROUND_THRESHOLD_DEFAULT_MS).toBe(120_000);
  });

  test("is the variable's milliseconds when set", () => {
    expect(backgroundThreshold("30000")).toBe(30_000);
    expect(backgroundThreshold(" 45000 ")).toBe(45_000);
  });

  test("is never when the variable is 0", () => {
    expect(backgroundThreshold("0")).toBeUndefined();
  });

  test("is the default when the variable is not a count of milliseconds", () => {
    for (const value of ["soon", "-5", "1.5", "1e5", "0x10"]) {
      expect(backgroundThreshold(value)).toBe(BACKGROUND_THRESHOLD_DEFAULT_MS);
    }
  });
});

describe("nothing reports", () => {
  test("a new ask is working, and stays so", async () => {
    const { core, clock, published } = await statusCore();
    expect(core.agentStatus(ASK_ID)).toBe("working");
    clock.advance(10 * THRESHOLD);
    expect(core.agentStatus(ASK_ID)).toBe("working");
    expect(published()).toEqual([]);
  });

  test("an ask this epoch does not hold has no status", async () => {
    const { core } = await statusCore();
    expect(core.agentStatus("another-ask")).toBeUndefined();
  });
});

describe("a waiting collect", () => {
  test("a subagent's wait makes the ask waiting at once, and working when it ends", async () => {
    const { core, clock, published } = await statusCore();
    const end = core.waitStarted(ASK_ID, false);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    expect(published()).toEqual([waiting]);
    // A subagent's call is never moved to the background.
    clock.advance(10 * THRESHOLD);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    end();
    expect(core.agentStatus(ASK_ID)).toBe("working");
    expect(published()).toEqual([waiting, working]);
    end();
    expect(published()).toEqual([waiting, working]);
  });

  test("a main-conversation wait counts until the background threshold", async () => {
    const { core, clock, published } = await statusCore();
    const end = core.waitStarted(ASK_ID, true);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    clock.advance(THRESHOLD - 1);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    clock.advance(1);
    expect(core.agentStatus(ASK_ID)).toBe("working");
    end();
    expect(published()).toEqual([waiting, working]);
  });

  test("the core's clock, the grace timer's, runs the background threshold", async () => {
    const { core, clock, published } = await statusCore();
    const before = clock.pending;
    const end = core.waitStarted(ASK_ID, true);
    expect(clock.pending).toBe(before + 1);
    clock.advance(THRESHOLD);
    expect(core.agentStatus(ASK_ID)).toBe("working");
    expect(clock.pending).toBe(before);
    end();
    expect(published()).toEqual([waiting, working]);
  });

  test("a main-conversation wait that ends before the threshold leaves no timer", async () => {
    const { core, clock, published } = await statusCore();
    const end = core.waitStarted(ASK_ID, true);
    end();
    expect(clock.pending).toBe(0);
    clock.advance(THRESHOLD);
    expect(published()).toEqual([waiting, working]);
  });

  test("with the variable set, its threshold counts", async () => {
    const { core, clock } = await statusCore({}, 30_000);
    core.waitStarted(ASK_ID, true);
    clock.advance(30_000);
    expect(core.agentStatus(ASK_ID)).toBe("working");
  });

  test("with the variable 0, a main-conversation wait counts until it ends", async () => {
    const { core, clock, published } = await statusCore({}, null);
    const end = core.waitStarted(ASK_ID, true);
    clock.advance(10 * THRESHOLD);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    end();
    expect(published()).toEqual([waiting, working]);
  });

  test("without the header's ports, as in E1, a main-conversation wait counts until it ends", async () => {
    const { core } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    const end = core.waitStarted(ASK_ID, true);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    end();
    expect(core.agentStatus(ASK_ID)).toBe("working");
  });

  test("two waits on one ask: waiting until the last counted one ends, published once", async () => {
    const { core, published } = await statusCore();
    const first = core.waitStarted(ASK_ID, false);
    const second = core.waitStarted(ASK_ID, false);
    first();
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    second();
    expect(published()).toEqual([waiting, working]);
  });

  test("a wait on an ask this epoch does not hold changes nothing", async () => {
    const { core, published } = await statusCore();
    core.waitStarted("another-ask", false)();
    expect(published()).toEqual([]);
  });
});

describe("turn reports", () => {
  test("the owner's turn ending makes its asks waiting, and its next turn working", async () => {
    const { core, published } = await statusCore({ owner: "owner-1" });
    core.turnReported("owner-1", false);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    core.turnReported("owner-1", false);
    core.turnReported("owner-1", true);
    expect(core.agentStatus(ASK_ID)).toBe("working");
    expect(published()).toEqual([waiting, working]);
  });

  test("another agent's turns change nothing", async () => {
    const { core, published } = await statusCore({ owner: "owner-1" });
    core.turnReported("owner-2", false);
    expect(core.agentStatus(ASK_ID)).toBe("working");
    expect(published()).toEqual([]);
  });

  test("an unchecked ask has no owner whose turns count", async () => {
    const { core, published } = await statusCore();
    core.turnReported("owner-1", false);
    expect(published()).toEqual([]);
  });

  test("a turn report that came before the ask counts for it", async () => {
    const made = pushCoreWith({ header: { backgroundThresholdMs: THRESHOLD } });
    made.core.turnReported("owner-1", false);
    made.table.add({ ownerKey: "owner-1", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    await made.core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    expect(made.core.agentStatus(ASK_ID)).toBe("waiting");
  });
});

describe("both signals together", () => {
  test("a main-conversation wait past the threshold stays waiting while the owner has no turn", async () => {
    const { core, clock, published } = await statusCore({ owner: "owner-1" });
    const end = core.waitStarted(ASK_ID, true);
    clock.advance(THRESHOLD);
    expect(published()).toEqual([waiting, working]);
    core.turnReported("owner-1", false);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    end();
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    core.turnReported("owner-1", true);
    expect(published()).toEqual([waiting, working, waiting, working]);
  });

  test("a wait over an idle owner changes nothing until both end", async () => {
    const { core, published } = await statusCore({ owner: "owner-1" });
    core.turnReported("owner-1", false);
    const end = core.waitStarted(ASK_ID, false);
    core.turnReported("owner-1", true);
    expect(core.agentStatus(ASK_ID)).toBe("waiting");
    end();
    expect(published()).toEqual([waiting, working]);
  });
});

describe("presence only", () => {
  test("no status change is logged as an event, and an answer still is", async () => {
    const { core, heard } = await statusCore({ owner: "owner-1" });
    const end = core.waitStarted(ASK_ID, false);
    core.turnReported("owner-1", false);
    core.answer(ASK_ID, answer());
    end();
    core.turnReported("owner-1", true);
    const read = core.read(ASK_ID, `${core.epoch}.0`, { ownerKey: "owner-1" });
    expect(read.kind === "events" && read.events.map((event) => event.type)).toEqual(["answer"]);
    expect(heard.filter((event) => event.type === "appended")).toHaveLength(1);
  });

  test("a listener that throws on a status change is reported, and the others still hear it", async () => {
    const { core, reported, published } = await statusCore();
    core.subscribe(() => {
      throw new Error("the board's socket is gone");
    });
    core.waitStarted(ASK_ID, false);
    expect(published()).toEqual([waiting]);
    expect(reported).toHaveLength(1);
  });
});
