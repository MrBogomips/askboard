// Values across the IronCalc boundary: port inputs to the text `setUserInput` takes, and
// IronCalc's error codes to the port's kinds. Precheck errors are written into cells as
// error literals so that dependants inherit them through the engine's own propagation.

import type { FormulaErrorKind, NodeType, Scalar } from "../port.ts";
import { fullDateToSerial } from "./dates.ts";

const MONEY = /^-?\d+(\.\d+)?$/;

/** Error literal written for each port kind; reading maps it back (ERROR_KIND). */
export const ERROR_LITERAL: Readonly<Record<FormulaErrorKind, string>> = {
  "missing-reference": "=#REF!",
  cycle: "=#CIRC!",
  "not-whitelisted": "=#NAME?",
  syntax: "=#ERROR!",
  value: "=#VALUE!",
  "division-by-zero": "=#DIV/0!",
  // No whitelisted function yields #N/A, so it carries mixed currencies.
  "mixed-currencies": "=#N/A",
};

/** IronCalc's displayed error codes (getFormattedCellValue) to the port's kinds. */
const ERROR_KIND: Readonly<Record<string, FormulaErrorKind>> = {
  "#REF!": "missing-reference",
  "#CIRC!": "cycle",
  "#NAME?": "not-whitelisted",
  "#ERROR!": "syntax",
  "#VALUE!": "value",
  "#NUM!": "value",
  "#N/IMPL!": "value",
  "#SPILL!": "value",
  "#CALC!": "value",
  "#DIV/0!": "division-by-zero",
  "#N/A": "mixed-currencies",
};

export function errorKind(code: string): FormulaErrorKind {
  return ERROR_KIND[code] ?? "value";
}

/** The `setUserInput` text for an input value, or the error kind and why. */
export function toInput(value: Scalar | undefined, type: NodeType): string | { kind: FormulaErrorKind; detail: string } {
  if (value === undefined || value === null) return "";
  switch (type) {
    case "date": {
      if (typeof value !== "string") return { kind: "value", detail: "a date is a full-date string" };
      const serial = fullDateToSerial(value);
      return serial === null ? { kind: "value", detail: `"${value}" is not a full-date in range` } : String(serial);
    }
    case "money":
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      if (typeof value === "string" && MONEY.test(value)) return String(Number(value));
      return { kind: "value", detail: "money is a decimal string" };
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? String(value) : { kind: "value", detail: "not a number" };
    case "boolean":
      return typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : { kind: "value", detail: "not a boolean" };
    case "text":
      // The quote prefix keeps "5", "TRUE" or "=1" as text.
      return typeof value === "string" ? `'${value}` : { kind: "value", detail: "not text" };
  }
}

/** The value an input reads back as: what the own evaluator holds for the same input. */
export function inputValue(value: Scalar | undefined, type: NodeType): Scalar {
  if (value === undefined || value === null) return null;
  if (type === "money" && typeof value === "string") return Number(value);
  return value;
}
