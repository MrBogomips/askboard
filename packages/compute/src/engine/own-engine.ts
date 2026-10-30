// AskBoard's own restricted evaluator behind the `FormulaEngine` port (AD-13, formula spike row 1):
// its own parser (in the graph's formula check), a topological order, and the whitelisted
// functions as code. No `eval` or other dynamic code. `load` orders and evaluates every cell;
// `set` and `recalc` re-evaluate only the cells downstream of the changed inputs.

import { MAX_SERIAL, MIN_SERIAL } from "../dates.ts";
import { orderNodes } from "../order.ts";
import { evaluateCell } from "./interpreter.ts";
import type { EngineCell, EngineValue, FormulaEngine } from "./port.ts";
import { err } from "./values.ts";

/** A date result out of range is an error here, so that cells that read it see the error. */
const inDateRange = (value: EngineValue, name: number): EngineValue => {
  if (typeof value !== "number") return value;
  const day = Math.floor(value);
  return day >= MIN_SERIAL && day <= MAX_SERIAL ? value : err("value", name, "a date out of range");
};

class OwnEngine implements FormulaEngine {
  #cells: readonly EngineCell[] = [];
  #values: EngineValue[] = [];
  #dependents: readonly (readonly number[])[] = [];
  /** Each cell's place in the evaluation order. */
  #position = new Int32Array(0);
  #dirty = new Set<number>();

  load(cells: readonly EngineCell[]): void {
    const reads = cells.map((cell) => {
      if (cell.kind !== "formula") return [];
      const names = cell.references.flatMap((r) =>
        r.list ? r.cells.map(([, name]) => name) : [r.name],
      );
      return [...new Set(names.filter((name) => name >= 0))];
    });
    const { order, onCycle } = orderNodes(reads);
    const dependents: number[][] = cells.map(() => []);
    reads.forEach((names, cell) => {
      for (const name of names) dependents[name]?.push(cell);
    });
    this.#cells = cells.map((cell, name) =>
      onCycle[name] === 1 ? { kind: "error", error: err("cycle", name) } : cell,
    );
    this.#values = cells.map((cell) => (cell.kind === "input" ? cell.value : null));
    this.#dependents = dependents;
    this.#position = new Int32Array(cells.length);
    order.forEach((name, place) => {
      this.#position[name] = place;
    });
    this.#dirty.clear();
    for (const name of order) this.#evaluate(name);
  }

  set(name: number, value: EngineValue): void {
    const cell = this.#cell(name);
    if (cell.kind !== "input") throw new TypeError(`engine name ${name} is not an input`);
    this.#values[name] = value;
    this.#dirty.add(name);
  }

  recalc(): readonly number[] {
    const affected = new Set<number>();
    const queue = [...this.#dirty];
    this.#dirty.clear();
    for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
      for (const dependent of this.#dependents[name] ?? []) {
        if (affected.has(dependent)) continue;
        affected.add(dependent);
        queue.push(dependent);
      }
    }
    const ordered = [...affected].sort(
      (a, b) => (this.#position[a] as number) - (this.#position[b] as number),
    );
    for (const name of ordered) this.#evaluate(name);
    return ordered;
  }

  read(name: number): EngineValue {
    this.#cell(name);
    return this.#values[name] ?? null;
  }

  #cell(name: number): EngineCell {
    const cell = this.#cells[name];
    if (cell === undefined) throw new RangeError(`no engine name ${name}`);
    return cell;
  }

  #evaluate(name: number): void {
    const cell = this.#cells[name] as EngineCell;
    if (cell.kind === "error") {
      this.#values[name] = cell.error;
    } else if (cell.kind === "formula") {
      const value = evaluateCell(
        cell.expression,
        cell.references,
        name,
        (n) => this.#values[n] ?? null,
      );
      // A formula that ends on an empty value reads 0, as in Excel.
      this.#values[name] = cell.date === true ? inDateRange(value ?? 0, name) : (value ?? 0);
    }
  }
}

export const createOwnEngine = (): FormulaEngine => new OwnEngine();
