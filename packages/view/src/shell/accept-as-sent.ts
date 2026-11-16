// When "Accept as is" is offered (accept-as-sent, design decisions 1 and 11; EXPERIENCE.md, Question
// card): pure. The button answers a question with no options with its content as the agent sent it,
// so it is offered only where there is content to accept, on the revision the agent last sent, and
// nothing the user changed; the results of input fields (the registry's `fieldCheck`) travel with it.

import { elementChanges } from "@askboard/contract";
import { type ComponentFacts, componentFacts } from "../catalog/port.ts";
import { valueItemsOf } from "../nested-items.ts";
import type { ViewQuestion, WidgetItem } from "../view-document.ts";
import type { DraftRecord } from "./draft-store.ts";

export type AcceptInputs = {
  /** The question as the card shows it (`shownOf`). */
  readonly question: ViewQuestion;
  /** The revision the board holds: the agent's latest. */
  readonly currentRev: number;
  /** The revision the work names (`revisionFor`), which an answer would name. */
  readonly namedRev: number;
  /** The items the card makes read-only (`readOnlyItemsOf`): on a kept revision, after a reload. */
  readonly readOnlyItems: ReadonlySet<string>;
  /** The draft values, by item ID: an item that differs from the agent's content holds one. */
  readonly values: DraftRecord;
  /** The results the widget items hold, by item ID: an input field's travels, any other's hides the button. */
  readonly results: DraftRecord | undefined;
  /** The question is to do or in draft: not answered, ready or declined. */
  readonly open: boolean;
  /** The board is locked. */
  readonly locked: boolean;
  /** The board is an opened Snapshot. */
  readonly opened: boolean;
  /** The facts the chunks registered for a type; the registry's when none (a test gives its own). */
  readonly factsOf?: ((type: string) => ComponentFacts | undefined) | undefined;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Whether the held value gives no element change against the item as sent. A value the diff cannot
// read counts as a change: the content is then not what the agent sent (NFR-10).
const unchanged = (
  item: WidgetItem,
  held: unknown,
  factsOf: (type: string) => ComponentFacts | undefined,
): boolean => {
  if (held === undefined) return true;
  if (!isRecord(held) || !isRecord(item.props)) return false;
  try {
    const shape = factsOf(item.type)?.shape?.(item.props);
    return shape !== undefined && elementChanges(item.id, item.props, held, shape).length === 0;
  } catch {
    return false;
  }
};

/**
 * Whether the acceptance is on the content the agent last sent (design decision 11, D-B): the card
 * shows the current revision, the work names it, and no item is read-only. After "Keep mine" the
 * card shows an older revision, or the current one with items read-only; an acceptance there
 * would claim content the user did not see.
 */
export const onCurrentRevision = ({
  shown,
  currentRev,
  namedRev,
  readOnlyItems,
}: {
  readonly shown: ViewQuestion;
  readonly currentRev: number;
  readonly namedRev: number;
  readonly readOnlyItems: ReadonlySet<string>;
}): boolean => shown.rev === currentRev && shown.rev === namedRev && readOnlyItems.size === 0;

/**
 * Whether every result held belongs to an input field, an item whose chunk registered `inputField`
 * (the registry's `fieldCheck`; the Document review's own `check` does not count)
 * (design decision 11, D-A). An Approval's verdict or a Ranking's order beside "accepted as is"
 * would contradict it; a type whose chunk registered nothing is no input field (fail closed).
 */
export const holdsInputResultsOnly = (
  items: readonly WidgetItem[],
  heldFor: (itemId: string) => boolean,
  factsOf: (type: string) => ComponentFacts | undefined = componentFacts,
): boolean => items.every((item) => !heldFor(item.id) || factsOf(item.type)?.inputField === true);

/**
 * Whether the card offers "Accept as is": the question has no options and holds at least one item
 * whose type registered an element shape (the type's widget edits content), is to do or in draft,
 * the board is not locked and no Snapshot, the card shows the current revision the work names with
 * no item read-only, every result held is an input field's, and every value the draft holds for
 * its items gives no change against what the revision sent. A type whose chunk has not registered
 * its facts gives no shape, so the button waits for it (fail closed).
 */
export const acceptAsSentOffered = ({
  question,
  currentRev,
  namedRev,
  readOnlyItems,
  values,
  results,
  open,
  locked,
  opened,
  factsOf = componentFacts,
}: AcceptInputs): boolean => {
  if (!open || locked || opened) return false;
  if (!onCurrentRevision({ shown: question, currentRev, namedRev, readOnlyItems })) return false;
  if ((question.props.options ?? []).length > 0) return false;
  const items = valueItemsOf(question.props.items);
  if (!items.some((item) => factsOf(item.type)?.shape !== undefined)) return false;
  if (!holdsInputResultsOnly(items, (id) => results?.get(id) !== undefined, factsOf)) return false;
  return items.every((item) => unchanged(item, values.get(item.id), factsOf));
};
