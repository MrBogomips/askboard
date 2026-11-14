// AskBoard formula -> IronCalc formula text. The text is rebuilt from the shared lexer's
// tokens, so whitespace (Excel's intersection operator) never reaches the engine, function
// names are upper case and every reference becomes a cell, a range or a defined name.

import type { CheckedFormula, ResolvedReference } from "../precheck.ts";
import { a1, type Cell, type Layout, referenceTarget } from "./layout.ts";

export interface Naming {
  readonly layout: Layout;
  readonly sheetNames: readonly string[];
  /** Reference text -> defined name, in the names form; empty in the cells form. */
  readonly names: ReadonlyMap<string, string>;
}

function rangeText(from: Cell, to: Cell, sheet: number, sheetNames: readonly string[], absolute: boolean): string {
  return `${a1(from, sheet, sheetNames, absolute)}:${a1({ ...to, sheet }, sheet, sheetNames, absolute)}`;
}

/** Sheet-qualified absolute text for a defined name's formula; null for a non-contiguous list. */
export function targetText(ref: ResolvedReference, range: { from: string; to: string } | undefined, n: Omit<Naming, "names">): string | null {
  const t = referenceTarget(ref, range, n.layout);
  if (t.kind === "list") return null;
  // A one-cell range, not a cell: IronCalc passes a name of one cell to SUM as a value, so
  // booleans and text in it would count; as a range they are ignored, as with a cell reference.
  if (t.kind === "cell") return `${a1(t.cell, -1, n.sheetNames, true)}:${a1({ ...t.cell, sheet: -1 }, -1, n.sheetNames, true)}`;
  return `${a1(t.from, -1, n.sheetNames, true)}:${a1({ ...t.to, sheet: -1 }, -1, n.sheetNames, true)}`;
}

function referenceText(ref: ResolvedReference, range: { from: string; to: string } | undefined, sheet: number, n: Naming): string {
  const name = n.names.get(ref.text);
  if (name !== undefined) return name;
  const t = referenceTarget(ref, range, n.layout);
  if (t.kind === "cell") return a1(t.cell, sheet, n.sheetNames);
  if (t.kind === "range") return rangeText(t.from, t.to, sheet, n.sheetNames, false);
  return t.cells.map((c) => a1(c, sheet, n.sheetNames)).join(",");
}

export function engineFormula(checked: CheckedFormula, sheet: number, n: Naming): string {
  const byStart = new Map<number, ResolvedReference>();
  for (const r of checked.references) byStart.set(r.start, r);
  let out = "=";
  for (const t of checked.tokens) {
    if (t.kind === "ref") out += referenceText(byStart.get(t.start) as ResolvedReference, t.ref?.range, sheet, n);
    else if (t.kind === "string") out += `"${t.text.replaceAll('"', '""')}"`;
    else if (t.kind === "number") out += t.text.startsWith(".") ? `0${t.text}` : t.text;
    else out += t.text;
  }
  return out;
}
