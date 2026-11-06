// A Tree's edits carried into the Gantt plans over it (molecules design decisions 11 and 12; F20;
// view spec, "An added package's predecessors", "Deleting a package with dependents", "Linked edits
// within a plan's limits"): the Tree's value and each plan's go in one draft update, the plans'
// from the link's rules (`plan-link.ts`, through the `board-graph` chunk), each from the value the
// board shows for it, an answer's included. A package added takes its anchor's predecessors; a package deleted hands its own to its
// dependents. A plan's write past a limit refuses the whole edit with a field error naming the
// limit, and nothing is written. Plain ECMAScript.

import type { TreeProps } from "@askboard/contract";
import type { BoardContent, Say } from "@askboard/view/catalog";
import {
  afterAdd,
  afterDelete,
  dependentsOf,
  type LinkedValues,
  linkedEdit,
  linkedPlans,
  type PlanRefusal,
} from "../board-graph/index.ts";
import { sameNodes } from "./model/marks.ts";
import { locate, type Nodes } from "./model/nodes.ts";

/** The values a linked edit puts in the draft, by item ID, or the field error that refuses it. */
export type LinkedWrite =
  | { readonly ok: true; readonly values: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly reason: string };

/** A refused linked edit's field error, naming the limit and the task past it by its label. */
export const refusalText = (refusal: PlanRefusal, nodes: Nodes, text: Say): string => {
  if (refusal.limit === "entries") return text("tree.linked.entries", { most: refusal.most });
  const taskId = refusal.taskId ?? "";
  const label = locate(nodes, taskId)?.node.label ?? taskId;
  const key =
    refusal.limit === "predecessors" ? "tree.linked.predecessors" : "tree.linked.dependents";
  return text(key, { label, most: refusal.most });
};

// The Tree's value as the draft holds it: `undefined` once its nodes are the agent's again.
const treeValue = (sent: TreeProps, next: TreeProps): TreeProps | undefined =>
  sameNodes(sent, next) ? undefined : next;

// The Tree's `next` value with the plans' edited values, or the refusal's field error.
const written = (
  treeId: string,
  sent: TreeProps,
  next: TreeProps,
  edit: LinkedValues | PlanRefusal,
  text: Say,
): LinkedWrite =>
  edit.ok
    ? Object.freeze({
        ok: true,
        values: Object.freeze({ [treeId]: treeValue(sent, next), ...edit.values }),
      })
    : Object.freeze({ ok: false, reason: refusalText(edit, next.nodes, text) });

/**
 * The draft update once the package `added` is named in the Tree `treeId` after, or under, the
 * package `anchor`: the Tree's `next` value and each plan the addition changes, or the refusal.
 */
export const linkedAdd = (
  board: Pick<BoardContent, "items" | "shown">,
  treeId: string,
  sent: TreeProps,
  next: TreeProps,
  added: string,
  anchor: string | undefined,
  text: Say,
): LinkedWrite => {
  const plans = anchor === undefined ? [] : linkedPlans(board, treeId);
  const edit = linkedEdit(plans, (plan) => afterAdd(plan.value, plan.sent, added, anchor ?? ""));
  return written(treeId, sent, next, edit, text);
};

/** How many tasks of the plans over the Tree `treeId` depend on the packages `ids`, outside them. */
export const linkedDependents = (
  board: Pick<BoardContent, "items" | "shown">,
  treeId: string,
  ids: readonly string[],
): number =>
  dependentsOf(
    linkedPlans(board, treeId).map((plan) => plan.value),
    ids,
  ).length;

/**
 * The draft update once the packages `deleted`, a branch's every one, leave the Tree `treeId`: the
 * Tree's `next` value and each plan the deletion changes, each dependent connected to the deleted
 * packages' predecessors and each deleted package's entry the agent's again, or the refusal.
 */
export const linkedDelete = (
  board: Pick<BoardContent, "items" | "shown">,
  treeId: string,
  sent: TreeProps,
  next: TreeProps,
  deleted: readonly string[],
  text: Say,
): LinkedWrite => {
  const plans = linkedPlans(board, treeId);
  const edit = linkedEdit(plans, (plan) => afterDelete(plan.value, plan.sent, deleted));
  return written(treeId, sent, next, edit, text);
};
