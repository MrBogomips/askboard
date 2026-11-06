// The three estimates stay in order (widget-editing-plus design decision 3b; spec, "Estimates stay
// in order" and "Estimates in order, the edge cases"): in a work breakdown a row's optimistic is
// at most its most likely, which is at most its pessimistic. One pure check serves the cell editor
// and the bulk adjustment, so that the two agree. An empty estimate takes no part in the order, so
// the order is read over the estimates a row has; and a row the agent sent out of order is not
// made worse: an edit is refused only when it adds a pair out of order or widens a gap. Plain
// ECMAScript; the wording of a refusal is the catalogue's.

import {
  GANTT_PLAN_ESTIMATES,
  type TreeFieldValue,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { isPert, locate } from "./nodes.ts";

/** One of the three estimates' fields. */
export type Estimate = (typeof GANTT_PLAN_ESTIMATES)[number];

/** The estimates a row has, by field; an empty one is absent. */
export type Estimates = Readonly<Partial<Record<Estimate, number>>>;

/** The pair of estimates out of order, from the first that must not exceed the second. */
export type OrderRule = "optimisticLikely" | "likelyPessimistic" | "optimisticPessimistic";

/** A pair out of order: the estimate that is too high, the one it exceeds, and by how much. */
export type OrderViolation = {
  readonly rule: OrderRule;
  readonly over: Estimate;
  readonly under: Estimate;
  readonly gap: number;
};

const RULES: Readonly<Record<string, OrderRule>> = Object.freeze({
  "optimistic mostLikely": "optimisticLikely",
  "mostLikely pessimistic": "likelyPessimistic",
  "optimistic pessimistic": "optimisticPessimistic",
});

/** Whether `field` is one of the three estimates. */
export const isEstimate = (field: string): field is Estimate =>
  GANTT_PLAN_ESTIMATES.some((name) => name === field);

/** The estimates the node `node` holds. */
export const estimatesOf = (node: TreeNode): Estimates => {
  const out: Partial<Record<Estimate, number>> = {};
  for (const field of GANTT_PLAN_ESTIMATES) {
    const input = node[field];
    if (typeof input === "number") out[field] = input;
  }
  return out;
};

/** `estimates` with `field` set to `input`, or emptied when `input` is no number. */
export const withEstimate = (
  estimates: Estimates,
  field: Estimate,
  input: TreeFieldValue | undefined,
): Estimates => {
  const { [field]: _, ...rest } = estimates;
  return typeof input === "number" ? { ...rest, [field]: input } : rest;
};

/** The pairs out of order, each estimate against the next one the row has, in the row's order. */
export const violationsOf = (estimates: Estimates): readonly OrderViolation[] => {
  const present = GANTT_PLAN_ESTIMATES.flatMap((field) => {
    const input = estimates[field];
    return input === undefined ? [] : [{ field, input }];
  });
  const found: OrderViolation[] = [];
  present.forEach((low, at) => {
    const high = present[at + 1];
    if (high === undefined || low.input <= high.input) return;
    const rule = RULES[`${low.field} ${high.field}`] as OrderRule;
    found.push({ rule, over: low.field, under: high.field, gap: low.input - high.input });
  });
  return found;
};

const totalGap = (violations: readonly OrderViolation[]): number =>
  violations.reduce((sum, one) => sum + one.gap, 0);

/**
 * The violation that stops a row going from `before` to `after`: none when `after` is in order,
 * and none when it is out of order but no worse than `before` (no more pairs, no larger gaps).
 */
export const orderViolation = (before: Estimates, after: Estimates): OrderViolation | undefined => {
  const now = violationsOf(after);
  const was = violationsOf(before);
  if (now.length === 0) return undefined;
  const worse = now.length > was.length || totalGap(now) > totalGap(was);
  if (!worse) return undefined;
  // The pair the edit made out of order, or widened, rather than one the agent sent that way.
  const gapWas = (rule: OrderRule): number => was.find((one) => one.rule === rule)?.gap ?? 0;
  return now.find((one) => one.gap > gapWas(one.rule)) ?? now[0];
};

/**
 * Why a work breakdown refuses `input` as the estimate `field` of the node `nodeId`: the rule it
 * breaks, or `undefined` when it keeps the order or makes it no worse, for another field, an
 * unknown node or a Tree without `pert`.
 */
export const estimateOrderProblem = (
  value: TreeProps,
  nodeId: string,
  field: string,
  input: TreeFieldValue | undefined,
): OrderRule | undefined => {
  const place = locate(value.nodes, nodeId);
  if (!isPert(value) || !isEstimate(field) || place === undefined) return undefined;
  const before = estimatesOf(place.node);
  return orderViolation(before, withEstimate(before, field, input))?.rule;
};
