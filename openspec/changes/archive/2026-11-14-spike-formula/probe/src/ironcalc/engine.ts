// The IronCalc adapter behind the FormulaEngine port (design decision 2). The engine sees
// only A1 cells, ranges or encoded defined names, never an AskBoard ID. The shared precheck
// and a grammar check run first; cycles are found on the graph, not by the engine, so the
// warnings match the port's rules. Numbers are read exactly through a shadow cell holding
// the value times 2^200, formatted as an integer (see readNumber).

import { initSync, Model } from "@ironcalc/wasm";
import { orderSlots } from "../own/topo.ts";
import type { Address, FormulaEngine, FormulaError, FormulaErrorKind, GraphNode, LoadReport, NodeResult, NodeType, Scalar } from "../port.ts";
import { type CheckedFormula, type Prechecked, precheck } from "../precheck.ts";
import type { Token } from "../refs.ts";
import { serialToFullDate } from "./dates.ts";
import { engineFormula, type Naming, targetText } from "./formula.ts";
import { grammarError } from "./grammar.ts";
import { type Cell, layoutNodes } from "./layout.ts";
import { encodeName, MAX_NAME_LENGTH } from "./names.ts";
import { formatRuns } from "./style.ts";
import { ERROR_LITERAL, errorKind, inputValue, toInput } from "./values.ts";

export interface IronCalcOptions {
  /** How formulas name nodes: A1 cells and ranges (default), or defined names (criterion 6). */
  readonly form?: "cells" | "names";
  /** Exact numbers through shadow cells (default); false reads 15 significant digits. */
  readonly exact?: boolean;
}

const SCALE = 2 ** 200;
const TWO_52 = 2 ** 52;
const APPROX_FORMAT = "0.00000000000000E+00";
const CELL_TYPE = { number: 1, text: 2, boolean: 4, error: 16 } as const;

interface Slot {
  readonly type: NodeType;
  readonly cell: Cell;
  readonly formula: boolean;
  input: Scalar;
  inputError: boolean;
}

interface State {
  readonly model: Model;
  readonly slots: ReadonlyMap<Address, Slot>;
  readonly dataSheets: number;
}

let initialised = false;

export function createIronCalcEngine(wasmBytes: Uint8Array, options: IronCalcOptions = {}): FormulaEngine {
  if (!initialised) {
    initSync({ module: wasmBytes });
    initialised = true;
  }
  const exact = options.exact ?? true;
  const form = options.form ?? "cells";
  let state: State | null = null;

  function load(nodes: readonly GraphNode[]): LoadReport {
    dispose();
    const pre = precheck(nodes);
    const warnings: FormulaError[] = [...pre.warnings];
    const { seeds, deps } = seedErrors(pre, warnings);
    const rangeItems: string[] = [];
    for (const checked of pre.formulas.values()) for (const t of checked.tokens) if (t.ref?.range) rangeItems.push(t.ref.segments[0] as string);
    const layout = layoutNodes(pre.nodes, rangeItems);
    const model = new Model("askboard", "en", "UTC", "en");
    model.pauseEvaluation();
    for (let i = 1; i < layout.sheets * (exact ? 2 : 1); i++) model.newSheet();
    const sheetNames = model.getWorksheetsProperties().map((w) => w.name);
    const naming: Naming = { layout, sheetNames, names: form === "names" ? defineNames(model, pre, seeds, { layout, sheetNames }) : new Map() };
    const slots = new Map<Address, Slot>();
    const formulaCells: Cell[] = [];
    for (const node of pre.nodes) {
      const cell = layout.cells.get(node.address) as Cell;
      const slot: Slot = { type: node.type, cell, formula: node.formula !== undefined, input: null, inputError: false };
      const seed = seeds.get(node.address);
      let text: string;
      if (seed) text = ERROR_LITERAL[seed];
      else if (slot.formula) text = engineFormula(pre.formulas.get(node.address) as CheckedFormula, cell.sheet, naming);
      else {
        const v = toInput(node.value, node.type);
        if (typeof v === "string") {
          text = v;
          slot.input = inputValue(node.value, node.type);
        } else {
          text = ERROR_LITERAL[v.kind];
          slot.inputError = true;
          warnings.push({ error: v.kind, address: node.address, detail: v.detail });
        }
      }
      if (text !== "") model.setUserInput(cell.sheet, cell.row, cell.col, text);
      if (slot.formula) formulaCells.push(cell);
      slots.set(node.address, slot);
    }
    if (exact) {
      for (const c of formulaCells) model.setUserInput(layout.sheets + c.sheet, c.row, c.col, `=${sheetNames[c.sheet]}!${a1Plain(c)}*2^200`);
      formatRuns(model, formulaCells, layout.sheets, "0");
    }
    formatRuns(model, formulaCells, 0, APPROX_FORMAT);
    model.evaluate();
    state = { model, slots, dataSheets: layout.sheets };
    warnings.push(...parseErrors(model, pre, seeds, deps, slots));
    return { warnings };
  }

  function set(address: Address, value: Scalar): void {
    const slot = state?.slots.get(address);
    if (!state || !slot) throw new Error(`no node ${address}`);
    if (slot.formula) throw new Error(`${address} is not an input`);
    const v = toInput(value, slot.type);
    const { sheet, row, col } = slot.cell;
    if (typeof v === "string") {
      state.model.setUserInput(sheet, row, col, v);
      slot.input = inputValue(value, slot.type);
      slot.inputError = false;
    } else {
      state.model.setUserInput(sheet, row, col, ERROR_LITERAL[v.kind]);
      slot.inputError = true;
    }
  }

  function recalc(): void {
    state?.model.evaluate();
  }

  function read(address: Address): NodeResult {
    const slot = state?.slots.get(address);
    if (!state || !slot) return { error: "missing-reference", address };
    if (!slot.formula && !slot.inputError) return slot.input;
    const { model } = state;
    const { sheet, row, col } = slot.cell;
    const type = model.getCellType(sheet, row, col);
    if (type === CELL_TYPE.error) return { error: errorKind(model.getFormattedCellValue(sheet, row, col)), address };
    if (type === CELL_TYPE.boolean) return model.getFormattedCellValue(sheet, row, col) === "TRUE";
    if (type === CELL_TYPE.text) return model.getFormattedCellValue(sheet, row, col);
    if (type !== CELL_TYPE.number) return { error: "value", address, detail: `cell type ${type}` };
    const x = readNumber(state, slot.cell);
    if (slot.type !== "date") return x;
    return serialToFullDate(x) ?? { error: "value", address, detail: "date out of range" };
  }

  /**
   * IronCalc has no raw-value getter, and its number formats stop at 15 significant digits
   * (and print three-digit exponents wrongly: the largest double shows as "1.79769313486232E+30308").
   * x * 2^200 is exact in binary, and for 2^-148 <= |x| < 2^824 it is an integer of at least
   * 2^52, which the "0" format prints as Rust's shortest round-trip digits: dividing by 2^200
   * gives x back bit for bit. Larger x is itself an integer and is printed whole the same way;
   * smaller x is read at 15 significant digits through the scaled value.
   */
  function readNumber(s: State, cell: Cell): number {
    const { model } = s;
    const text = model.getFormattedCellValue(cell.sheet, cell.row, cell.col);
    if (!exact) return Number(text);
    const shadow: Cell = { ...cell, sheet: s.dataSheets + cell.sheet };
    if (model.getCellType(shadow.sheet, shadow.row, shadow.col) !== CELL_TYPE.number) return Number(withFormat(model, cell, "0", APPROX_FORMAT));
    const y = Number(model.getFormattedCellValue(shadow.sheet, shadow.row, shadow.col));
    if (Math.abs(y) >= TWO_52) return y / SCALE;
    if (Number(text.split("E")[0]) === 0) return 0;
    return Number(withFormat(model, shadow, APPROX_FORMAT, "0")) / SCALE;
  }

  function dispose(): void {
    state?.model.free();
    state = null;
  }

  return { id: "ironcalc", load, set, recalc, read, dispose };
}

/** The cell's text under a temporary number format; a style change needs no evaluation. */
function withFormat(model: Model, c: Cell, format: string, restore: string): string {
  const area = { sheet: c.sheet, row: c.row, column: c.col, width: 1, height: 1 };
  model.updateRangeStyle(area, "num_fmt", format);
  const text = model.getFormattedCellValue(c.sheet, c.row, c.col);
  model.updateRangeStyle(area, "num_fmt", restore);
  return text;
}

function a1Plain(c: Cell): string {
  let letters = "";
  for (let n = c.col; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return `${letters}${c.row}`;
}

/**
 * IronCalc 0.9.1's parser recurses per binary operator and overflows its WASM stack near
 * 1,190 operators in one formula ("Out of bounds memory access"), which also leaves the
 * module instance unusable. Longer chains are refused before the engine sees them.
 */
export const MAX_OPERATORS = 1000;

function operatorCount(tokens: readonly Token[]): number {
  let n = 0;
  for (const t of tokens) if (t.kind === "op") n++;
  return n;
}

/**
 * Formulas IronCalc itself could not parse (wrong argument count, a number literal out of
 * range) evaluate to #ERROR!; each is a syntax warning unless it only inherits the error.
 */
function parseErrors(
  model: Model,
  pre: Prechecked,
  seeds: ReadonlyMap<Address, FormulaErrorKind>,
  deps: readonly (readonly Address[])[],
  slots: ReadonlyMap<Address, Slot>,
): FormulaError[] {
  const isParseError = (address: Address): boolean => {
    const c = slots.get(address)?.cell;
    return c !== undefined && model.getCellType(c.sheet, c.row, c.col) === CELL_TYPE.error && model.getFormattedCellValue(c.sheet, c.row, c.col) === "#ERROR!";
  };
  const out: FormulaError[] = [];
  pre.nodes.forEach((node, i) => {
    if (!pre.formulas.has(node.address) || seeds.has(node.address) || !isParseError(node.address)) return;
    if ((deps[i] ?? []).some(isParseError)) return;
    out.push({ error: "syntax", address: node.address, detail: "IronCalc could not parse the formula" });
  });
  return out;
}

/** Nodes written as error literals: precheck errors, grammar errors and nodes on a cycle. */
function seedErrors(pre: Prechecked, warnings: FormulaError[]): { seeds: Map<Address, FormulaErrorKind>; deps: Address[][] } {
  const seeds = new Map<Address, FormulaErrorKind>();
  for (const [address, e] of pre.errors) seeds.set(address, e.error);
  const index = new Map<Address, number>();
  pre.nodes.forEach((n, i) => index.set(n.address, i));
  const deps: number[][] = pre.nodes.map(() => []);
  for (const [address, checked] of pre.formulas) {
    const ops = operatorCount(checked.tokens);
    const why = ops > MAX_OPERATORS ? `${ops} operators, over the adapter's ${MAX_OPERATORS}` : grammarError(checked.tokens);
    if (why !== null) {
      seeds.set(address, "syntax");
      warnings.push({ error: "syntax", address, detail: why });
      continue;
    }
    const reads = deps[index.get(address) as number] as number[];
    for (const r of checked.references) for (const a of r.addresses) {
      const slot = index.get(a);
      if (slot !== undefined) reads.push(slot);
    }
  }
  const { onCycle } = orderSlots(deps);
  pre.nodes.forEach((n, i) => {
    if (!onCycle[i]) return;
    seeds.set(n.address, "cycle");
    warnings.push({ error: "cycle", address: n.address });
  });
  return { seeds, deps: deps.map((reads) => reads.map((slot) => pre.nodes[slot]?.address as Address)) };
}

/** The names form: one workbook name per reference text, defined before any formula. */
function defineNames(model: Model, pre: Prechecked, seeds: ReadonlyMap<Address, FormulaErrorKind>, n: Omit<Naming, "names">): Map<string, string> {
  const names = new Map<string, string>();
  for (const [address, checked] of pre.formulas) {
    if (seeds.has(address)) continue;
    for (const t of checked.tokens) {
      if (t.kind !== "ref" || names.has(t.text)) continue;
      const ref = checked.references.find((r) => r.start === t.start);
      const target = ref ? targetText(ref, t.ref?.range, n) : null;
      if (!ref || target === null) continue;
      let name = encodeName(t.text);
      if (name.length > MAX_NAME_LENGTH) name = `i_${names.size}`;
      model.newDefinedName(name, null, target);
      names.set(t.text, name);
    }
  }
  return names;
}
