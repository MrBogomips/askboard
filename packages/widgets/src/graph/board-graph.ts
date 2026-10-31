// The board's compute graph in the view (design decision 7, AD-13): the live graph, of the board's
// items with the draft record's values in place of their props, and the sent graph, of the items
// as the agent sent them, which the baseline reads. Each is built through `compute` and memoized by
// the identity of the items list and of the draft record, so that every Gantt on a board shares one
// build and the sent graph is built once per board revision. A board holding nothing to compute
// builds nothing. Written to move behind the port, into a library chunk, when a second computing
// widget comes. Plain ECMAScript: no DOM, no `Date`.

import {
  boardGraphSource,
  buildGraph,
  evaluateGraph,
  type FormulaError,
  type NodeResult,
} from "@askboard/compute";

/** A widget item as the board sent it: its type, its ID and its props. */
export type BoardContentItem = {
  readonly type: string;
  readonly id: string;
  readonly props: unknown;
};

/**
 * What a component reads of its board: the widget items as sent, every question's items
 * flattened, and the draft record, item ID to edited value, with no entry for an untouched item.
 */
export type BoardContent = {
  readonly items: readonly BoardContentItem[];
  readonly draft: ReadonlyMap<string, unknown>;
};

/** A built and evaluated graph, read-only: a node's value or error, and the build's warnings. */
export type BoardGraph = {
  /** A node's value, or the error it reads as; an unknown address reads as `missing-reference`. */
  readonly read: (address: string) => NodeResult;
  readonly warnings: readonly FormulaError[];
};

// Undefined is a value too: the board holds nothing to compute.
const SENT = new WeakMap<object, BoardGraph | undefined>();
const LIVE = new WeakMap<object, WeakMap<object, BoardGraph | undefined>>();

/** The graph of the items, or undefined when they hold nothing to compute; throws when malformed. */
const build = (items: readonly BoardContentItem[]): BoardGraph | undefined => {
  const source = boardGraphSource(items);
  if (source.items.length === 0) return undefined;
  const graph = buildGraph(source);
  const values = evaluateGraph(graph);
  return Object.freeze({
    read: (address: string) => values.read(address),
    warnings: graph.warnings,
  });
};

/** The graph of the board's items as the agent sent them. */
export const sentGraph = (board: BoardContent): BoardGraph | undefined => {
  const { items } = board;
  if (SENT.has(items)) return SENT.get(items);
  const graph = build(items);
  SENT.set(items, graph);
  return graph;
};

/** The graph of the board's items with the draft's values in place: the board as it stands. */
export const liveGraph = (board: BoardContent): BoardGraph | undefined => {
  const { items, draft } = board;
  if (!items.some((item) => draft.get(item.id) !== undefined)) return sentGraph(board);
  let byDraft = LIVE.get(items);
  if (byDraft === undefined) {
    byDraft = new WeakMap();
    LIVE.set(items, byDraft);
  }
  if (byDraft.has(draft)) return byDraft.get(draft);
  const graph = build(
    items.map((item) => {
      const value = draft.get(item.id);
      return value === undefined ? item : { ...item, props: value };
    }),
  );
  byDraft.set(draft, graph);
  return graph;
};
