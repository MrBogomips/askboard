// The keys in effect, as a component of the port reads them (keyboard-shortcuts-help, design
// decision 19; view spec: The user's keys on the board): the shell provides the user's key
// overrides (`KeyOverridesContext`), `useKeyTable(table)` gives a widget type's table with them
// applied, each entry with its source, memoised over the overrides, and the item frame provides that
// table to the widget it wraps (`KeyTableContext`), so a hint looks its entry up there. Without a
// provider no keys are overridden and every entry is the table's own, which is today's behaviour.

import type { KeyOverrides, KeyTable } from "@askboard/contract";
import { createContext, useContext, useMemo } from "react";
import { type KeyInEffect, keysOpenEntryOf, keyTableOf } from "./effective.ts";

/** The user's key overrides that the shell applies: none when the user's file gives none. */
export const KeyOverridesContext = createContext<KeyOverrides | undefined>(undefined);

/** The overrides the shell provides; undefined where none apply, and for a Snapshot. */
export const useKeyOverrides = (): KeyOverrides | undefined => useContext(KeyOverridesContext);

/** The table in effect of the item frame the caller sits in; undefined outside a frame with one. */
export const KeyTableContext = createContext<readonly KeyInEffect[] | undefined>(undefined);

/**
 * `table` with the user's overrides applied, each entry marked with whose keys it holds, the
 * table's or the user's. The same array while the table and the overrides are the same.
 */
export function useKeyTable(table: KeyTable): readonly KeyInEffect[];
export function useKeyTable(table: KeyTable | undefined): readonly KeyInEffect[] | undefined;
export function useKeyTable(table: KeyTable | undefined): readonly KeyInEffect[] | undefined {
  const overrides = useKeyOverrides();
  return useMemo(
    () => (table === undefined ? undefined : keyTableOf(table, overrides)),
    [table, overrides],
  );
}

/** The keys panel's own `keys.open` in effect: the same in every frame, `?` unless the user's file says otherwise. */
export const useKeysOpenEntry = (): KeyInEffect => {
  const overrides = useKeyOverrides();
  return useMemo(() => keysOpenEntryOf(overrides), [overrides]);
};
