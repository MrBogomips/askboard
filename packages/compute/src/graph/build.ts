// `buildGraph` (AD-13): a board's whole graph from its source alone, with every check AD-13 gives
// the graph run before any engine, so the send-time check and the board report the same problems.
// Order: the source, inputs against their types, each formula's check and references, cycles,
// then currencies (design decision 3). A node that fails keeps its first error, reads as it, and
// is a warning naming it; nodes that read it inherit the error without a warning.

import { checkFormula, isProblem } from "../formula/check.ts";
import type { Expression } from "../formula/expression.ts";
import { convertInput } from "../inputs.ts";
import { orderNodes } from "../order.ts";
import type { GraphSource } from "../source.ts";
import type { Address, FormulaError, Scalar, ValueType } from "../types.ts";
import { checkCurrencies } from "./currencies.ts";
import { checkItems, indexSource, type NodeEntry, type NodeIndex } from "./nodes.ts";
import { resolveReference } from "./resolve.ts";

export type GraphNode = {
  readonly address: Address;
  readonly type: ValueType;
  /** An input node's value, null when empty. */
  readonly input?: Scalar;
  /** A formula node's text. */
  readonly formula?: string;
  /** A money node's currency: given, declared or inferred; absent when unknown or mixed. */
  readonly currency?: string;
};

export type Graph = {
  /** Every node, in document order. */
  readonly nodes: readonly GraphNode[];
  /** Every problem found, each naming the node where it arose (AD-6, AD-13). */
  readonly warnings: readonly FormulaError[];
};

/** What a reference reads: one node or a list, null where a cell has no node. */
export type ResolvedReference =
  | { readonly list: false; readonly address: Address | null }
  | { readonly list: true; readonly addresses: readonly (Address | null)[] };

export type CompiledNode = {
  readonly address: Address;
  readonly type: ValueType;
  readonly input?: Scalar;
  readonly formula?: {
    readonly expression: Expression;
    readonly references: readonly ResolvedReference[];
  };
  /** A build-time problem: the node reads as this error and is never evaluated. */
  readonly error?: FormulaError;
};

export type CompiledGraph = { readonly nodes: readonly CompiledNode[] };

type Draft = {
  readonly entry: NodeEntry;
  formula?: CompiledNode["formula"];
  error?: FormulaError;
  reads: readonly number[];
};

const COMPILED = new WeakMap<Graph, CompiledGraph>();

/** The parsed graph behind a graph that `buildGraph` made, for the adapter. */
export const compiledOf = (graph: Graph): CompiledGraph => {
  const compiled = COMPILED.get(graph);
  if (compiled === undefined) throw new TypeError("not a graph that buildGraph made");
  return compiled;
};

const compileFormula = (index: NodeIndex, entry: NodeEntry, text: string): Draft => {
  const checked = checkFormula(text);
  if (isProblem(checked)) {
    return {
      entry,
      error: { error: checked.kind, address: entry.address, detail: checked.reason },
      reads: [],
    };
  }
  const references: ResolvedReference[] = [];
  for (const syntax of checked.references) {
    const resolution = resolveReference(index, syntax);
    if ("missing" in resolution) {
      const error: FormulaError = {
        error: "missing-reference",
        address: entry.address,
        detail: resolution.missing,
      };
      return { entry, error, reads: [] };
    }
    references.push(resolution);
  }
  const reads = new Set<number>();
  for (const reference of references) {
    const addresses = reference.list ? reference.addresses : [reference.address];
    for (const address of addresses)
      if (address !== null) reads.add(index.positions.get(address) as number);
  }
  return { entry, formula: { expression: checked.expression, references }, reads: [...reads] };
};

const draftNode = (index: NodeIndex, entry: NodeEntry): Draft => {
  if (entry.formula !== undefined) return compileFormula(index, entry, entry.formula);
  const converted = convertInput(entry.type, entry.value);
  if ("reason" in converted) {
    return {
      entry,
      error: { error: "value", address: entry.address, detail: converted.reason },
      reads: [],
    };
  }
  return { entry, reads: [] };
};

const refuse = (draft: Draft, error: FormulaError, warnings: FormulaError[]): void => {
  draft.error = error;
  draft.formula = undefined;
  draft.reads = [];
  if (error.address === draft.entry.address) warnings.push(error);
};

const publicNode = (draft: Draft, currency: string | undefined): GraphNode => {
  const { address, type, value, formula } = draft.entry;
  return Object.freeze({
    address,
    type,
    ...(formula === undefined ? { input: value ?? null } : { formula }),
    ...(currency === undefined ? {} : { currency }),
  });
};

const compiledNode = ({ entry, formula, error }: Draft): CompiledNode =>
  Object.freeze({
    address: entry.address,
    type: entry.type,
    ...(entry.formula === undefined ? { input: entry.value ?? null } : {}),
    ...(formula === undefined ? {} : { formula }),
    ...(error === undefined ? {} : { error }),
  });

export const buildGraph = (source: GraphSource): Graph => {
  const index = indexSource(checkItems(source));
  const warnings: FormulaError[] = [];
  const drafts = index.entries.map((entry) => draftNode(index, entry));
  for (const draft of drafts) if (draft.error !== undefined) warnings.push(draft.error);
  const { order, onCycle } = orderNodes(drafts.map((draft) => draft.reads));
  drafts.forEach((draft, i) => {
    if (onCycle[i] === 1) refuse(draft, { error: "cycle", address: draft.entry.address }, warnings);
  });
  const { currencies, errors } = checkCurrencies(
    drafts.map(({ entry, error, reads }) => ({
      address: entry.address,
      type: entry.type,
      formula: entry.formula !== undefined,
      ...(entry.currency === undefined ? {} : { currency: entry.currency }),
      refused: error !== undefined,
      reads,
    })),
    order,
  );
  drafts.forEach((draft, i) => {
    const error = errors.get(i);
    if (error !== undefined) refuse(draft, error, warnings);
  });
  const graph: Graph = Object.freeze({
    nodes: Object.freeze(drafts.map((draft, i) => publicNode(draft, currencies[i]))),
    warnings: Object.freeze(warnings),
  });
  COMPILED.set(graph, Object.freeze({ nodes: Object.freeze(drafts.map(compiledNode)) }));
  return graph;
};
