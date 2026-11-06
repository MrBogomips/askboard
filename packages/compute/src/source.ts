// The graph source: what `buildGraph` reads (design decision 2). Items with typed fields, cells and
// a tree of children. A source that breaks these rules is refused with a `GraphSourceError` before
// any graph exists; the input format's schemas refuse the same documents at send time.

import { ID_PATTERN, isFieldName, parseCell } from "@askboard/contract";
import { type Scalar, VALUE_TYPES, type ValueType } from "./types.ts";

/** One field or cell: an input value, or a formula; money also has a currency. */
export type FieldInput = {
  readonly type: ValueType;
  /** An input value; absent or null is empty. */
  readonly value?: Scalar;
  /** A formula in AskBoard's syntax, without a leading `=`. */
  readonly formula?: string;
  /** ISO 4217: a money input's own currency, or a money formula's fixed one. */
  readonly currency?: string;
};

export type Fields = Readonly<Record<string, FieldInput>>;

export type GraphChild = {
  readonly id: string;
  readonly fields?: Fields;
  readonly children?: readonly GraphChild[];
};

export type FieldsItem = {
  readonly kind: "fields";
  readonly id: string;
  /** The currency of the item's money inputs that name none (AD-7). */
  readonly currency?: string;
  readonly fields?: Fields;
  /** Spreadsheet cells by A1 address. */
  readonly cells?: Fields;
  readonly children?: readonly GraphChild[];
};

/** A WBS node with three-point estimates, as the approved UJ-2 example writes it; other keys are ignored. */
export type WbsNode = {
  readonly id: string;
  readonly optimistic?: number | null;
  readonly mostLikely?: number | null;
  readonly pessimistic?: number | null;
  readonly children?: readonly WbsNode[];
};

/** A WBS with PERT estimates (FR-15): each leaf's estimates are inputs, the rest is derived. */
export type WbsPertItem = {
  readonly kind: "wbs-pert";
  readonly id: string;
  readonly nodes: readonly WbsNode[];
};

/** A Gantt plan over a WBS's leaves (FR-12, FR-15), as the approved UJ-2 example writes it. */
export type GanttPlanItem = {
  readonly kind: "gantt-plan";
  readonly id: string;
  /** The ID of the `wbs-pert` item whose leaves are the plan's tasks. */
  readonly workPackages: string;
  /** The plan's start, a `full-date`; work starts on the first working day on or after it. */
  readonly start: string;
  /** Each task's predecessors, finish to start, by task ID. */
  readonly dependencies?: Readonly<Record<string, readonly string[]>>;
  /** The start the user asked for, by task ID: the task starts then or as soon after as it can. */
  readonly starts?: Readonly<Record<string, string>>;
  /** The duration the user asked for, by task ID, in whole working days: it wins over the effort. */
  readonly durations?: Readonly<Record<string, number>>;
};

/** A task of a Gantt with its own tasks: its duration in working days, a whole number from 1. */
export type GanttTask = { readonly id: string; readonly duration: number };

/** A Gantt with its own tasks (FR-11): scheduled as a plan is, each duration as given. */
export type GanttItem = {
  readonly kind: "gantt";
  readonly id: string;
  /** The plan's start, a `full-date`; work starts on the first working day on or after it. */
  readonly start: string;
  /** The tasks, in the agent's order. */
  readonly tasks: readonly GanttTask[];
  /** Each task's predecessors, finish to start, by task ID. */
  readonly dependencies?: Readonly<Record<string, readonly string[]>>;
  /** The start the user asked for, by task ID: the task starts then or as soon after as it can. */
  readonly starts?: Readonly<Record<string, string>>;
};

export type GraphItem = FieldsItem | WbsPertItem | GanttPlanItem | GanttItem;

export type GraphSource = { readonly items: readonly GraphItem[] };

export class GraphSourceError extends Error {
  override readonly name = "GraphSourceError";
}

const ID = new RegExp(ID_PATTERN);
const CURRENCY = /^[A-Z]{3}$/;
const TYPES: ReadonlySet<string> = new Set(VALUE_TYPES);

export const refuse = (message: string): never => {
  throw new GraphSourceError(message);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const checkId = (id: unknown, what: string, where: string): string => {
  if (typeof id !== "string" || !ID.test(id)) {
    refuse(`${where}${what} ID ${JSON.stringify(id)} is not ${ID_PATTERN}`);
  }
  return id as string;
};

export const checkCurrency = (currency: unknown, where: string): string | undefined => {
  if (currency === undefined) return undefined;
  if (typeof currency !== "string" || !CURRENCY.test(currency)) {
    refuse(`${where}: currency ${JSON.stringify(currency)} is not an ISO 4217 code`);
  }
  return currency as string;
};

export const listOf = <T>(value: unknown, what: string, where: string): readonly T[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) refuse(`${where}: ${what} is not a list`);
  return value as readonly T[];
};

/** A checked field input, with the currency a money input takes from its item. */
export const checkFieldInput = (
  input: unknown,
  where: string,
  itemCurrency: string | undefined,
): FieldInput => {
  if (!isRecord(input)) return refuse(`${where}: not a field input`);
  const { type, value, formula } = input;
  if (typeof type !== "string" || !TYPES.has(type)) {
    refuse(`${where}: unknown type ${JSON.stringify(type)}`);
  }
  if (formula !== undefined && value !== undefined)
    refuse(`${where}: holds both a value and a formula`);
  if (formula !== undefined && typeof formula !== "string")
    refuse(`${where}: the formula is not text`);
  const own = checkCurrency(input.currency, where);
  if (own !== undefined && type !== "money") refuse(`${where}: only money has a currency`);
  if (formula !== undefined) return input as FieldInput;
  const currency = type === "money" ? (own ?? itemCurrency) : undefined;
  if (type === "money" && currency === undefined)
    refuse(`${where}: a money input needs a currency`);
  return {
    type: type as ValueType,
    value: (value as Scalar | undefined) ?? null,
    ...(currency ? { currency } : {}),
  };
};

/** The checked fields of an item or a child, in declaration order. */
export const fieldsOf = (
  fields: unknown,
  where: string,
  itemCurrency: string | undefined,
): readonly (readonly [string, FieldInput])[] => {
  if (fields === undefined) return [];
  if (!isRecord(fields)) return refuse(`${where}: fields is not an object`);
  return Object.keys(fields).map((name) => {
    if (!isFieldName(name)) refuse(`${where}: ${JSON.stringify(name)} is not a field name`);
    return [name, checkFieldInput(fields[name], `${where}, field ${name}`, itemCurrency)] as const;
  });
};

/** The checked cells of an item, row by row. */
export const cellsOf = (
  cells: unknown,
  where: string,
  itemCurrency: string | undefined,
): readonly (readonly [string, FieldInput])[] => {
  if (cells === undefined) return [];
  if (!isRecord(cells)) return refuse(`${where}: cells is not an object`);
  const keyed = Object.keys(cells).map((cell) => {
    const at = parseCell(cell) ?? refuse(`${where}: ${JSON.stringify(cell)} is not a cell`);
    return {
      cell,
      at,
      input: checkFieldInput(cells[cell], `${where}, cell ${cell}`, itemCurrency),
    };
  });
  keyed.sort((a, b) => a.at.row - b.at.row || a.at.column - b.at.column);
  return keyed.map(({ cell, input }) => [cell, input] as const);
};
