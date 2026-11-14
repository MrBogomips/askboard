// AskBoard's own restricted evaluator behind the FormulaEngine port (design decision 2).
// Addresses map to opaque slot numbers through a Map, so any ID grammar is safe. `load`
// prechecks, parses, orders and evaluates; `set` + `recalc` re-evaluate only the nodes
// downstream of the changed inputs.

import type { Address, FormulaEngine, FormulaError, GraphNode, LoadReport, NodeResult, NodeType, Scalar } from "../port.ts";
import { precheck } from "../precheck.ts";
import type { Token } from "../refs.ts";
import { fullDateToSerial, serialToFullDate } from "./dates.ts";
import type { Ctx } from "./functions.ts";
import { evaluate } from "./interp.ts";
import { type Ast, ParseError, parse } from "./parser.ts";
import { orderSlots } from "./topo.ts";
import { err, isError, type Value } from "./values.ts";

const MONEY = /^-?\d+(\.\d+)?$/;

interface State {
  readonly slots: ReadonlyMap<Address, number>;
  readonly addresses: readonly Address[];
  readonly types: readonly NodeType[];
  readonly asts: readonly (Ast | null)[];
  readonly fixed: readonly boolean[];
  readonly dependents: readonly (readonly number[])[];
  readonly position: Int32Array;
  readonly order: Int32Array;
  readonly values: Value[];
  readonly dirty: Set<number>;
}

/** An input value in the engine's terms: dates become serials, money decimal strings numbers. */
function toEngine(value: Scalar | undefined, type: NodeType, address: Address): Value {
  if (value === undefined || value === null) return null;
  if (type === "date") {
    if (typeof value !== "string") return err("value", address, "a date is a full-date string");
    const serial = fullDateToSerial(value);
    return serial === null ? err("value", address, `"${value}" is not a full-date in range`) : serial;
  }
  if (type === "money") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && MONEY.test(value)) return Number(value);
    return err("value", address, "money is a decimal string");
  }
  if (type === "number" && typeof value !== "number") return err("value", address, "not a number");
  if (type === "boolean" && typeof value !== "boolean") return err("value", address, "not a boolean");
  if (type === "text" && typeof value !== "string") return err("value", address, "not text");
  return value;
}

function toPort(v: Value, type: NodeType, address: Address): NodeResult {
  if (isError(v)) {
    const out: FormulaError = v.detail === undefined ? { error: v.kind, address: v.origin } : { error: v.kind, address: v.origin, detail: v.detail };
    return out;
  }
  if (type === "date" && typeof v === "number") {
    const text = serialToFullDate(v);
    return text ?? { error: "value", address, detail: "date out of range" };
  }
  return v;
}

export function createOwnEngine(): FormulaEngine {
  let state: State | null = null;

  const ctx = {
    origin: "" as Address,
    scalar: (ast: Ast): Value => evaluate(ast, ctx),
    slotValue: (slot: number): Value => (slot < 0 || !state ? null : (state.values[slot] ?? null)),
  } satisfies Ctx & { origin: Address };

  function evalSlot(s: State, slot: number): void {
    const ast = s.asts[slot];
    if (!ast || s.fixed[slot]) return;
    ctx.origin = s.addresses[slot] as Address;
    const v = evaluate(ast, ctx);
    // A formula that ends on an empty cell shows 0, as in Excel.
    s.values[slot] = v === null ? 0 : v;
  }

  function load(nodes: readonly GraphNode[]): LoadReport {
    const pre = precheck(nodes);
    const warnings: FormulaError[] = [...pre.warnings];
    const slots = new Map<Address, number>();
    pre.nodes.forEach((node, i) => slots.set(node.address, i));
    const n = pre.nodes.length;
    const values: Value[] = new Array<Value>(n).fill(null);
    const asts: (Ast | null)[] = new Array<Ast | null>(n).fill(null);
    const fixed: boolean[] = new Array<boolean>(n).fill(false);
    const deps: number[][] = [];
    pre.nodes.forEach((node, i) => {
      const reads: number[] = [];
      deps.push(reads);
      const failed = pre.errors.get(node.address);
      if (failed) {
        values[i] = err(failed.error, node.address, failed.detail);
        fixed[i] = true;
        return;
      }
      const checked = pre.formulas.get(node.address);
      if (!checked) {
        values[i] = toEngine(node.value, node.type, node.address);
        const bad = values[i];
        if (isError(bad)) warnings.push({ error: bad.kind, address: node.address, detail: bad.detail ?? "" });
        return;
      }
      const byStart = new Map<number, readonly Address[]>();
      for (const r of checked.references) byStart.set(r.start, r.addresses);
      const resolveRef = (t: Token): Ast => {
        const addresses = byStart.get(t.start) ?? [];
        if (t.ref?.wildcard || t.ref?.range) {
          const list = addresses.map((a) => slots.get(a) ?? -1);
          for (const s of list) if (s >= 0) reads.push(s);
          return { k: "list", slots: list };
        }
        const slot = slots.get(addresses[0] ?? "") ?? -1;
        if (slot >= 0) reads.push(slot);
        return { k: "ref", slot };
      };
      try {
        asts[i] = parse(checked.tokens, resolveRef);
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        reads.length = 0;
        values[i] = err("syntax", node.address, e.message);
        fixed[i] = true;
        warnings.push({ error: "syntax", address: node.address, detail: e.message });
      }
    });
    const { order, onCycle } = orderSlots(deps);
    const position = new Int32Array(n);
    order.forEach((slot, p) => {
      position[slot] = p;
    });
    const dependents: number[][] = Array.from({ length: n }, () => []);
    deps.forEach((reads, i) => {
      for (const r of new Set(reads)) dependents[r]?.push(i);
    });
    for (let i = 0; i < n; i++) {
      if (!onCycle[i]) continue;
      const address = pre.nodes[i]?.address as Address;
      values[i] = err("cycle", address);
      fixed[i] = true;
      warnings.push({ error: "cycle", address });
    }
    state = {
      slots,
      addresses: pre.nodes.map((node) => node.address),
      types: pre.nodes.map((node) => node.type),
      asts,
      fixed,
      dependents,
      position,
      order,
      values,
      dirty: new Set(),
    };
    for (const slot of order) evalSlot(state, slot);
    return { warnings };
  }

  function set(address: Address, value: Scalar): void {
    if (!state) throw new Error("set before load");
    const slot = state.slots.get(address);
    if (slot === undefined) throw new Error(`no node ${address}`);
    if (state.asts[slot] || state.fixed[slot]) throw new Error(`${address} is not an input`);
    state.values[slot] = toEngine(value, state.types[slot] as NodeType, address);
    state.dirty.add(slot);
  }

  function recalc(): void {
    const s = state;
    if (!s || s.dirty.size === 0) return;
    const seen = new Set<number>();
    const queue = [...s.dirty];
    s.dirty.clear();
    while (queue.length > 0) {
      const slot = queue.pop() as number;
      for (const d of s.dependents[slot] ?? []) {
        if (seen.has(d)) continue;
        seen.add(d);
        queue.push(d);
      }
    }
    const affected = [...seen].sort((a, b) => (s.position[a] as number) - (s.position[b] as number));
    for (const slot of affected) evalSlot(s, slot);
  }

  function read(address: Address): NodeResult {
    const slot = state?.slots.get(address);
    if (!state || slot === undefined) return { error: "missing-reference", address };
    return toPort(state.values[slot] ?? null, state.types[slot] as NodeType, address);
  }

  function dispose(): void {
    state = null;
  }

  return { id: "own", load, set, recalc, read, dispose };
}
