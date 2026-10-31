// The adapter between a graph and a `FormulaEngine` (AD-13): it gives each node an engine name in
// document order, so the engine never sees an ID; converts inputs in (dates to serials, money to
// numbers) and results out (serials back to `full-date`); and maps an error's origin back to the
// address where it arose. Callers read, set and recalculate by address.

import { fullDateOf } from "./dates.ts";
import { createOwnEngine } from "./engine/own-engine.ts";
import {
  type EngineCell,
  type EngineError,
  type EngineReference,
  type EngineValue,
  type FormulaEngine,
  isEngineError,
} from "./engine/port.ts";
import {
  type CompiledNode,
  compiledOf,
  type Graph,
  type ResolvedReference,
} from "./graph/build.ts";
import { convertInput } from "./inputs.ts";
import type { Address, FormulaError, NodeResult, Scalar } from "./types.ts";

export type GraphValues = {
  /** A node's value, or the error it reads as; an unknown address reads as `missing-reference`. */
  read(address: Address): NodeResult;
  /** Changes an input node's value, taking effect at the next `recalc`. Throws for any other node. */
  set(address: Address, value: Scalar): void;
  /** Evaluates every node downstream of the changed inputs; returns their addresses in order. */
  recalc(): readonly Address[];
};

const engineName = (names: ReadonlyMap<Address, number>, address: Address | null): number =>
  address === null ? -1 : (names.get(address) as number);

const engineReference = (
  names: ReadonlyMap<Address, number>,
  reference: ResolvedReference,
): EngineReference =>
  reference.list
    ? {
        list: true,
        size: reference.size,
        cells: reference.cells.map(([at, address]) => [at, engineName(names, address)] as const),
      }
    : { list: false, name: engineName(names, reference.address) };

const engineError = (
  names: ReadonlyMap<Address, number>,
  error: FormulaError,
  own: number,
): EngineError => ({
  kind: error.error,
  origin: names.get(error.address) ?? own,
  ...(error.detail === undefined ? {} : { detail: error.detail }),
});

const engineInput = (node: CompiledNode, value: Scalar, name: number): EngineValue => {
  const converted = convertInput(node.type, value);
  return "reason" in converted
    ? { kind: "value", origin: name, detail: converted.reason }
    : converted.value;
};

const engineCell = (
  names: ReadonlyMap<Address, number>,
  node: CompiledNode,
  name: number,
): EngineCell => {
  if ("input" in node) {
    const value =
      node.error === undefined
        ? engineInput(node, node.input ?? null, name)
        : engineError(names, node.error, name);
    return { kind: "input", value };
  }
  if (node.formula === undefined) {
    return { kind: "error", error: engineError(names, node.error as FormulaError, name) };
  }
  const references = node.formula.references.map((reference) => engineReference(names, reference));
  const { expression } = node.formula;
  return node.type === "date"
    ? { kind: "formula", expression, references, date: true }
    : { kind: "formula", expression, references };
};

const result = (
  nodes: readonly CompiledNode[],
  node: CompiledNode,
  value: EngineValue,
): NodeResult => {
  if (isEngineError(value)) {
    const error = { error: value.kind, address: nodes[value.origin]?.address ?? node.address };
    return value.detail === undefined ? error : { ...error, detail: value.detail };
  }
  if (node.type !== "date" || typeof value !== "number") return value;
  return (
    fullDateOf(value) ?? { error: "value", address: node.address, detail: "a date out of range" }
  );
};

export const evaluateGraph = (
  graph: Graph,
  engine: FormulaEngine = createOwnEngine(),
): GraphValues => {
  const { nodes } = compiledOf(graph);
  const names = new Map(nodes.map((node, name) => [node.address, name]));
  engine.load(nodes.map((node, name) => engineCell(names, node, name)));
  return {
    read: (address) => {
      const name = names.get(address);
      if (name === undefined)
        return { error: "missing-reference", address, detail: `no node ${address}` };
      return result(nodes, nodes[name] as CompiledNode, engine.read(name));
    },
    set: (address, value) => {
      const name = names.get(address);
      if (name === undefined) throw new RangeError(`no node ${address}`);
      const node = nodes[name] as CompiledNode;
      if (!("input" in node)) throw new TypeError(`${address} is not an input`);
      engine.set(name, engineInput(node, value, name));
    },
    recalc: () => engine.recalc().map((name) => (nodes[name] as CompiledNode).address),
  };
};
