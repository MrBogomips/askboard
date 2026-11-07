// The widget content of an answer act (widget-answers design decision 6, steps 1 to 5; decision 10;
// and widget-registry design decisions 2 and 6): the `values`, `results` and `derived` the board
// sent, checked against the revision the answer names, since commands come from outside the
// process. Every widget type is found through the registry. `values` name widget items of the
// question and are each checked through the type's own checks in the question as edited; a value
// equal to the item as sent is no change and drops out; `results` name items whose type declares a
// result, each checked by the type's schema and checks against the item as edited, else as sent;
// `derived` keys address a widget item and a field its type declares, and each value is JSON.
// Plain ECMAScript (AD-1).

import {
  applyElementChanges,
  type Change,
  elementChanges,
  JSON_MAX_DEPTH,
  type QuestionProps,
  resultHoldsNothing,
  WIDGET_TYPES,
  type WidgetType,
  widgetChangesProblems,
  widgetResultProblems,
  widgetTypeOf,
} from "@askboard/contract";
import { elementShapeOf, widgetItemProblems } from "@askboard/contract/validate";
import { canonicalize } from "../canonical.ts";
import type { ContentProblem } from "./answers.ts";

type Json = Readonly<Record<string, unknown>>;
type Item = { readonly type: string; readonly id: string; readonly props: unknown };

/**
 * What an answer's widget fields hold once checked: the values that changed, the results, the
 * derived values, and the revision's widget items as sent, which the changes are computed against.
 */
export type WidgetContent = {
  readonly values: Json;
  readonly results: Json;
  readonly derived: Json;
  readonly sent: readonly Item[];
};

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const refused = (detail: string): ContentProblem => ({ refusal: "content", detail });

const isWidget = (item: unknown, types: readonly WidgetType[]): item is Item =>
  isRecord(item) && widgetTypeOf(item.type, types) !== undefined && typeof item.id === "string";

/** The widget items of a revision's props, by ID. */
const widgetsOf = (
  props: QuestionProps,
  types: readonly WidgetType[],
): ReadonlyMap<string, Item> => {
  const { items } = props as { readonly items?: readonly unknown[] };
  return new Map(
    (items ?? [])
      .filter((item): item is Item => isWidget(item, types))
      .map((item) => [item.id, item]),
  );
};

/** The registry's types as the refusals name them: `Tree, Gantt or Probe` (the nouns, less `a`). */
export const namesOf = (types: readonly WidgetType[]): string => {
  const names = types.map(({ noun }) => noun.replace(/^an? /, ""));
  const last = names.pop();
  return names.length === 0 ? (last ?? "widget") : `${names.join(", ")} or ${last}`;
};

// Where in a result a problem lies, for the refusal's text.
const at = (path: string): string => (path === "/" || path === "" ? "" : ` (at ${path})`);

/**
 * Why `value` is no JSON value of at most `JSON_MAX_DEPTH` levels, if it is not: nested deeper
 * (`nested`, which a value that holds itself is too) or holding a value JSON has no form for. An
 * explicit stack walks it, so that a value nested a million deep is refused and never throws
 * (AD-10, NFR-10).
 */
const jsonFault = (value: unknown): "nested" | "not-json" | undefined => {
  const stack: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const { value: at, depth } = next;
    if (at === null || typeof at === "string" || typeof at === "boolean") continue;
    if (typeof at === "number") {
      if (Number.isFinite(at)) continue;
      return "not-json";
    }
    if (depth >= JSON_MAX_DEPTH) return "nested";
    const children = Array.isArray(at) ? at : isRecord(at) ? Object.values(at) : undefined;
    if (children === undefined) return "not-json";
    for (const child of children) stack.push({ value: child, depth: depth + 1 });
  }
  return undefined;
};

// The refusal of a value that is no bounded JSON, naming `what`, or none.
const jsonRefusal = (value: unknown, what: string): ContentProblem | undefined => {
  const fault = jsonFault(value);
  if (fault === undefined) return undefined;
  return refused(
    fault === "nested"
      ? `${what} is nested deeper than ${JSON_MAX_DEPTH} levels`
      : `${what} is not JSON`,
  );
};

/** The question's props with each edited value in place of the item's props. */
const editedProps = (
  props: QuestionProps,
  values: Json,
  types: readonly WidgetType[],
): { readonly props: unknown } => {
  const { items } = props as { readonly items?: readonly unknown[] };
  return {
    props: {
      ...props,
      items: (items ?? []).map((item) =>
        isWidget(item, types) && Object.hasOwn(values, item.id)
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
  types: readonly WidgetType[],
): ContentProblem | undefined => {
  for (const id of Object.keys(values)) {
    if (!widgets.has(id)) {
      return refused(`values name "${id}", which is no ${namesOf(types)} item of the question`);
    }
  }
  const question = editedProps(props, values, types);
  for (const [id, item] of widgets) {
    if (!Object.hasOwn(values, id)) continue;
    const [first] = widgetItemProblems({ ...item, props: values[id] }, question, "edited", types);
    if (first !== undefined) return refused(`the value of item "${id}": ${first.message}`);
  }
  return undefined;
};

const sameAs = (item: Item, edited: unknown): boolean =>
  canonicalize(item.props) === canonicalize(edited);

// Why the key's address below its item is no field the item's type declares, when it is not.
const addressProblem = (
  item: Item,
  rest: readonly string[],
  props: unknown,
  types: readonly WidgetType[],
): string | undefined => {
  const entry = widgetTypeOf(item.type, types);
  return entry?.derived === undefined
    ? `${entry?.noun ?? `the type "${item.type}"`} declares no derived values`
    : entry.derived.problem(rest, props);
};

// Step 4: the results, each through its type (schema, then checks) against the item as edited, else
// as sent. A key is an own key naming an item of the question, found in a `Map` so that no
// inherited name matches; a type that declares no result takes none.
const resultsProblem = (
  results: Json,
  widgets: ReadonlyMap<string, Item>,
  values: Json,
  types: readonly WidgetType[],
): ContentProblem | undefined => {
  for (const [id, result] of Object.entries(results)) {
    const item = widgets.get(id);
    if (item === undefined) {
      return refused(`results name "${id}", which is no ${namesOf(types)} item of the question`);
    }
    const unfit = jsonRefusal(result, `the result of item "${id}"`);
    if (unfit !== undefined) return unfit;
    // A result that holds nothing is no answer, whatever the type's schema takes (NFR-10, AD-10).
    if (resultHoldsNothing(result)) return refused(`the result of item "${id}" holds nothing`);
    const edited = Object.hasOwn(values, id) ? values[id] : item.props;
    const [first] = widgetResultProblems(item, result, edited, types);
    if (first !== undefined) return refused(`${first.message}${at(first.path)}`);
  }
  return undefined;
};

// Step 3: the changes of an edited value, computed once, then applied to the item as sent, must
// give the value back; one that they do not rebuild, such as an edit of a Tree's columns, would
// reach the agent as changes that miss part of what the board sent. A type with no element shape
// gives no changes, `[]`, never `undefined`. A throw of the diff (a fields shape's key it does not
// name) is a refusal naming the item and the key.
const roundTripProblem = (
  item: Item,
  edited: unknown,
  types: readonly WidgetType[],
): ContentProblem | undefined => {
  const shape = elementShapeOf(item, types);
  if (shape === undefined || !isRecord(item.props) || !isRecord(edited)) {
    return changesProblem(item, [], types);
  }
  let changes: readonly Change[];
  let rebuilt: unknown;
  try {
    changes = elementChanges(item.id, item.props, edited, shape);
    rebuilt = applyElementChanges(item.id, item.props, changes, shape);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return refused(`the value of item "${item.id}" is not described by its changes: ${why}`);
  }
  return canonicalize(rebuilt) === canonicalize(edited)
    ? changesProblem(item, changes, types)
    : refused(
        `the value of item "${item.id}" changes more than elements, which its changes cannot describe`,
      );
};

// The changes against the changes schema of the item's type, for every type (design decision 6):
// the first problem refuses the answer, naming the item and the operation.
const changesProblem = (
  item: Item,
  changes: readonly Change[],
  types: readonly WidgetType[],
): ContentProblem | undefined => {
  const [first] = widgetChangesProblems(item, changes, types);
  return first === undefined ? undefined : refused(first.message);
};

// Step 5.
const derivedProblem = (
  derived: Json,
  widgets: ReadonlyMap<string, Item>,
  values: Json,
  types: readonly WidgetType[],
): ContentProblem | undefined => {
  for (const [key, value] of Object.entries(derived)) {
    const [id = "", ...rest] = key.split(".");
    const item = widgets.get(id);
    if (item === undefined) {
      return refused(`the derived key "${key}" names no ${namesOf(types)} item of the question`);
    }
    const props = Object.hasOwn(values, id) ? values[id] : item.props;
    const why = addressProblem(item, rest, props, types);
    if (why !== undefined)
      return refused(`the derived key "${key}" is no field its widget declares: ${why}`);
    const unfit = jsonRefusal(value, `the derived value of "${key}"`);
    if (unfit !== undefined) return unfit;
  }
  return undefined;
};

/**
 * The widget content of an answer act for the revision `props`, or why it is refused. An act
 * with none of the fields has none; unchanged values are left out of the result. Each widget type
 * is found in `types`, the shipped registry unless a test passes another.
 */
export const widgetContentOf = (
  act: Json,
  props: QuestionProps,
  types: readonly WidgetType[] = WIDGET_TYPES,
): WidgetContent | ContentProblem => {
  const { values = {}, derived = {}, results = {} } = act;
  if (!isRecord(values)) return refused("the values are not an object of edited values by item ID");
  if (!isRecord(results)) return refused("the results are not an object of results by item ID");
  if (!isRecord(derived)) return refused("the derived values are not an object by address");
  const widgets = widgetsOf(props, types);
  const bad =
    valuesProblem(values, widgets, props, types) ??
    resultsProblem(results, widgets, values, types) ??
    derivedProblem(derived, widgets, values, types);
  if (bad !== undefined) return bad;
  const changed = Object.entries(values).filter(([id, edited]) => {
    const item = widgets.get(id);
    return item !== undefined && !sameAs(item, edited);
  });
  for (const [id, edited] of changed) {
    const unsound = roundTripProblem(widgets.get(id) as Item, edited, types);
    if (unsound !== undefined) return unsound;
  }
  return {
    values: Object.fromEntries(changed),
    results: Object.fromEntries(Object.entries(results)),
    derived,
    sent: [...widgets.values()],
  };
};

export const isWidgetProblem = (
  content: WidgetContent | ContentProblem,
): content is ContentProblem => "refusal" in content;
