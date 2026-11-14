// The engine-independent checks every adapter runs in `load()` before its engine sees a
// formula: grammar and whitelist (refs.ts), missing references, oversized ranges and mixed
// currencies. No engine knows currencies, so that check lives here, in the graph layer.
// Cycles are left to each engine, which needs its own evaluation order anyway.

import type { Address, FormulaError, GraphNode } from "./port.ts";
import { AddressIndex, checkFormula, MAX_RANGE_CELLS, type Resolution, type Token } from "./refs.ts";

export interface ResolvedReference {
  /** Span of `[...]` in the formula, brackets included: [start, end). */
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly kind: "single" | "list";
  /** A list is in document order (wildcard) or row-major (range); a range may name cells with no node, which are empty. */
  readonly addresses: readonly Address[];
}

export interface CheckedFormula {
  readonly tokens: readonly Token[];
  readonly references: readonly ResolvedReference[];
}

export interface Prechecked {
  readonly index: AddressIndex;
  /** The first node for each address, in document order. */
  readonly nodes: readonly GraphNode[];
  readonly warnings: readonly FormulaError[];
  /** Nodes that must read as this error; their dependents read as the same error kind. */
  readonly errors: ReadonlyMap<Address, FormulaError>;
  /** Formula nodes that passed, with their tokens and resolved references. */
  readonly formulas: ReadonlyMap<Address, CheckedFormula>;
}

export function precheck(input: readonly GraphNode[]): Prechecked {
  const warnings: FormulaError[] = [];
  const errors = new Map<Address, FormulaError>();
  const nodes: GraphNode[] = [];
  const seen = new Set<Address>();
  for (const node of input) {
    if (seen.has(node.address)) {
      warnings.push({ error: "value", address: node.address, detail: "duplicate address; the first node is kept" });
      continue;
    }
    seen.add(node.address);
    nodes.push(node);
  }
  const index = new AddressIndex(nodes.map((n) => n.address));
  const formulas = new Map<Address, CheckedFormula>();
  for (const node of nodes) {
    if (node.formula === undefined) continue;
    const checked = checkNode(node, index);
    if ("error" in checked) {
      warnings.push(checked);
      errors.set(node.address, checked);
    } else {
      formulas.set(node.address, checked);
    }
  }
  for (const problem of checkCurrencies(nodes, formulas, errors)) {
    warnings.push(problem);
    errors.set(problem.address, problem);
    formulas.delete(problem.address);
  }
  return { index, nodes, warnings, errors, formulas };
}

function checkNode(node: GraphNode, index: AddressIndex): CheckedFormula | FormulaError {
  const checked = checkFormula(node.formula ?? "", node.address);
  if ("error" in checked) return checked;
  const references: ResolvedReference[] = [];
  for (const t of checked.tokens) {
    if (t.kind !== "ref" || !t.ref) continue;
    const r: Resolution = index.resolve(t.ref);
    if (r.kind === "too-large") {
      return { error: "syntax", address: node.address, detail: `range [${t.text}] has ${r.cells} cells, over ${MAX_RANGE_CELLS}` };
    }
    if (r.kind === "single") {
      if (!r.present) return { error: "missing-reference", address: node.address, detail: `[${t.text}]` };
      references.push({ start: t.start, end: t.end, text: t.text, kind: "single", addresses: [r.address] });
    } else {
      if (!r.itemPresent) return { error: "missing-reference", address: node.address, detail: `[${t.text}]: no item ${t.ref.segments[0]}` };
      references.push({ start: t.start, end: t.end, text: t.text, kind: "list", addresses: r.addresses });
    }
  }
  return { tokens: checked.tokens, references };
}

/**
 * A money formula's currencies: its declared one plus those of the money nodes it reads,
 * inferred through other money formulas. More than one is `mixed-currencies` (EXPERIENCE:
 * a summed money column has one fixed currency).
 */
function checkCurrencies(
  nodes: readonly GraphNode[],
  formulas: ReadonlyMap<Address, CheckedFormula>,
  errors: ReadonlyMap<Address, FormulaError>,
): FormulaError[] {
  const byAddress = new Map<Address, GraphNode>();
  for (const n of nodes) byAddress.set(n.address, n);
  const currency = new Map<Address, string>();
  for (const n of nodes) if (n.type === "money" && n.formula === undefined && n.currency) currency.set(n.address, n.currency);
  const mixed = new Map<Address, string[]>();
  const pending = nodes.filter((n) => n.type === "money" && formulas.has(n.address) && !errors.has(n.address));
  // Fixpoint over money formulas; bounded by their count, so a cycle cannot loop forever.
  for (let pass = 0; pass <= pending.length; pass++) {
    let changed = false;
    for (const n of pending) {
      const set = new Set<string>();
      if (n.currency) set.add(n.currency);
      for (const ref of formulas.get(n.address)?.references ?? []) {
        for (const a of ref.addresses) {
          const dep = byAddress.get(a);
          if (dep?.type !== "money") continue;
          const c = currency.get(a);
          if (c) set.add(c);
          for (const m of mixed.get(a) ?? []) set.add(m);
        }
      }
      if (set.size > 1) {
        const list = [...set].sort();
        if (mixed.get(n.address)?.join() !== list.join()) {
          mixed.set(n.address, list);
          currency.delete(n.address);
          changed = true;
        }
      } else if (set.size === 1) {
        const only = [...set][0] as string;
        if (currency.get(n.address) !== only) {
          currency.set(n.address, only);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const problems: FormulaError[] = [];
  for (const n of pending) {
    const list = mixed.get(n.address);
    // Report only where the mix starts; a node fed by a mixed node inherits its error at evaluation.
    if (list && !readsMixed(n.address, formulas, mixed)) {
      problems.push({ error: "mixed-currencies", address: n.address, detail: list.join(", ") });
    } else if (list) {
      problems.push({ error: "mixed-currencies", address: n.address, detail: `reads a mixed-currency node (${list.join(", ")})` });
    }
  }
  return problems;
}

function readsMixed(address: Address, formulas: ReadonlyMap<Address, CheckedFormula>, mixed: ReadonlyMap<Address, string[]>): boolean {
  for (const ref of formulas.get(address)?.references ?? []) for (const a of ref.addresses) if (mixed.has(a)) return true;
  return false;
}
