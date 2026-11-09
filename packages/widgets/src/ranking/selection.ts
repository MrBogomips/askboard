// The Ranking's row selection (view-and-widgets spec: Ranking row selection; design decision 8): the
// selected elements' IDs and the anchor, the row last toggled or clicked, from which a range
// extends. View state: it is in no draft, result, answer or Snapshot, and a reload loses it (AD-9,
// AD-10). Every function returns a new value and never touches its input; one that changes nothing
// returns the value it was given. Plain ECMAScript.

/** The selected rows and the anchor of the next range. */
export type RowSelection = {
  readonly ids: ReadonlySet<string>;
  /** The row last toggled or clicked, or none. */
  readonly anchor: string | undefined;
};

/** No row selected, no anchor. */
export const NO_SELECTION: RowSelection = { ids: new Set(), anchor: undefined };

/** Toggles `id` and makes it the anchor; a row the order lacks changes nothing. */
export const toggle = (
  selection: RowSelection,
  order: readonly string[],
  id: string,
): RowSelection => {
  if (!order.includes(id)) return selection;
  const ids = new Set(selection.ids);
  if (!ids.delete(id)) ids.add(id);
  return { ids, anchor: id };
};

/**
 * Adds every row from the anchor to `target`, both included, either way round, over `order`. The
 * anchor stays. With no anchor in the order the range starts at `from`, else at `target` itself.
 * A target the order lacks changes nothing.
 */
export const extend = (
  selection: RowSelection,
  order: readonly string[],
  target: string,
  from: string = target,
): RowSelection => {
  const to = order.indexOf(target);
  if (to < 0) return selection;
  const held = selection.anchor !== undefined && order.includes(selection.anchor);
  const anchor = held ? selection.anchor : order.includes(from) ? from : target;
  const start = order.indexOf(anchor as string);
  const between = order.slice(Math.min(start, to), Math.max(start, to) + 1);
  return { ids: new Set([...selection.ids, ...between]), anchor };
};

/** Selects none: the same value `NO_SELECTION` is. */
export const clear = (): RowSelection => NO_SELECTION;

/**
 * The selection without the rows `order` no longer holds, after an agent's revision; the anchor goes
 * with its row. The same value when nothing goes.
 */
export const pruned = (selection: RowSelection, order: readonly string[]): RowSelection => {
  const kept = [...selection.ids].filter((id) => order.includes(id));
  const anchor =
    selection.anchor !== undefined && order.includes(selection.anchor)
      ? selection.anchor
      : undefined;
  return kept.length === selection.ids.size && anchor === selection.anchor
    ? selection
    : { ids: new Set(kept), anchor };
};
