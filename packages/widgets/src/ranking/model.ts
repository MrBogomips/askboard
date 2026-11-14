// The Ranking's model (view-and-widgets spec: Ranking reorder; design decision 8): the order is a
// list of element IDs, each once. It holds the agent's order, a drop before or after a row, and the
// counter's moved rows; the moves of a selection or of a row are `moves.ts`'s. Pure: an edit that
// changes nothing returns the same array it was given.

import type { RankingProps } from "@askboard/contract";

/** The agent's order: the IDs of the props' elements as sent. */
const sentOrder = (props: RankingProps): readonly string[] => props.items.map(({ id }) => id);

const isPermutation = (order: readonly unknown[], of: readonly string[]): order is string[] =>
  order.length === of.length &&
  new Set(order).size === of.length &&
  order.every((id) => typeof id === "string" && of.includes(id));

// The order a result holds when it names exactly the props' elements, else none.
const heldOrder = (result: unknown, props: RankingProps): readonly string[] | undefined => {
  const held =
    typeof result === "object" && result !== null
      ? (result as { order?: unknown }).order
      : undefined;
  return Array.isArray(held) && isPermutation(held, sentOrder(props)) ? held : undefined;
};

/**
 * The order to show: the held `result`'s when it names exactly the props' elements, else the
 * agent's (nothing held, or a result that no longer fits the props).
 */
export const orderOf = (result: unknown, props: RankingProps): readonly string[] =>
  heldOrder(result, props) ?? sentOrder(props);

/** Whether `result` holds an order the Ranking shows: the user gave one, the agent's own included. */
export const holdsOrder = (result: unknown, props: RankingProps): boolean =>
  heldOrder(result, props) !== undefined;

const placed = (order: readonly string[], id: string, at: number): readonly string[] => {
  const rest = order.filter((other) => other !== id);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
};

/**
 * `order` after dropping `id` on the row `targetId` at `fraction` of its height from the top: the
 * top half drops before it, the rest after it. A drop that leaves the row where it is, or names an
 * unknown row, gives the same order.
 */
export const dropAt = (
  order: readonly string[],
  id: string,
  targetId: string,
  fraction: number,
): readonly string[] => {
  if (id === targetId || !order.includes(id) || !order.includes(targetId)) return order;
  const rest = order.filter((other) => other !== id);
  const target = rest.indexOf(targetId);
  const next = placed(order, id, fraction < 0.5 ? target : target + 1);
  return next.every((other, at) => other === order[at]) ? order : next;
};

/** The elements not where the agent put them, in `order`'s order: the rows that take the highlight. */
export const movedOf = (order: readonly string[], props: RankingProps): readonly string[] => {
  const sent = sentOrder(props);
  return order.filter((id, at) => sent[at] !== id);
};
