import { describe, expect, mock, test } from "bun:test";
import type { PendingAnswer } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";

const when = "2026-10-30T10:00:00.250Z";
const pending = (outcome: PendingAnswer["outcome"], at = when): PendingAnswer => ({
  itemId: "database",
  choice: ["PostgreSQL"],
  when: at,
  outcome,
});

describe("the answers the view has given and the board page has not settled (M3)", () => {
  test("an act starts with no outcome and takes the board page's reply", () => {
    const acts = createAnswerActs();
    const heard = mock(() => {});
    acts.subscribe(heard);
    acts.start("database", ["PostgreSQL"], when);
    expect(acts.of("database")).toEqual({ choice: ["PostgreSQL"], when });
    acts.replied("database", when, "queued");
    expect(acts.of("database")).toEqual({ choice: ["PostgreSQL"], when, outcome: "queued" });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test("a refused act is dropped at once, and a reply to an older act is ignored", () => {
    const acts = createAnswerActs();
    acts.start("database", ["PostgreSQL"], when);
    acts.replied("database", "2026-10-30T09:00:00Z", "sent");
    expect(acts.of("database")?.outcome).toBeUndefined();
    acts.drop("database", when);
    expect(acts.of("database")).toBeUndefined();
    acts.drop("database", when);
  });

  test("an update after the reply that no longer holds the answer drops the act", () => {
    const acts = createAnswerActs();
    acts.start("database", ["PostgreSQL"], when);
    acts.reconcile([]);
    expect(acts.of("database")).toBeDefined();
    acts.replied("database", when, "sent");
    acts.reconcile([pending("sent")]);
    expect(acts.of("database")).toBeDefined();
    acts.reconcile([pending("sent", "2026-10-30T09:00:00Z")]);
    expect(acts.of("database")).toBeUndefined();
  });

  test("an update the act does not depend on leaves the listeners alone", () => {
    const acts = createAnswerActs();
    const heard = mock(() => {});
    const unsubscribe = acts.subscribe(heard);
    acts.reconcile([]);
    expect(heard).not.toHaveBeenCalled();
    unsubscribe();
    acts.start("database", ["PostgreSQL"], when);
    expect(heard).not.toHaveBeenCalled();
  });
});
