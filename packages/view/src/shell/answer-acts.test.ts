import { describe, expect, mock, test } from "bun:test";
import type { ViewAct } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";

const when = "2026-10-30T10:00:00.250Z";
const A = "AAAAAAAAAAAAAAAAAAAAAA";
const B = "BBBBBBBBBBBBBBBBBBBBBB";
const answer: ViewAct = {
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when,
};
const note: ViewAct = { type: "note", itemId: "cache", rev: 1, note: "Later.", when };

describe("the acts the view has sent and the board page has not settled (ask-lifecycle)", () => {
  test("a command starts with no outcome and takes the board page's reply and action ID", () => {
    const acts = createAnswerActs();
    const heard = mock(() => {});
    acts.subscribe(heard);
    const key = acts.start([answer]);
    expect(acts.of("database")).toEqual({ key, acts: [answer] });
    acts.replied(key, { outcome: "queued", actionId: A });
    expect(acts.of("database")).toEqual({ key, acts: [answer], actionId: A, outcome: "queued" });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test("a command touches each question it holds an act for", () => {
    const acts = createAnswerActs();
    acts.start([answer, note]);
    expect(acts.of("database")?.acts).toEqual([answer, note]);
    expect(acts.of("cache")?.acts).toEqual([answer, note]);
    expect(acts.of("other")).toBeUndefined();
  });

  test("a question's commands can be read for some act types only: a follow-up never holds the card (task 6.5)", () => {
    const acts = createAnswerActs();
    const followUp: ViewAct = { type: "follow-up", itemId: "database", rev: 1, text: "Why?", when };
    const first = acts.start([answer]);
    acts.start([followUp]);
    expect(acts.of("database")?.acts).toEqual([followUp]);
    expect(acts.of("database", ["answer", "postpone"])?.key).toBe(first);
    expect(acts.of("database", ["follow-up"])?.acts).toEqual([followUp]);
    expect(acts.of("database", ["reopen"])).toBeUndefined();
    expect(acts.of("cache", ["follow-up"])).toBeUndefined();
  });

  test("each change moves its version, so that a view of every command can follow it", () => {
    const acts = createAnswerActs();
    expect(acts.version()).toBe(0);
    const key = acts.start([answer]);
    expect(acts.version()).toBe(1);
    acts.replied(key, { outcome: "sent", actionId: A });
    expect(acts.version()).toBe(2);
    acts.drop(99);
    expect(acts.version()).toBe(2);
  });

  test("a refusal, or no reply, drops it: the question is open again", () => {
    const acts = createAnswerActs();
    const refused = acts.start([answer]);
    acts.replied(refused, { outcome: "refused", detail: "not open" });
    expect(acts.of("database")).toBeUndefined();
    const lost = acts.start([answer]);
    acts.replied(lost, undefined);
    expect(acts.of("database")).toBeUndefined();
    const failed = acts.start([answer]);
    acts.drop(failed);
    expect(acts.of("database")).toBeUndefined();
  });

  test("an update moves its outcome, settles it once the board page no longer holds it, and returns those done", () => {
    const acts = createAnswerActs();
    const first = acts.start([answer]);
    acts.replied(first, { outcome: "queued", actionId: A });
    expect(acts.reconcile([{ actionId: A, outcome: "sent" }], [])).toEqual([]);
    expect(acts.of("database")?.outcome).toBe("sent");
    const second = acts.start([note]);
    acts.replied(second, { outcome: "sent", actionId: B });
    const done = acts.reconcile(
      [],
      [
        { actionId: A, outcome: "done" },
        { actionId: B, outcome: "refused" },
      ],
    );
    expect(done.map(({ acts: settled }) => settled)).toEqual([[answer]]);
    expect(acts.of("database")).toBeUndefined();
    expect(acts.of("cache")).toBeUndefined();
  });

  test("a command with no reply yet is left alone; one neither held nor settled was dropped", () => {
    const acts = createAnswerActs();
    acts.start([answer]);
    expect(acts.reconcile([], [])).toEqual([]);
    expect(acts.of("database")).toBeDefined();
    const other = acts.start([note]);
    acts.replied(other, { outcome: "sent", actionId: B });
    expect(acts.reconcile([], [])).toEqual([]);
    expect(acts.of("cache")).toBeUndefined();
  });

  test("a reply for a command no longer started changes nothing", () => {
    const acts = createAnswerActs();
    const key = acts.start([answer]);
    acts.drop(key);
    const heard = mock(() => {});
    acts.subscribe(heard);
    acts.replied(key, { outcome: "sent", actionId: A });
    acts.drop(key);
    expect(heard).not.toHaveBeenCalled();
  });
});

describe("the commands the board page settled as refused for being too large (oversized-acts)", () => {
  test("tooLarge names the replied commands the settled list marks, and nothing else", () => {
    const acts = createAnswerActs();
    const first = acts.start([answer]);
    acts.replied(first, { outcome: "sent", actionId: A });
    const second = acts.start([note]);
    acts.replied(second, { outcome: "sent", actionId: B });
    acts.start([note]);
    const flights = acts.tooLarge([
      { actionId: A, outcome: "refused", tooLarge: true },
      { actionId: B, outcome: "refused" },
      { actionId: "CCCCCCCCCCCCCCCCCCCCCC", outcome: "refused", tooLarge: true },
    ]);
    expect(flights.map((flight) => flight.acts)).toEqual([[answer]]);
    // Reading changes nothing: the update's reconcile settles it as it does any refusal.
    expect(acts.of("database")).toBeDefined();
    acts.reconcile([], [{ actionId: A, outcome: "refused", tooLarge: true }]);
    expect(acts.of("database")).toBeUndefined();
    expect(acts.tooLarge([{ actionId: A, outcome: "refused", tooLarge: true }])).toEqual([]);
  });
});
