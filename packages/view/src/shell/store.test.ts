import { describe, expect, mock, test } from "bun:test";
import { createStore } from "./store.ts";

describe("a value the view renders from and that changes after boot", () => {
  test("holds the latest value", () => {
    const store = createStore({ ask: "waiting" });
    const next = { ask: "answered" };
    store.set(next);
    expect(store.get()).toBe(next);
  });

  test("subscribers hear each new value, not the same one again", () => {
    const first = { ask: "waiting" };
    const store = createStore(first);
    const listener = mock(() => {});
    const unsubscribe = store.subscribe(listener);
    store.set(first);
    store.set({ ask: "answered" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set({ ask: "waiting" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
