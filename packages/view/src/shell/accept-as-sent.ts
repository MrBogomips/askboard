// When "Accept as is" is offered (accept-as-sent, design decision 1; EXPERIENCE.md, Question card):
// pure. The button answers a question with no options with its content as the agent sent it, so it
// is offered only where there is content to accept and nothing the user changed or resulted.

import { elementChanges } from "@askboard/contract";
import { componentFacts } from "../catalog/port.ts";
import { valueItemsOf } from "../nested-items.ts";
import type { ViewQuestion, WidgetItem } from "../view-document.ts";
import type { DraftRecord } from "./draft-store.ts";

export type AcceptInputs = {
  /** The question as the card shows it (`shownOf`). */
  readonly question: ViewQuestion;
  /** The draft values, by item ID: an item that differs from the agent's content holds one. */
  readonly values: DraftRecord;
  /** The results the widget items hold, by item ID. */
  readonly results: DraftRecord | undefined;
  /** The question is to do or in draft: not answered, ready or declined. */
  readonly open: boolean;
  /** The board is locked. */
  readonly locked: boolean;
  /** The board is an opened Snapshot. */
  readonly opened: boolean;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Whether the held value gives no element change against the item as sent. A value the diff cannot
// read counts as a change: the content is then not what the agent sent (NFR-10).
const unchanged = (item: WidgetItem, held: unknown): boolean => {
  if (held === undefined) return true;
  if (!isRecord(held) || !isRecord(item.props)) return false;
  try {
    const shape = componentFacts(item.type)?.shape?.(item.props);
    return shape !== undefined && elementChanges(item.id, item.props, held, shape).length === 0;
  } catch {
    return false;
  }
};

/**
 * Whether the card offers "Accept as is": the question has no options and holds at least one item
 * whose type registered an element shape (the type's widget edits content), is to do or in draft,
 * the board is not locked and no Snapshot, no item holds a result, and every value the draft holds
 * for its items gives no change against what the revision sent. A type whose chunk has not
 * registered its facts gives no shape, so the button waits for it (fail closed).
 */
export const acceptAsSentOffered = ({
  question,
  values,
  results,
  open,
  locked,
  opened,
}: AcceptInputs): boolean => {
  if (!open || locked || opened) return false;
  if ((question.props.options ?? []).length > 0) return false;
  const items = valueItemsOf(question.props.items);
  if (!items.some((item) => componentFacts(item.type)?.shape !== undefined)) return false;
  if (items.some((item) => results?.get(item.id) !== undefined)) return false;
  return items.every((item) => unchanged(item, values.get(item.id)));
};
