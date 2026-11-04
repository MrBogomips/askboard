// A Tree's edits carried into the Gantt plans over it (molecules design decisions 11 and 12; F20;
// view spec, "An added package's predecessors", "Linked edits within a plan's limits"): the Tree's
// value and each plan's go in one draft update, the plans' from the link's rules (`plan-link.ts`,
// through the `board-graph` chunk), each from the value the board shows for it, an answer's
// included. A plan's write past a limit refuses the whole edit with a field error naming the
// limit, and nothing is written. Plain ECMAScript.

import type { TreeProps } from "@askboard/contract";
import type { BoardContent } from "@askboard/view/catalog";
import { afterAdd, linkedEdit, linkedPlans, type PlanRefusal } from "../graph/index.ts";
import { sameNodes } from "./model/marks.ts";
import { locate, type Nodes } from "./model/nodes.ts";

/** The values a linked edit puts in the draft, by item ID, or the field error that refuses it. */
export type LinkedWrite =
  | { readonly ok: true; readonly values: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly reason: string };

/** A refused linked edit's field error, naming the limit and the task past it by its label. */
export const refusalText = (refusal: PlanRefusal, nodes: Nodes): string => {
  if (refusal.limit === "entries") {
    return `The plan would hold more than ${refusal.most} tasks, the most a plan can hold.`;
  }
  const taskId = refusal.taskId ?? "";
  const label = locate(nodes, taskId)?.node.label ?? taskId;
  const what = refusal.limit === "predecessors" ? "predecessors" : "dependent tasks";
  return `${label} would have more than ${refusal.most} ${what}, the most a task can have.`;
};

// The Tree's value as the draft holds it: `undefined` once its nodes are the agent's again.
const treeValue = (sent: TreeProps, next: TreeProps): TreeProps | undefined =>
  sameNodes(sent, next) ? undefined : next;

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
): LinkedWrite => {
  const plans = anchor === undefined ? [] : linkedPlans(board, treeId);
  const edit = linkedEdit(plans, (plan) => afterAdd(plan.value, plan.sent, added, anchor ?? ""));
  if (!edit.ok) return Object.freeze({ ok: false, reason: refusalText(edit, next.nodes) });
  return Object.freeze({
    ok: true,
    values: Object.freeze({ [treeId]: treeValue(sent, next), ...edit.values }),
  });
};
