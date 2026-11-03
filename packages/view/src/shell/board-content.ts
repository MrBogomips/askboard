// The board as a component reads it through the port (AD-9; gantt-widget design decisions 7 and
// 10): every widget item the board document holds, as the agent sent it, and the draft record. The
// items are those of every question, areas' included (ask-lifecycle, design decision 6), listed
// once per board document; the shell's document is the latest the agent sent, which an agent
// update replaces, so the board follows it. The board object is made once per items list and draft
// record, so a component that builds from it, such as the Gantt's compute graph, can memoize on
// its identity while neither the document nor the draft changes (cross-review H1).

import type { BoardContent, BoardWidgetItem } from "../catalog/port.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import type { DraftRecord } from "./draft-store.ts";

// Each board document's items list; a document is never changed in place, only replaced.
const ITEMS = new WeakMap<ViewDocument, readonly BoardWidgetItem[]>();

/**
 * The board's widget items as sent: each question's items, in board order, frozen; the same list
 * for the same document.
 */
export const boardItemsOf = (document: ViewDocument): readonly BoardWidgetItem[] => {
  const known = ITEMS.get(document);
  if (known !== undefined) return known;
  const items = Object.freeze(questionsOf(document).flatMap(({ props }) => props.items ?? []));
  ITEMS.set(document, items);
  return items;
};

/**
 * The board for a draft record, over the items of the document the shell holds now: one frozen
 * object per items list and record.
 */
export const createBoardContent = (
  documentOf: () => ViewDocument,
): ((draft: DraftRecord) => BoardContent) => {
  const boards = new WeakMap<readonly BoardWidgetItem[], WeakMap<DraftRecord, BoardContent>>();
  return (draft) => {
    const items = boardItemsOf(documentOf());
    const byRecord = boards.get(items) ?? new WeakMap<DraftRecord, BoardContent>();
    boards.set(items, byRecord);
    const known = byRecord.get(draft);
    if (known !== undefined) return known;
    const board: BoardContent = Object.freeze({ items, draft });
    byRecord.set(draft, board);
    return board;
  };
};
