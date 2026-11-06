// What a DOM event in the treegrid is about, read from the hooks the rows and cells carry: a row's
// `data-node-id`, a cell's `data-cell` (0 the name, then one per column) and a chevron's
// `data-chevron`. The grid handles its rows' events in one place (design decision 6).

import type { TreeFocus } from "./model/focus.ts";

const NODE = "data-node-id";
const CELL = "data-cell";

/** The row or cell an event's target is, itself: `undefined` for anything inside them. */
export const focusTargetOf = (target: EventTarget | null): TreeFocus | undefined => {
  if (!(target instanceof Element) || !target.matches(`[${NODE}], [${CELL}]`)) return undefined;
  const nodeId = target.closest(`[${NODE}]`)?.getAttribute(NODE);
  if (nodeId === null || nodeId === undefined) return undefined;
  const cell = target.getAttribute(CELL);
  return cell === null ? { nodeId } : { nodeId, cell: Number(cell) };
};

/** The node whose row holds an event's target, a cell, a chevron or the row itself. */
export const rowNodeOf = (target: EventTarget | null): string | undefined =>
  target instanceof Element
    ? (target.closest(`[${NODE}]`)?.getAttribute(NODE) ?? undefined)
    : undefined;

/** The cell an event's target is in, or is: a double click on a cell's text is on it. */
export const cellTargetOf = (target: EventTarget | null): TreeFocus | undefined => {
  if (!(target instanceof Element) || chevronNodeOf(target) !== undefined) return undefined;
  const cell = target.closest(`[${CELL}]`);
  return cell === null ? undefined : focusTargetOf(cell);
};

/** The node whose chevron holds an event's target, if any. */
export const chevronNodeOf = (target: EventTarget | null): string | undefined => {
  if (!(target instanceof Element)) return undefined;
  return target.closest("[data-chevron]")?.closest(`[${NODE}]`)?.getAttribute(NODE) ?? undefined;
};
