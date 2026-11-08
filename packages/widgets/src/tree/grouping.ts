// When an edit asks before it makes a leaf a group (view spec, "Making a work package a group asks
// first"; design decision 1): a drop into a leaf, an indent under one and "Add child" on one each
// give it its first child, and a work package's estimates leave the totals and its plan task goes
// while it has children. The rule is pure, over the value as it is, and takes only an edit the
// model's checks already allow, so a refused drop never asks. The edits themselves stay pure
// (`model/edits.ts`): the question is view state, as the delete question is (`widget.tsx`). No
// React, no DOM; only the words take the catalog's `Say`, as a type.

import { GANTT_PLAN_ESTIMATES, type TreeProps } from "@askboard/contract";
import type { Say } from "@askboard/view/catalog";
import type { Drop } from "./model/drop.ts";
import { can } from "./model/edits.ts";
import { isPert, locate } from "./model/nodes.ts";

/** An edit that may give a leaf its first child: a drop, an indent or "Add child". */
export type GroupEdit =
  | { readonly kind: "drop"; readonly nodeId: string; readonly drop: Drop }
  | { readonly kind: "indent"; readonly nodeId: string }
  | { readonly kind: "addChild"; readonly nodeId: string };

/** What the question says: the leaf's name, what it would lose and how many tasks depend on it. */
export type GroupQuestion = {
  readonly label: string;
  /** The leaf holds an estimate that counts in a work breakdown's totals. */
  readonly estimates: boolean;
  /** A plan of the question names the Tree, so the leaf is a task of it. */
  readonly task: boolean;
  /** How many tasks of the plans over the Tree depend on the leaf. */
  readonly dependents: number;
};

/** What the question needs of the board: whether a plan names the Tree, and who depends on a leaf. */
export type GroupContext = {
  readonly planned: boolean;
  readonly countDependents: (ids: readonly string[]) => number;
};

// The leaf's ID when it has no child, or `undefined`.
const leafId = (value: TreeProps, id: string): string | undefined => {
  const place = locate(value.nodes, id);
  return place !== undefined && (place.node.children?.length ?? 0) === 0 ? id : undefined;
};

/**
 * The ID of the leaf `edit` would give its first child, or `undefined` when it gives none: a drop
 * before or after a node, one into a parent, an indent under a parent, a refused edit and an
 * unknown node.
 */
export const grouped = (value: TreeProps, edit: GroupEdit): string | undefined => {
  if (locate(value.nodes, edit.nodeId) === undefined) return undefined;
  switch (edit.kind) {
    case "drop":
      return edit.drop.kind === "into" ? leafId(value, edit.drop.targetId) : undefined;
    case "indent": {
      const place = locate(value.nodes, edit.nodeId);
      const previous = place?.siblings[(place?.index ?? 0) - 1];
      return can("indent", value, edit.nodeId) && previous !== undefined
        ? leafId(value, previous.id)
        : undefined;
    }
    case "addChild":
      return can("addChild", value, edit.nodeId) ? leafId(value, edit.nodeId) : undefined;
  }
};

// Whether the leaf holds a value in any of the PERT estimate fields.
const holdsEstimate = (value: TreeProps, id: string): boolean => {
  const node = locate(value.nodes, id)?.node;
  return (
    node !== undefined &&
    GANTT_PLAN_ESTIMATES.some((field) => node[field] !== undefined && node[field] !== null)
  );
};

/**
 * The question `edit` asks first, from the value as it is; `undefined` when the edit makes no leaf a
 * group, and when that leaf has no estimate that counts and is no task of a plan.
 */
export const groupQuestionOf = (
  value: TreeProps,
  edit: GroupEdit,
  { planned, countDependents }: GroupContext,
): GroupQuestion | undefined => {
  const id = grouped(value, edit);
  const label = id === undefined ? undefined : locate(value.nodes, id)?.node.label;
  if (id === undefined || label === undefined) return undefined;
  const estimates = isPert(value) && holdsEstimate(value, id);
  if (!estimates && !planned) return undefined;
  return Object.freeze({ label, estimates, task: planned, dependents: countDependents([id]) });
};

// What leaves with the leaf: its estimates, its task, or both.
const losing = ({ estimates, task }: GroupQuestion, text: Say): string =>
  text(
    estimates && task
      ? "tree.group.estimatesAndTask"
      : estimates
        ? "tree.group.estimates"
        : "tree.group.task",
  );

/**
 * The question's words after the leaf's name, as `deletedWith` gives the delete question's: that it
 * becomes a group, what leaves with it, and how many tasks of the plans depend on it, in the ask's
 * language through `text`.
 */
export const groupedWith = (question: GroupQuestion, text: Say): string => {
  const rest = `${text("tree.group.becomes")} ${losing(question, text)}`;
  return question.dependents < 1
    ? rest
    : `${rest} ${text("tree.delete.dependsOnIt", { count: question.dependents })}`;
};
