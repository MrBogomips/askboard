// The other widget items of the Approval's question, as its summary reads them (design decisions 7
// and 8): each with its props as sent and the value it shows, the Approval itself and the items of
// other questions left out. Which of them give a shape, and so can be diffed, is for the summary:
// it skips an item whose type gives none, an Approval, a Scale or a Ranking among them. Pure.

import type { BoardContent } from "@askboard/view/catalog";
import type { SummaryItem } from "./summary.ts";

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/**
 * The widget items of question `questionId` other than `selfId`, in the question's order. A board
 * that does not say which items a question holds gives none, and so does an unknown question.
 */
export const summaryItemsOf = (
  board: BoardContent,
  questionId: string,
  selfId: string,
): readonly SummaryItem[] => {
  const ids = board.questionItems?.get(questionId) ?? [];
  const byId = new Map(board.items.map((item) => [item.id, item]));
  return ids.flatMap((id): SummaryItem[] => {
    const item = byId.get(id);
    if (id === selfId || item === undefined || !isObject(item.props)) return [];
    const shown = board.shown.get(id);
    return [
      {
        id,
        type: item.type,
        sent: item.props,
        shown: isObject(shown) && !Array.isArray(shown) ? shown : item.props,
      },
    ];
  });
};
