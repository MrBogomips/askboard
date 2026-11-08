// What the graph says of a Table, and the answer's derived values (table-widget, design decisions 7
// and 11; AD-13): a formula cell's and a total's value or error, the column problems the build's
// `item.*.field` warnings name, the errors that depend on a row's values, the derived mark of a cell
// whose value differs from the board as sent, and the derived values an answer carries by
// `TABLE_ANSWER_DERIVED`. The model computes nothing: every value comes from `compute`'s graph, and
// the rounding is `compute`'s `roundNumber`, as a `ROUND` formula gives it. A value in error never
// reaches the answer. Addresses are built by concatenation and results kept in `Map`s and `Set`s,
// so an ID or a field named `__proto__` or `constructor` is only data.

import { type FormulaError, isFormulaError, type NodeResult, roundNumber } from "@askboard/compute";
import {
  type Locale,
  TABLE_ANSWER_DERIVED,
  type TableColumn,
  type TableProps,
} from "@askboard/contract";
import { type StringKey, say } from "@askboard/view/catalog";
import type { BoardGraph } from "../../board-graph/board-graph.ts";
import { moneyDecimal } from "./columns.ts";
import { cellKey } from "./marks.ts";

/** A formula cell or an input cell as the graph holds it; undefined when the board has no graph. */
export const cellResult = (
  graph: BoardGraph | undefined,
  itemId: string,
  rowId: string,
  field: string,
): NodeResult | undefined => graph?.read(`${itemId}.${rowId}.${field}`);

/** A column's total as the graph holds it. */
export const totalResult = (
  graph: BoardGraph | undefined,
  itemId: string,
  field: string,
): NodeResult | undefined => graph?.read(`${itemId}.${field}`);

const formulaColumns = (columns: readonly TableColumn[]): readonly TableColumn[] =>
  columns.filter((column) => column.formula !== undefined);

/**
 * The columns whose formula the build refused, by field: the warnings at `item.*.field`, one per
 * column. Their cells read "—", and the problem shows once, over the grid.
 */
export const columnProblems = (
  graph: BoardGraph | undefined,
  itemId: string,
  columns: readonly TableColumn[],
): ReadonlyMap<string, FormulaError> => {
  const problems = new Map<string, FormulaError>();
  if (graph === undefined) return problems;
  const fields = new Set(formulaColumns(columns).map(({ field }) => field));
  const prefix = `${itemId}.*.`;
  for (const warning of graph.warnings) {
    if (!warning.address.startsWith(prefix)) continue;
    const field = warning.address.slice(prefix.length);
    if (fields.has(field) && !problems.has(field)) problems.set(field, warning);
  }
  return problems;
};

export type RowError = {
  readonly rowId: string;
  readonly field: string;
  readonly error: FormulaError;
};

export type TotalError = { readonly field: string; readonly error: FormulaError };

/**
 * The errors that depend on values, which show under their row (and a total's under the Total row),
 * apart from the columns whose formula the build refused: those show once, over the grid.
 */
export const formulaErrors = (
  graph: BoardGraph | undefined,
  itemId: string,
  props: TableProps,
): { readonly rows: readonly RowError[]; readonly totals: readonly TotalError[] } => {
  if (graph === undefined) return { rows: [], totals: [] };
  const refused = columnProblems(graph, itemId, props.columns);
  const rows: RowError[] = [];
  const totals: TotalError[] = [];
  for (const column of props.columns) {
    if (refused.has(column.field)) continue;
    if (column.formula !== undefined) {
      for (const { id } of props.rows) {
        const result = graph.read(`${itemId}.${id}.${column.field}`);
        if (isFormulaError(result)) rows.push({ rowId: id, field: column.field, error: result });
      }
    }
    if (column.total === "sum") {
      const result = graph.read(`${itemId}.${column.field}`);
      if (isFormulaError(result)) totals.push({ field: column.field, error: result });
    }
  }
  return { rows, totals };
};

const PROBLEM_KEYS: Readonly<Record<string, StringKey>> = Object.freeze({
  syntax: "table.problem.syntax",
  "over-limit": "table.problem.overLimit",
  "not-whitelisted": "table.problem.notWhitelisted",
  "missing-reference": "table.problem.missingReference",
  cycle: "table.problem.cycle",
  "mixed-currencies": "table.problem.mixedCurrencies",
  value: "table.problem.value",
  "division-by-zero": "table.problem.divisionByZero",
});

/**
 * The words for a formula error, naming the column by its label. The error's detail is agent text
 * and English, and is never shown (design decision 11); a kind this table does not know reads as a
 * value of the wrong kind.
 */
export const problemText = (language: Locale, error: FormulaError, column: string): string =>
  say(
    language,
    Object.hasOwn(PROBLEM_KEYS, error.error)
      ? (PROBLEM_KEYS[error.error] as StringKey)
      : "table.problem.value",
    { column },
  );

/** What a graph value is for comparison and for the answer: rounded as the answer rounds it. */
const roundedValue = (
  column: TableColumn,
  result: NodeResult | undefined,
): string | number | undefined => {
  if (result === undefined || isFormulaError(result)) return undefined;
  switch (column.type) {
    case "number": {
      if (typeof result !== "number") return undefined;
      const rounded = roundNumber(result, TABLE_ANSWER_DERIVED.decimals);
      return Number.isFinite(rounded) ? rounded : undefined;
    }
    case "money":
      return typeof result === "number" && column.currency !== undefined
        ? moneyDecimal(result, column.currency)
        : undefined;
    case "date":
      return typeof result === "string" ? result : undefined;
    default:
      return undefined;
  }
};

export type DerivedInput = {
  readonly itemId: string;
  /** The value the Table shows: the edited value, else the item's props. */
  readonly props: TableProps;
  /** The item's props as the agent sent them. */
  readonly sentProps: TableProps;
  readonly live: BoardGraph | undefined;
  readonly sent: BoardGraph | undefined;
};

export type DerivedMarks = {
  /** `row.field` of each formula cell that differs from the board as sent. */
  readonly cells: ReadonlySet<string>;
  /** The fields of the totals that differ. */
  readonly totals: ReadonlySet<string>;
};

// Whether the column's value at `address` is a value now that differs from the sent graph's: a value
// where the sent graph held another, an error or no node (an added row).
const moved = (
  column: TableColumn,
  live: BoardGraph,
  sent: BoardGraph,
  address: string,
): boolean => {
  const now = roundedValue(column, live.read(address));
  return now !== undefined && now !== roundedValue(column, sent.read(address));
};

/**
 * The formula cells and totals whose value differs from the board as sent, which take the derived
 * mark and are not counted (design decision 11). A cell in error is not marked: its error shows.
 */
export const derivedMarks = ({ itemId, props, live, sent }: DerivedInput): DerivedMarks => {
  const cells = new Set<string>();
  const totals = new Set<string>();
  if (live === undefined || sent === undefined) return { cells, totals };
  for (const column of props.columns) {
    if (column.formula !== undefined) {
      for (const { id } of props.rows) {
        if (moved(column, live, sent, `${itemId}.${id}.${column.field}`)) {
          cells.add(cellKey(id, column.field));
        }
      }
    }
    if (column.total === "sum" && moved(column, live, sent, `${itemId}.${column.field}`)) {
      totals.add(column.field);
    }
  }
  return { cells, totals };
};

/** The derived values an answer carries, by reference: a number, a money decimal string or a date. */
export type TableDerived = Readonly<Record<string, string | number>>;

/**
 * The answer's derived values by `TABLE_ANSWER_DERIVED`: every total, and the formula cells of rows
 * added and of rows whose value differs from the sent graph's, compared as rounded; a number to 6
 * decimals, money at the currency's minor units written with them, a date as given, a value in
 * error left out.
 */
export const answerDerived = ({
  itemId,
  props,
  sentProps,
  live,
  sent,
}: DerivedInput): TableDerived => {
  if (live === undefined) return Object.freeze({});
  const sentIds = new Set(sentProps.rows.map((row) => row.id));
  const entries: [string, string | number][] = [];
  for (const column of props.columns) {
    if (column.total === "sum") {
      const value = roundedValue(column, live.read(`${itemId}.${column.field}`));
      if (value !== undefined) entries.push([`${itemId}.${column.field}`, value]);
    }
    if (column.formula === undefined) continue;
    for (const { id } of props.rows) {
      const address = `${itemId}.${id}.${column.field}`;
      const value = roundedValue(column, live.read(address));
      if (value === undefined) continue;
      const unchanged =
        sentIds.has(id) && sent !== undefined && value === roundedValue(column, sent.read(address));
      if (!unchanged) entries.push([address, value]);
    }
  }
  return Object.freeze(Object.fromEntries(entries));
};
