// The derived values each item last reported through the port's `onDerived` (gantt-widget design
// decision 10; AD-13, AD-20, FR-12): a computing widget, such as the Gantt, reports its declared
// derived values as they stand after each rebuild, and "Answer" carries those of the items it
// carries a value for. Each report replaces the item's last one; nothing here leaves the view.

import type { DerivedValues } from "../catalog/port.ts";

export type DerivedStore = {
  /** Keeps the item's derived values, replacing its last report; an empty report keeps none. */
  report(itemId: string, values: DerivedValues): void;
  /** What the item last reported, frozen, or undefined when it has reported none. */
  reported(itemId: string): DerivedValues | undefined;
};

export const createDerivedStore = (): DerivedStore => {
  // A Map by item ID, and records built from entries, so that any ID or reference is a plain key.
  const reports = new Map<string, DerivedValues>();
  return {
    report: (itemId, values) => {
      const entries = Object.entries(values);
      if (entries.length === 0) reports.delete(itemId);
      else reports.set(itemId, Object.freeze(Object.fromEntries(entries)));
    },
    reported: (itemId) => reports.get(itemId),
  };
};
