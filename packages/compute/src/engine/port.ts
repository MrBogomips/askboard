// The `FormulaEngine` port (AD-13). An engine knows cells by engine names, numbers from 0, and
// never sees an ask, item or child ID: the adapter maps each address to a name. Inside an engine a
// date is a serial number and money a number; an error names the cell where it arose.

import type { FormulaErrorKind } from "@askboard/contract";
import type { Expression } from "../formula/expression.ts";

export type EngineScalar = number | string | boolean | null;

export type EngineError = {
  readonly kind: FormulaErrorKind;
  /** The engine name of the cell where the error arose. */
  readonly origin: number;
  readonly detail?: string;
};

export type EngineValue = EngineScalar | EngineError;

/**
 * What a formula's reference reads, by engine name: one cell, -1 for an empty one; or a list of
 * `size` places, of which `cells` names the non-empty ones as [place, name], the rest empty.
 */
export type EngineReference =
  | { readonly list: false; readonly name: number }
  | {
      readonly list: true;
      readonly size: number;
      readonly cells: readonly (readonly [number, number])[];
    };

export type EngineCell =
  /** An input, which `set` may change; its value may be an error. */
  | { readonly kind: "input"; readonly value: EngineValue }
  /** A formula: its expression's `reference` indexes point into `references`. */
  | {
      readonly kind: "formula";
      readonly expression: Expression;
      readonly references: readonly EngineReference[];
      /** Its result is a date: a number outside 1900-03-01 to 9999-12-31 reads as `value`. */
      readonly date?: boolean;
    }
  /** A problem found before the engine: the cell reads as this error and is never evaluated. */
  | { readonly kind: "error"; readonly error: EngineError };

export interface FormulaEngine {
  /** Replaces every cell, cell i having engine name i, and evaluates them all. */
  load(cells: readonly EngineCell[]): void;
  /** Changes an input; it takes effect at the next `recalc`. Throws for any other cell. */
  set(name: number, value: EngineValue): void;
  /** Evaluates the cells downstream of the changed inputs; returns their names in order. */
  recalc(): readonly number[];
  read(name: number): EngineValue;
}

export const isEngineError = (value: EngineValue): value is EngineError =>
  typeof value === "object" && value !== null;
