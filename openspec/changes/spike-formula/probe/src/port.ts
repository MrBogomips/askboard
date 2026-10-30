// The FormulaEngine port stand-in (design decision 2). `compute` calls it with graph nodes
// addressed by AskBoard references; an adapter maps each address to an engine name, so the
// engine never sees an ask or item ID (AD-13). Compiles under compute's settings (AD-1).

/** A node's address: the reference without its brackets, e.g. `wbs.design.ux.expected` or `sheet.A1`. */
export type Address = string;

/** Values the graph carries. Dates travel as `full-date` strings and become serial numbers only inside an engine. */
export type Scalar = number | string | boolean | null;

/** AskBoard's own error kinds: no engine's error codes leak through the port. */
export type FormulaErrorKind =
  | "missing-reference"
  | "cycle"
  | "not-whitelisted"
  | "syntax"
  | "value"
  | "division-by-zero"
  | "mixed-currencies";

export interface FormulaError {
  readonly error: FormulaErrorKind;
  /** The node whose formula failed; for a cycle, the first node of the cycle found. */
  readonly address: Address;
  readonly detail?: string;
}

/** The type a node's value has, declared by the widget's contract (AD-7, AD-13). */
export type NodeType = "number" | "money" | "date" | "boolean" | "text";

export interface GraphNode {
  readonly address: Address;
  readonly type: NodeType;
  /** An input value (given by the agent or edited by the user). Absent when `formula` is set. */
  readonly value?: Scalar;
  /** A formula in AskBoard's syntax: Excel-style, `[address]` references, whitelisted functions, no leading `=`. */
  readonly formula?: string;
  /** ISO 4217 code for a money node (AD-7). */
  readonly currency?: string;
}

export interface LoadReport {
  /** Problems found when loading: missing references, cycles, refused functions, syntax. Warnings, never refusals (AD-13). */
  readonly warnings: readonly FormulaError[];
}

export type NodeResult = Scalar | FormulaError;

export interface FormulaEngine {
  readonly id: "own" | "ironcalc";
  /** Replaces the whole graph, then evaluates it. */
  load(nodes: readonly GraphNode[]): LoadReport;
  /** Changes one input node's value; takes effect at the next `recalc`. */
  set(address: Address, value: Scalar): void;
  /** Recalculates every node that depends on a changed input. */
  recalc(): void;
  /** The node's current value, or the error its formula raised. */
  read(address: Address): NodeResult;
  /** Releases engine memory (IronCalc's model lives in WASM memory). */
  dispose(): void;
}

export function isFormulaError(result: NodeResult): result is FormulaError {
  return typeof result === "object" && result !== null && "error" in result;
}
