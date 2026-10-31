// The currency check (AD-13, formula spike row 9): no engine knows currencies, so the graph checks
// them before any engine runs. One pass in dependency order, after the cycle check, so what it
// walks is acyclic. A formula of any type over amounts in more than one currency is the origin
// of a mix; a formula that reads a mixed money formula takes the origin's error, and a money one
// passes it on. Only origins are warnings.

import type { Address, FormulaError, ValueType } from "../types.ts";

export type CurrencyNode = {
  readonly address: Address;
  readonly type: ValueType;
  readonly formula: boolean;
  /** A money input's currency, or a formula's declared one. */
  readonly currency?: string;
  /** Refused by an earlier check: it reads as that error and is not checked here. */
  readonly refused: boolean;
  /** The nodes it reads. */
  readonly reads: readonly number[];
};

export type CurrencyCheck = {
  /** Each node's currency: an input's, a money formula's declared or inferred one, or none. */
  readonly currencies: readonly (string | undefined)[];
  /** Nodes that read as `mixed-currencies`; the error names its origin. */
  readonly errors: ReadonlyMap<number, FormulaError>;
};

const origin = (address: Address, currencies: ReadonlySet<string>): FormulaError => ({
  error: "mixed-currencies",
  address,
  detail: `amounts in ${[...currencies].sort().join(", ")}`,
});

export const checkCurrencies = (
  nodes: readonly CurrencyNode[],
  order: Iterable<number>,
): CurrencyCheck => {
  const currencies = nodes.map((node) => node.currency);
  const mixed = new Map<number, FormulaError>();
  const errors = new Map<number, FormulaError>();
  for (const i of order) {
    const node = nodes[i] as CurrencyNode;
    if (!node.formula || node.refused) continue;
    const own = new Set<string>();
    if (node.type === "money" && node.currency !== undefined) own.add(node.currency);
    let inherited: FormulaError | undefined;
    for (const j of node.reads) {
      if (nodes[j]?.type !== "money") continue;
      const mix = mixed.get(j);
      if (mix !== undefined) inherited ??= mix;
      else if (currencies[j] !== undefined) own.add(currencies[j] as string);
    }
    const error = own.size > 1 ? origin(node.address, own) : inherited;
    if (error !== undefined) {
      errors.set(i, error);
      if (node.type === "money") mixed.set(i, error);
      currencies[i] = undefined;
    } else if (node.type === "money") {
      currencies[i] = node.currency ?? [...own][0];
    }
  }
  return { currencies, errors };
};
