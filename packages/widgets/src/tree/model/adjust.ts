// The Tree's bulk percentage adjustment (widget-editing-plus design decision 3; spec, "Tree bulk
// percentage adjustment", "The adjustment percentage", "Tree bulk adjustment values", "Estimates in
// order, the edge cases"): a pure plan from a value, a selection, the checked columns and a
// percentage, to what changes, what is skipped, or a refusal naming the rows that would break the
// order of the estimates or their range. The adjustment is all or nothing, and an edit and not a
// formula (AD-13). The arithmetic is decimal: the old value as its exact decimal digits and the
// percentage as tenths, scaled to integers (`BigInt`), the result rounded half away from zero to
// one decimal, so 3 adjusted by +10 is 3.3 and 2.25 is 2.5, never a float's 3.3000000000000003.
// Plain ECMAScript.

import {
  type Locale,
  TREE_PERT_MAX_ESTIMATE,
  type TreeColumn,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { say } from "@askboard/view/catalog";
import { parseNumber } from "../../shared/number.ts";
import {
  type Estimate,
  estimatesOf,
  isEstimate,
  type OrderRule,
  orderViolation,
  withEstimate,
} from "./coherence.ts";
import { frozenWith, isPert, type Nodes } from "./nodes.ts";
import { type Selection, selectedLeaves } from "./selection.ts";

/** The percentage's lowest and highest values, in tenths of a percent: -99.9 and +1000. */
export const PERCENT_MIN_TENTHS = -999;
export const PERCENT_MAX_TENTHS = 10_000;

export type PercentEntry =
  /** The percentage in tenths of a percent, an integer: `12` is 1.2%. */
  | { readonly kind: "percent"; readonly tenths: number }
  | { readonly kind: "empty" }
  | { readonly kind: "refused"; readonly reason: string };

const refusal = (reason: string): PercentEntry => Object.freeze({ kind: "refused", reason });

// A number's tenths, an integer, when it has at most one decimal.
const tenthsOf = (value: number): number | undefined => {
  const scaled = value * 10;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 1e-9 ? rounded : undefined;
};

/**
 * Reads the percentage typed in `locale`, by AskBoard's number parser: at most one decimal, from
 * -99.9 to +1000; anything else is refused with a reason in `language`. The field shows no echo.
 */
export const parsePercent = (
  input: string,
  locale: Locale = "en-US",
  language: Locale = locale,
): PercentEntry => {
  const entry = parseNumber(input, locale, language);
  if (entry.kind === "refused") return refusal(entry.reason);
  if (entry.kind === "empty") return Object.freeze({ kind: "empty" });
  const tenths = tenthsOf(entry.value);
  if (tenths === undefined) return refusal(say(language, "tree.adjust.percentDecimals"));
  if (tenths < PERCENT_MIN_TENTHS || tenths > PERCENT_MAX_TENTHS) {
    return refusal(say(language, "tree.adjust.percentRange"));
  }
  return Object.freeze({ kind: "percent", tenths });
};

// A number as an integer and a power of ten, from its exact decimal digits: `digits` over 10^`scale`.
const decimalOf = (value: number): { readonly digits: bigint; readonly scale: number } => {
  const text = /e/i.test(String(value)) ? value.toFixed(20) : String(value);
  const [whole = "0", fraction = ""] = text.split(".");
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length };
};

// The quotient of `top` over `bottom` (positive), rounded half away from zero.
const roundedQuotient = (top: bigint, bottom: bigint): bigint => {
  const magnitude = top < 0n ? -top : top;
  const quotient = (2n * magnitude + bottom) / (2n * bottom);
  return top < 0n ? -quotient : quotient;
};

/**
 * `value` times (1 + p/100), p given as `tenths` of a percent, rounded half away from zero to one
 * decimal, in decimal arithmetic.
 */
export const adjustValue = (value: number, tenths: number): number => {
  const { digits, scale } = decimalOf(value);
  // In tenths: digits / 10^scale * 10 * (1000 + tenths) / 1000.
  const top = digits * 10n * BigInt(1000 + tenths);
  const bottom = 1000n * 10n ** BigInt(scale);
  return Number(roundedQuotient(top, bottom)) / 10;
};

/** One value an adjustment changes. */
export type AdjustedValue = {
  readonly nodeId: string;
  readonly label: string;
  readonly field: string;
  /** The column's label. */
  readonly column: string;
  readonly from: number;
  readonly to: number;
};

/** What breaks: the order of a row's estimates, or the range of 0 to 100,000 working days. */
export type AdjustProblem = {
  readonly nodeId: string;
  readonly label: string;
  readonly field: string;
  readonly column: string;
  readonly rule: "range" | OrderRule;
};

export type AdjustmentPlan =
  | {
      readonly kind: "ready";
      /** Each changed value, rows in document order, columns in the order checked. */
      readonly changes: readonly AdjustedValue[];
      /** Values with no number in them, left empty. */
      readonly skipped: number;
    }
  | {
      readonly kind: "refused";
      readonly problems: readonly AdjustProblem[];
      readonly skipped: number;
    };

const READY_NOTHING: AdjustmentPlan = Object.freeze({ kind: "ready", changes: [], skipped: 0 });

/** The number columns an adjustment can change: in a work breakdown the three estimates, else every number column. */
export const adjustableColumns = (value: TreeProps): readonly TreeColumn[] =>
  (value.columns ?? []).filter((column) =>
    isPert(value) ? isEstimate(column.field) : column.type === "number",
  );

const numberOf = (node: TreeNode, field: string): number | undefined => {
  const input = Object.hasOwn(node, field) ? node[field] : undefined;
  return typeof input === "number" ? input : undefined;
};

// The values of one row an adjustment changes, the empty ones counted, the unchanged left out.
const rowChanges = (
  node: TreeNode,
  columns: readonly TreeColumn[],
  tenths: number,
): { readonly changes: readonly AdjustedValue[]; readonly skipped: number } => {
  const changes: AdjustedValue[] = [];
  let skipped = 0;
  for (const { field, label: column } of columns) {
    const from = numberOf(node, field);
    if (from === undefined) skipped += 1;
    else {
      const to = adjustValue(from, tenths);
      if (to !== from)
        changes.push({ nodeId: node.id, label: node.label, field, column, from, to });
    }
  }
  return { changes, skipped };
};

// What breaks in one work breakdown row once `changes` are made: a value out of range, then the
// order of the estimates, the column named being the one the adjustment moved when it moved one.
const rowProblems = (
  node: TreeNode,
  changes: readonly AdjustedValue[],
  columns: readonly TreeColumn[],
): readonly AdjustProblem[] => {
  const problem = (change: AdjustedValue, rule: AdjustProblem["rule"]): AdjustProblem => ({
    nodeId: change.nodeId,
    label: change.label,
    field: change.field,
    column: change.column,
    rule,
  });
  const outside = changes.filter((one) => !(one.to >= 0 && one.to <= TREE_PERT_MAX_ESTIMATE));
  if (outside.length > 0) return outside.map((one) => problem(one, "range"));
  const before = estimatesOf(node);
  let after = before;
  for (const one of changes)
    if (isEstimate(one.field)) after = withEstimate(after, one.field as Estimate, one.to);
  const violation = orderViolation(before, after);
  if (violation === undefined) return [];
  const changed = changes.find(
    (one) => one.field === violation.over || one.field === violation.under,
  );
  const named = columns.find((column) => column.field === (changed?.field ?? violation.over));
  const at = changed ?? {
    nodeId: node.id,
    label: node.label,
    field: violation.over,
    column: "",
    from: 0,
    to: 0,
  };
  return [{ ...problem(at, violation.rule), column: named?.label ?? at.column }];
};

/**
 * What adjusting the `fields` of the leaves among the `selection` by `tenths` of a percent does: the
 * values that change and how many are skipped, or the rows that would break the order of the
 * estimates or their range, in which case nothing is to change (all or nothing).
 */
export const planAdjustment = (
  value: TreeProps,
  selection: Selection,
  fields: readonly string[],
  tenths: number,
): AdjustmentPlan => {
  const columns = adjustableColumns(value).filter((column) => fields.includes(column.field));
  if (columns.length === 0) return READY_NOTHING;
  const changes: AdjustedValue[] = [];
  const problems: AdjustProblem[] = [];
  let skipped = 0;
  for (const node of selectedLeaves(selection, value)) {
    const row = rowChanges(node, columns, tenths);
    skipped += row.skipped;
    changes.push(...row.changes);
    if (isPert(value)) problems.push(...rowProblems(node, row.changes, columns));
  }
  return problems.length > 0
    ? Object.freeze({ kind: "refused", problems, skipped })
    : Object.freeze({ kind: "ready", changes, skipped });
};

// `nodes` with the changed values of `plan` written, other nodes and keys kept as they are.
const written = (nodes: Nodes, byNode: ReadonlyMap<string, readonly AdjustedValue[]>): Nodes =>
  nodes.map((node) => {
    const own = byNode.get(node.id);
    const next =
      own === undefined
        ? node
        : { ...node, ...Object.fromEntries(own.map((one) => [one.field, one.to])) };
    return node.children === undefined
      ? next
      : { ...next, children: written(node.children, byNode) };
  });

/**
 * `value` with exactly the values `plan` showed changed, as a new value frozen at every level; the
 * same `value` for a refused plan or one that changes nothing.
 */
export const applyAdjustment = (value: TreeProps, plan: AdjustmentPlan): TreeProps => {
  if (plan.kind !== "ready" || plan.changes.length === 0) return value;
  const byNode = new Map<string, AdjustedValue[]>();
  for (const one of plan.changes) byNode.set(one.nodeId, [...(byNode.get(one.nodeId) ?? []), one]);
  return frozenWith(value, written(value.nodes, byNode));
};
