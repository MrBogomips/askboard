// Widget item checks (molecules design decision 6; contract spec, "Widget item checks"): a widget
// item the contract defines, checked in the question that holds it, through the widget's own
// validator, its schema then its checks, and for a Gantt plan its link; nothing of their own. Each
// problem keeps the path the widget's checks give it, inside the item's props; an item of a type the
// contract defines no widget for is refused whole, at `/`. `elementShapeOf` gives the shape the one
// generic diff takes for an item (AD-20). The validators compile on their first call, not at import.

import type { Checked, Problem } from "../validate.ts";
import type { ElementShape } from "./element-diff.ts";
import { ganttPlanLinkProblems } from "./gantt/checks.ts";
import { ganttShape } from "./gantt/index.ts";
import { validateGanttProps } from "./gantt/validate.ts";
import { TREE_SHAPE } from "./tree/index.ts";
import { validateTreeProps } from "./tree/validate.ts";

/** Whether a widget's value is the agent's or the user's edit. */
export type WidgetOrigin = "agent" | "edited";

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const problemsOf = (checked: Checked<unknown>): readonly Problem[] =>
  checked.ok ? [] : checked.problems;

/**
 * The problems of a widget item `{type, id, props}` in `question`, the question that holds it:
 * a Tree's through `validateTreeProps`, a Gantt's through `validateGanttProps` and, for a plan,
 * `ganttPlanLinkProblems`; any other type one problem naming the item and its type.
 */
export const widgetItemProblems = (
  item: unknown,
  question: unknown,
  origin: WidgetOrigin,
): readonly Problem[] => {
  const type = isRecord(item) ? item.type : undefined;
  const props = isRecord(item) ? item.props : undefined;
  if (type === "tree") return problemsOf(validateTreeProps(props, origin));
  if (type === "gantt") {
    return [
      ...problemsOf(validateGanttProps(props, origin)),
      ...ganttPlanLinkProblems(item, question),
    ];
  }
  const id = isRecord(item) && typeof item.id === "string" ? `item ${item.id}` : "an item";
  const named = typeof type === "string" ? `the type "${type}"` : "no type";
  return [{ path: "/", message: `${id} has ${named}, which is no widget the contract defines` }];
};

/** The element shape of a widget item for the generic diff; undefined for any other item. */
export const elementShapeOf = (item: unknown): ElementShape | undefined => {
  if (!isRecord(item)) return undefined;
  if (item.type === "tree") return TREE_SHAPE;
  if (item.type === "gantt") return ganttShape(isRecord(item.props) ? item.props : {});
  return undefined;
};
