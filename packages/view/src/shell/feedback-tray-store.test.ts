import { describe, expect, test } from "bun:test";
import { createTray, goTargetOf, type TrayMessage } from "./feedback-tray-store.ts";

// The feedback tray's store (answering-flow-visual, design decision 11).
const snapshot = (key: "a" | "b" = "a"): TrayMessage => ({
  kind: "snapshot",
  text: { key: "status.next", params: { title: key } },
});
const prefill: TrayMessage = { kind: "prefill", text: { key: "status.prefillUndone" } };
const added = (...questions: string[]): TrayMessage => ({
  kind: "added",
  text: { key: "status.next" },
  questions,
});
const kinds = (tray: ReturnType<typeof createTray>) => tray.get().map((entry) => entry.kind);

describe("the messages", () => {
  test("one message per kind, newest first", () => {
    const tray = createTray();
    tray.show(snapshot());
    tray.show(prefill);
    tray.show(added("q1"));
    expect(kinds(tray)).toEqual(["added", "prefill", "snapshot"]);
  });

  test("a newer message of a kind replaces the older, and moves to the front", () => {
    const tray = createTray();
    tray.show(snapshot("a"));
    tray.show(prefill);
    tray.show(snapshot("b"));
    expect(kinds(tray)).toEqual(["snapshot", "prefill"]);
    expect(tray.get()[0]).toMatchObject({ text: { params: { title: "b" } } });
  });

  test("close ends the message of the kind and no other", () => {
    const tray = createTray();
    tray.show(snapshot());
    tray.show(prefill);
    tray.close("snapshot");
    expect(kinds(tray)).toEqual(["prefill"]);
    tray.close("snapshot");
    expect(kinds(tray)).toEqual(["prefill"]);
  });

  test("the snapshot's note rides with it", () => {
    const tray = createTray();
    tray.show({ ...snapshot(), note: { key: "status.postponed" } } as TrayMessage);
    expect(tray.get()[0]).toMatchObject({ note: { key: "status.postponed" } });
  });
});

describe("the ends", () => {
  test("a batch end removes the prefill message only", () => {
    const tray = createTray();
    tray.show(snapshot());
    tray.show(prefill);
    tray.show(added("q1"));
    tray.batchEnded();
    expect(kinds(tray)).toEqual(["added", "snapshot"]);
  });

  test("an added message stays while any question it names is unseen", () => {
    const tray = createTray();
    tray.show(added("q1", "q2"));
    tray.unseenChanged(new Set(["q2", "q9"]));
    expect(kinds(tray)).toEqual(["added"]);
    tray.unseenChanged(new Set(["q9"]));
    expect(kinds(tray)).toEqual([]);
  });

  test("unseen changes leave the other kinds alone", () => {
    const tray = createTray();
    tray.show(snapshot());
    tray.show(prefill);
    tray.unseenChanged(new Set());
    expect(kinds(tray)).toEqual(["prefill", "snapshot"]);
  });

  test("with an injected clock, an hour passing removes nothing", () => {
    let now = 0;
    const tray = createTray(() => now);
    tray.show(snapshot());
    tray.show(prefill);
    tray.show(added("q1"));
    const before = tray.get();
    now += 60 * 60 * 1000;
    expect(tray.get()).toBe(before);
    expect(tray.get().map((entry) => entry.at)).toEqual([0, 0, 0]);
  });
});

describe("subscription", () => {
  test("listeners hear a change, not a no-op, and stop when they unsubscribe", () => {
    const tray = createTray();
    let heard = 0;
    const off = tray.subscribe(() => {
      heard += 1;
    });
    tray.close("snapshot");
    tray.batchEnded();
    tray.unseenChanged(new Set());
    expect(heard).toBe(0);
    tray.show(prefill);
    expect(heard).toBe(1);
    off();
    tray.close("prefill");
    expect(heard).toBe(1);
  });
});

describe("goTargetOf", () => {
  test("the first named question still unseen", () => {
    const message = added("q1", "q2", "q3") as Extract<TrayMessage, { kind: "added" }>;
    expect(goTargetOf(message, new Set(["q3", "q2"]))).toBe("q2");
    expect(goTargetOf(message, new Set())).toBeUndefined();
  });
});
