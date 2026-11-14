// The user's keys the shell provides (keyboard-shortcuts-help, design decision 19; view spec: The
// user's keys on the board): the overrides the board page passes on with its updates
// (`ViewUpdate.keys`), kept in a store the board reads through `KeyOverridesContext`. They are
// replaced only when they differ, since each update arrives as a new copy. A Snapshot has no board
// page, so the store stays empty and every widget takes its default keys.

import type { KeyOverrides } from "@askboard/contract";
import { type ReactNode, useSyncExternalStore } from "react";
import { sameOverrides } from "../catalog/keys/effective.ts";
import { KeyOverridesContext } from "../catalog/keys/key-table.tsx";
import { createStore, type Store } from "./store.ts";

/** A store of the overrides in effect that tells its listeners only when they change. */
export const createKeysStore = (): Store<KeyOverrides | undefined> => {
  const store = createStore<KeyOverrides | undefined>(undefined);
  return {
    ...store,
    set: (next) => (sameOverrides(store.get(), next) ? undefined : store.set(next)),
  };
};

/** Takes the overrides of each update the board page sends, or none: its `keys` field is complete in every update. */
export const followKeys = (
  store: Store<KeyOverrides | undefined>,
  channel: { onUpdate(listener: (update: { readonly keys?: KeyOverrides }) => void): void },
): void => {
  channel.onUpdate((update) => store.set(update.keys));
};

export const BoardKeys = ({
  store,
  children,
}: {
  readonly store: Store<KeyOverrides | undefined>;
  readonly children?: ReactNode;
}) => {
  // The server snapshot is the same store, so the provider also renders outside a browser.
  const overrides = useSyncExternalStore(store.subscribe, store.get, store.get);
  return <KeyOverridesContext.Provider value={overrides}>{children}</KeyOverridesContext.Provider>;
};
