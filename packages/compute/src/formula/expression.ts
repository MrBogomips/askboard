// A parsed formula. References are indexes into the formula's own list of references, never
// addresses: the graph resolves that list to addresses, and the adapter to engine names, so the
// engine reads the same expression without seeing an ID (AD-13).

import type { BinaryOperator, FormulaErrorKind, FunctionName } from "@askboard/contract";

export type Expression =
  | { readonly k: "number"; readonly value: number }
  | { readonly k: "text"; readonly value: string }
  | { readonly k: "boolean"; readonly value: boolean }
  /** The `index`-th reference of the formula, in order of appearance. */
  | { readonly k: "reference"; readonly index: number }
  | { readonly k: "negate"; readonly operand: Expression }
  /** A run of operators of one precedence, evaluated left to right by a loop. */
  | {
      readonly k: "chain";
      readonly operators: readonly BinaryOperator[];
      readonly operands: readonly Expression[];
    }
  | { readonly k: "call"; readonly name: FunctionName; readonly args: readonly Expression[] };

/** Why a formula was refused: an error kind of the contract and a reason for the user and agent. */
export type FormulaProblem = { readonly kind: FormulaErrorKind; readonly reason: string };
