import { describe, expect, test } from "bun:test";
import { createStatusMessages } from "./status-messages.ts";

// The status store (answering-flow-fixes, design decision 4; #182).
describe("the status store", () => {
  test("starts empty", () => {
    expect(createStatusMessages().get()).toEqual({ n: 0, messages: [] });
  });

  test("announce raises n and notifies the listeners", () => {
    const store = createStatusMessages();
    let heard = 0;
    const off = store.subscribe(() => {
      heard += 1;
    });
    store.announce({ key: "status.answerSentPlain" });
    expect(heard).toBe(1);
    expect(store.get().n).toBe(1);
    off();
    store.announce({ key: "status.answerSentPlain" });
    expect(heard).toBe(1);
  });

  test("descriptors announced before a read come back together, in order", () => {
    const store = createStatusMessages();
    store.announce({ key: "status.ready", params: { count: 2 } });
    store.announce({ key: "status.noteSent" });
    expect(store.get().messages).toEqual([
      { key: "status.ready", params: { count: 2 } },
      { key: "status.noteSent" },
    ]);
  });

  test("the same snapshot comes back until something is announced", () => {
    const store = createStatusMessages();
    store.announce({ key: "status.noteSent" });
    expect(store.get()).toBe(store.get());
  });

  test("a later turn of the event loop starts a new batch", async () => {
    const store = createStatusMessages();
    store.announce({ key: "status.noteSent" });
    await Promise.resolve();
    store.announce({ key: "status.answerSentPlain" });
    expect(store.get().messages).toEqual([{ key: "status.answerSentPlain" }]);
  });

  test("a repeated descriptor raises n again", () => {
    const store = createStatusMessages();
    store.announce({ key: "status.noteSent" });
    const first = store.get().n;
    store.announce({ key: "status.noteSent" });
    expect(store.get().n).toBe(first + 1);
  });
});
