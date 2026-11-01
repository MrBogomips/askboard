// The board as a component reads it through the port (AD-9; gantt-widget design decisions 7 and
// 10): every widget item the board document holds, as the agent sent it, and the draft record. The
// items are listed once per board document; the board object is made once per draft record, so a
// component that builds from it, such as the Gantt's compute graph, can memoize on its identity.

import type { BoardContent, BoardWidgetItem } from "../catalog/port.ts";
import type { ViewDocument } from "../view-document.ts";
import type { DraftRecord } from "./draft-store.ts";

/** The board's widget items as sent: each question's items, in the document's order, frozen. */
export const boardItemsOf = (document: ViewDocument): readonly BoardWidgetItem[] =>
  Object.freeze(document.items.flatMap((question) => question.props.items ?? []));

/** The board for a draft record, over the board's items: one frozen object per record. */
export const createBoardContent = (
  items: readonly BoardWidgetItem[],
): ((draft: DraftRecord) => BoardContent) => {
  const byRecord = new WeakMap<DraftRecord, BoardContent>();
  return (draft) => {
    const known = byRecord.get(draft);
    if (known !== undefined) return known;
    const board: BoardContent = Object.freeze({ items, draft });
    byRecord.set(draft, board);
    return board;
  };
};
