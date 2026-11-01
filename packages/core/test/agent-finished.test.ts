import { describe, expect, test } from "bun:test";
import { type ClosedEvent, SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { answer, askWith } from "./fakes.ts";
import { callOf, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// Core spec: Closing a finished subagent's asks (task 3.6, design decision 5; AD-10, FR-25): when
// the stop guard lets a subagent stop, ask-core closes every open ask it owns with reason
// `agent-finished`, through the ask lifecycle's close, appending the `closed` event, which the
// owner reads if it is resumed; the board hears the close and the ask takes no more answers.

const ASK_ID = "order-db-choice-x7k2";
const OTHER_ID = "cache-choice-b5n1";
const UNCHECKED_ID = "retry-policy-q3m8";

const fixture = async () => {
  const made = pushCoreWith({ git: "Paola Greco" });
  for (const [ownerKey, askId] of [
    ["reviewer-1", ASK_ID],
    ["reviewer-2", OTHER_ID],
  ] as const) {
    made.table.add({ ownerKey, tool: "ask", askIds: [askId], origin: REVIEWER_ORIGIN });
    await made.core.ask(askWith({ askId }), callOf("ask", askId));
  }
  await made.core.ask(askWith({ askId: UNCHECKED_ID }));
  return made;
};

const closedOf = (core: Awaited<ReturnType<typeof fixture>>["core"], askId: string) =>
  core.lifecycleBoard(askId)?.state;

describe("a subagent the stop guard lets finish", () => {
  test("has its open asks closed with agent-finished and the closed event appended", async () => {
    const { core, heard } = await fixture();
    expect(core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
    expect(closedOf(core, ASK_ID)).toBe("closed");
    const read = core.read(ASK_ID, `${core.epoch}.0`, { ownerKey: "reviewer-1" });
    if (read.kind !== "events") throw new Error(`no events: ${read.kind}`);
    const closed: ClosedEvent = {
      cursor: `${core.epoch}.1`,
      type: "closed",
      reason: "agent-finished",
    };
    expect(read.events).toEqual([closed]);
    expect(read.state).toBe("closed");
    expect(validateAgainst(SCHEMA_IDS.closedEvent, closed).ok).toBe(true);
    // The board hears the event, then the close, which wakes the ask's waiters.
    expect(heard.slice(-2)).toEqual([
      { type: "appended", askId: ASK_ID, event: closed, events: [closed] },
      { type: "closed", askId: ASK_ID, reason: "agent-finished" },
    ]);
    expect(core.answer(ASK_ID, answer())).toMatchObject({ ok: false });
  });

  test("leaves another owner's asks and unchecked asks open, and closes nothing twice", async () => {
    const { core, heard } = await fixture();
    core.stop("reviewer-1", false);
    expect(closedOf(core, OTHER_ID)).toBe("waiting");
    expect(closedOf(core, UNCHECKED_ID)).toBe("waiting");
    const before = heard.length;
    expect(core.stop("reviewer-1", true)).toEqual({ decision: "allow" });
    expect(heard.length).toBe(before);
  });

  test("a block closes nothing; the stop that follows, with stop_hook_active, closes the ask", async () => {
    const { core } = await fixture();
    core.answer(ASK_ID, answer());
    expect(core.stop("reviewer-1", false)).toMatchObject({ decision: "block" });
    expect(closedOf(core, ASK_ID)).toBe("answered");
    expect(core.stop("reviewer-1", true)).toEqual({ decision: "allow" });
    expect(closedOf(core, ASK_ID)).toBe("closed");
  });
});
