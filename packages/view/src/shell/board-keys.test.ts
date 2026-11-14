import { describe, expect, test } from "bun:test";
import type { KeyOverrides } from "@askboard/contract";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useKeyOverrides } from "../catalog/keys/key-table.tsx";
import { BoardKeys, createKeysStore, followKeys } from "./board-keys.tsx";

// The user's keys the shell provides (keyboard-shortcuts-help, task 10.2; design decision 19): the
// overrides of the latest update, replaced only when they differ, so an update that carries a new
// copy of the same keys renders nothing again; a Snapshot has no board page and so none.

describe("the keys store", () => {
  test("starts with no overrides", () => {
    expect(createKeysStore().get()).toBeUndefined();
  });

  test("an update's keys replace them, and an update with none takes them away", () => {
    const store = createKeysStore();
    const keys: KeyOverrides = { "move.top": ["Mod+Alt+ArrowUp"] };
    store.set(keys);
    expect(store.get()).toBe(keys);
    store.set(undefined);
    expect(store.get()).toBeUndefined();
  });

  test("a new copy of the same keys changes nothing and tells no listener", () => {
    const store = createKeysStore();
    const first: KeyOverrides = { "move.top": ["Mod+Alt+ArrowUp"], "select.all": [] };
    store.set(first);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.set({ "select.all": [], "move.top": ["Mod+Alt+ArrowUp"] });
    expect(store.get()).toBe(first);
    expect(calls).toBe(0);
    store.set({ "move.top": [] });
    expect(calls).toBe(1);
  });
});

describe("followKeys", () => {
  test("takes the keys of each update from the channel, or none", () => {
    const store = createKeysStore();
    let listener: ((update: { keys?: KeyOverrides }) => void) | undefined;
    followKeys(store, { onUpdate: (next) => (listener = next) });
    listener?.({ keys: { "move.top": [] } });
    expect(store.get()).toEqual({ "move.top": [] });
    listener?.({});
    expect(store.get()).toBeUndefined();
  });
});

let seen: KeyOverrides | undefined;
const Reader = () => {
  seen = useKeyOverrides();
  return null;
};

describe("BoardKeys", () => {
  test("provides the store's overrides to what it wraps", () => {
    const store = createKeysStore();
    store.set({ "move.top": [] });
    renderToStaticMarkup(createElement(BoardKeys, { store }, createElement(Reader)));
    expect(seen).toEqual({ "move.top": [] });
  });

  test("provides none while the store holds none", () => {
    renderToStaticMarkup(
      createElement(BoardKeys, { store: createKeysStore() }, createElement(Reader)),
    );
    expect(seen).toBeUndefined();
  });
});
