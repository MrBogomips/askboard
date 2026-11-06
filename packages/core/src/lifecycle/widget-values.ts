// The widget content of an answer act (widget-answers design decision 6, steps 1 to 5; and
// decision 10): the `values` and `derived` the board sent, checked against the revision the answer
// names, since commands come from outside the process. `values` name `tree` or `gantt` items of the
// question and are each checked through the widget's own checks in the question as edited; a value
// equal to the item as sent is no change and drops out; `derived` keys address a widget item and a
// field its widget declares, and each value is JSON. Plain ECMAScript (AD-1).

import {
  applyElementChanges,
  elementChanges,
  GANTT_ANSWER_DERIVED,
  type QuestionProps,
  TREE_PERT_ANSWER_DERIVED,
} from "@askboard/contract";
import { elementShapeOf, widgetItemProblems } from "@askboard/contract/validate";
import { canonicalize } from "../canonical.ts";
import type { ContentProblem } from "./answers.ts";

type Json = Readonly<Record<string, unknown>>;
type Item = { readonly type: string; readonly id: string; readonly props: unknown };

/**
 * What an answer's widget fields hold once checked: the values that changed, the derived values,
 * and the revision's widget items as sent, which the changes are computed against.
 */
export type WidgetContent = {
  readonly values: Json;
  readonly derived: Json;
  readonly sent: readonly Item[];
};

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const refused = (detail: string): ContentProblem => ({ refusal: "content", detail });

const isWidget = (item: unknown): item is Item =>
  isRecord(item) && (item.type === "tree" || item.type === "gantt") && typeof item.id === "string";

/** The widget items of a revision's props, by ID. */
const widgetsOf = (props: QuestionProps): ReadonlyMap<string, Item> => {
  const { items } = props as { readonly items?: readonly unknown[] };
  return new Map((items ?? []).filter(isWidget).map((item) => [item.id, item]));
};

const isJson = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return isRecord(value) && Object.values(value).every(isJson);
};

/** The question's props with each edited value in place of the item's props. */
const editedProps = (props: QuestionProps, values: Json): { readonly props: unknown } => {
  const { items } = props as { readonly items?: readonly unknown[] };
  return {
    props: {
      ...props,
      items: (items ?? []).map((item) =>
        isWidget(item) && Object.hasOwn(values, item.id)
          ? { ...item, props: values[item.id] }
          : item,
      ),
    },
  };
};

// Steps 1 and 2: the keys, then each value through its widget's checks in the question as edited.
const valuesProblem = (
  values: Json,
  widgets: ReadonlyMap<string, Item>,
  props: QuestionProps,
): ContentProblem | undefined => {
  for (const id of Object.keys(values)) {
    if (!widgets.has(id)) {
      return refused(`values name "${id}", which is no Tree or Gantt item of the question`);
    }
  }
  const question = editedProps(props, values);
  for (const [id, item] of widgets) {
    if (!Object.hasOwn(values, id)) continue;
    const [first] = widgetItemProblems({ ...item, props: values[id] }, question, "edited");
    if (first !== undefined) return refused(`the value of item "${id}": ${first.message}`);
  }
  return undefined;
};

const sameAs = (item: Item, edited: unknown): boolean =>
  canonicalize(item.props) === canonicalize(edited);

/** Whether `nodeId` is a node of the Tree props, at any depth. */
const hasNode = (props: unknown, nodeId: string): boolean => {
  const walk = (nodes: unknown): boolean =>
    Array.isArray(nodes) &&
    nodes.some((node) => isRecord(node) && (node.id === nodeId || walk(node.children)));
  return isRecord(props) && walk(props.nodes);
};

// A Gantt declares `finish` and `criticalPath`; a Tree with PERT its item totals and, per node,
// the fields of TREE_PERT_ANSWER_DERIVED (F7).
const addressProblem = (item: Item, rest: readonly string[], props: unknown) => {
  if (item.type === "gantt") {
    const declared = Object.keys(GANTT_ANSWER_DERIVED);
    return rest.length === 1 && declared.includes(rest[0] ?? "")
      ? undefined
      : `a Gantt declares ${declared.join(" and ")}`;
  }
  const fields: readonly string[] = TREE_PERT_ANSWER_DERIVED.fields;
  const pert = isRecord(props) && props.pert === true;
  if (!pert) return "a Tree declares derived values only with pert";
  const [first, second] = rest;
  const totals = rest.length === 1 && fields.includes(first ?? "");
  const node = rest.length === 2 && fields.includes(second ?? "") && hasNode(props, first ?? "");
  return totals || node
    ? undefined
    : `a Tree with pert declares ${fields.join(" and ")} and its nodes'`;
};

// Step 3: the changes of an edited value, applied to the item as sent, must give the value back;
// one that they do not rebuild, such as an edit of a Tree's columns, would reach the agent as
// changes that miss part of what the board sent.
const roundTripProblem = (item: Item, edited: unknown): ContentProblem | undefined => {
  const shape = elementShapeOf(item);
  if (shape === undefined || !isRecord(item.props) || !isRecord(edited)) return undefined;
  const changes = elementChanges(item.id, item.props, edited, shape);
  let rebuilt: unknown;
  try {
    rebuilt = applyElementChanges(item.id, item.props, changes, shape);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return refused(`the value of item "${item.id}" is not described by its changes: ${why}`);
  }
  return canonicalize(rebuilt) === canonicalize(edited)
    ? undefined
    : refused(
        `the value of item "${item.id}" changes more than elements, which its changes cannot describe`,
      );
};

// Step 5.
const derivedProblem = (
  derived: Json,
  widgets: ReadonlyMap<string, Item>,
  values: Json,
): ContentProblem | undefined => {
  for (const [key, value] of Object.entries(derived)) {
    const [id = "", ...rest] = key.split(".");
    const item = widgets.get(id);
    if (item === undefined) {
      return refused(`the derived key "${key}" names no Tree or Gantt item of the question`);
    }
    const props = Object.hasOwn(values, id) ? values[id] : item.props;
    const why = addressProblem(item, rest, props);
    if (why !== undefined)
      return refused(`the derived key "${key}" is no field its widget declares: ${why}`);
    if (!isJson(value)) return refused(`the derived value of "${key}" is not JSON`);
  }
  return undefined;
};

/**
 * The widget content of an answer act for the revision `props`, or why it is refused. An act
 * with neither field has none; unchanged values are left out of the result.
 */
export const widgetContentOf = (
  act: Json,
  props: QuestionProps,
): WidgetContent | ContentProblem => {
  const { values = {}, derived = {} } = act;
  if (!isRecord(values)) return refused("the values are not an object of edited values by item ID");
  if (!isRecord(derived)) return refused("the derived values are not an object by address");
  const widgets = widgetsOf(props);
  const bad = valuesProblem(values, widgets, props) ?? derivedProblem(derived, widgets, values);
  if (bad !== undefined) return bad;
  const changed = Object.entries(values).filter(([id, edited]) => {
    const item = widgets.get(id);
    return item !== undefined && !sameAs(item, edited);
  });
  for (const [id, edited] of changed) {
    const unsound = roundTripProblem(widgets.get(id) as Item, edited);
    if (unsound !== undefined) return unsound;
  }
  return { values: Object.fromEntries(changed), derived, sent: [...widgets.values()] };
};

export const isWidgetProblem = (
  content: WidgetContent | ContentProblem,
): content is ContentProblem => "refusal" in content;
