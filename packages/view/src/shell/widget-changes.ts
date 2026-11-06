// The agent's change to the widget items of a question (widget-answers, design decision 8): per
// widget item that both revisions hold and whose props differ, the item's ID and type and the
// number of element operations the contract's generic diff gives between the two revisions. An
// item the agent added or removed has no earlier or later props to diff and is not listed.

import { elementChanges } from "@askboard/contract";
import { componentFacts } from "../catalog/port.ts";
import type { ViewQuestionProps, WidgetItem } from "../view-document.ts";

/** One changed widget item: its ID, its type as sent, and its element operations. */
export type WidgetChange = {
  readonly itemId: string;
  readonly type: string;
  readonly operations: number;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The item's changes, by the shape its type's chunk registered with its component (widget-registry,
// design decision 8): a type whose chunk gave none is not listed, as an added item is not.
const changeOf = (before: WidgetItem, after: WidgetItem): WidgetChange | undefined => {
  if (!isRecord(before.props) || !isRecord(after.props)) return undefined;
  const shape = componentFacts(after.type)?.shape?.(after.props);
  if (shape === undefined) return undefined;
  const operations = elementChanges(after.id, before.props, after.props, shape).length;
  return operations === 0 ? undefined : { itemId: after.id, type: after.type, operations };
};

/** The widget items the agent changed, in the new revision's order. */
export const widgetChanges = (
  before: ViewQuestionProps | undefined,
  after: ViewQuestionProps,
): readonly WidgetChange[] =>
  (after.items ?? []).flatMap((item) => {
    const earlier = before?.items?.find((each) => each.id === item.id && each.type === item.type);
    const change = earlier === undefined ? undefined : changeOf(earlier, item);
    return change === undefined ? [] : [change];
  });
