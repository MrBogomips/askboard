// The board's compute graph in the view (design decision 7, AD-13): the live graph, of the board's
// items with the values they show in place of their props (the draft record's, else their
// question's latest answer's: the board's `shown`, molecules design decision 11), and the sent
// graph, of the items as the agent sent them, which the baseline reads. Each is built through
// `compute` and memoized by the identity of the items list and of the shown values, so that every
// Gantt on a board shares one build and the sent graph is built once per board revision. A board
// holding nothing to compute builds nothing. Written to move behind the port, into a library
// chunk, when a second computing widget comes. The live graph built for a board's items moves on
// with the draft: a change that
// `recalc.ts` says needs no rebuild (a duration, or a held request's move) goes through `set` and
// `recalc` on it, the design's fallback for drops over 100 ms at the limits (task 6.8); every live
// graph a component gets is a snapshot of its values, which never changes after. Plain ECMAScript:
// no DOM, no `Date`.

import {
  boardGraphSource,
  buildGraph,
  evaluateGraph,
  type FormulaError,
  type GraphValues,
  type NodeResult,
} from "@askboard/compute";
import type { BoardContent, BoardWidgetItem } from "@askboard/view/catalog";
import { type InputChange, inputChanges } from "./recalc.ts";

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
const build = (items: readonly BoardWidgetItem[]): BoardGraph | undefined => {
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

/**
 * The live graph a board's items list holds: the items it was evaluated for, the draft in place,
 * its evaluated values, which move on with each recalculation, and the snapshot of them that
 * `graph` reads.
 */
type Live = {
  readonly items: readonly BoardWidgetItem[];
  readonly values: GraphValues;
  readonly snapshot: ReadonlyMap<string, NodeResult>;
  readonly graph: BoardGraph;
};

const CHAINS = new WeakMap<object, Live>();

const missing = (address: string): NodeResult =>
  Object.freeze({ error: "missing-reference", address, detail: `no node ${address}` });

const snapshotGraph = (
  snapshot: ReadonlyMap<string, NodeResult>,
  warnings: readonly FormulaError[],
): BoardGraph =>
  Object.freeze({ read: (address: string) => snapshot.get(address) ?? missing(address), warnings });

/** A live graph built from nothing; undefined when the items hold nothing to compute. */
const buildLive = (items: readonly BoardWidgetItem[]): Live | undefined => {
  const source = boardGraphSource(items);
  if (source.items.length === 0) return undefined;
  const graph = buildGraph(source);
  const values = evaluateGraph(graph);
  const snapshot = new Map(graph.nodes.map(({ address }) => [address, values.read(address)]));
  return { items, values, snapshot, graph: snapshotGraph(snapshot, graph.warnings) };
};

/** The live graph moved on by `set` and `recalc`, the build's warnings kept. */
const recalcLive = (
  live: Live,
  items: readonly BoardWidgetItem[],
  changes: readonly InputChange[],
): Live => {
  if (changes.length === 0) return { ...live, items };
  for (const [address, value] of changes) live.values.set(address, value);
  const changed = [...changes.map(([address]) => address), ...live.values.recalc()];
  const snapshot = new Map(live.snapshot);
  for (const address of changed) snapshot.set(address, live.values.read(address));
  return {
    items,
    values: live.values,
    snapshot,
    graph: snapshotGraph(snapshot, live.graph.warnings),
  };
};

/** The graph of the board's items with the values they show in place: the board as it stands. */
export const liveGraph = (board: BoardContent): BoardGraph | undefined => {
  const { items, shown } = board;
  if (!items.some((item) => shown.get(item.id) !== undefined)) return sentGraph(board);
  let byShown = LIVE.get(items);
  if (byShown === undefined) {
    byShown = new WeakMap();
    LIVE.set(items, byShown);
  }
  if (byShown.has(shown)) return byShown.get(shown);
  const effective = items.map((item) => {
    const value = shown.get(item.id);
    return value === undefined ? item : { ...item, props: value };
  });
  const held = CHAINS.get(items);
  const changes = held === undefined ? undefined : inputChanges(held.items, effective);
  const live =
    held !== undefined && changes !== undefined
      ? recalcLive(held, effective, changes)
      : buildLive(effective);
  if (live !== undefined) CHAINS.set(items, live);
  byShown.set(shown, live?.graph);
  return live?.graph;
};
