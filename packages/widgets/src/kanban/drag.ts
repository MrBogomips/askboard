// A card's drag and drop on Pragmatic drag and drop (design decision 9), as the Ranking's (`ranking/
// drag.ts`): the card is the draggable and a column a drop target; native drag works in the view's
// sandboxed frame in Chromium and WebKit. The card's data names the Kanban and the card, so that a
// column takes only its own Kanban's cards: a drop from a Tree, a Ranking or another Kanban is not
// taken. Escape cancels the browser's drag, which gives `end` and no `drop`. The library comes
// from the `dnd` chunk, which the build provides to every chunk that imports it.

import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { type RefObject, useEffect } from "react";

/** What a Kanban's drag tells the Kanban. */
export type CardDragEvents = {
  start(cardId: string): void;
  /** The dragged card is over `columnId`. */
  over(cardId: string, columnId: string): void;
  /** The pointer left `columnId`. */
  leave(columnId: string): void;
  /** The card was dropped on `columnId`. */
  drop(cardId: string, columnId: string): void;
  /** The drag ended, dropped or cancelled. */
  end(): void;
};

/** What a card's drag data holds: the Kanban it belongs to, and the card. */
type CardData = { readonly kanbanId: string; readonly cardId: string };

const isCardData = (data: Record<string | symbol, unknown>): data is CardData =>
  typeof data.kanbanId === "string" && typeof data.cardId === "string";

/**
 * Makes `card` draggable, while `enabled`, as the card `cardId` of the Kanban `kanbanId`. The
 * events are read from a ref, so that the effect that registers the card never re-runs for a new
 * closure.
 */
export const useCardDrag = ({
  card,
  kanbanId,
  cardId,
  enabled,
  events,
}: {
  readonly card: RefObject<HTMLElement | null>;
  readonly kanbanId: string;
  readonly cardId: string;
  readonly enabled: boolean;
  readonly events: RefObject<CardDragEvents>;
}): void => {
  useEffect(() => {
    const element = card.current;
    if (!enabled || element === null) return undefined;
    return draggable({
      element,
      getInitialData: (): CardData => ({ kanbanId, cardId }),
      onDragStart: () => events.current.start(cardId),
      onDrop: () => events.current.end(),
    });
  }, [card, kanbanId, cardId, enabled, events]);
};

/** Makes `column` a drop target for its own Kanban's cards, while `enabled`. */
export const useColumnDrop = ({
  column,
  kanbanId,
  columnId,
  enabled,
  events,
}: {
  readonly column: RefObject<HTMLElement | null>;
  readonly kanbanId: string;
  readonly columnId: string;
  readonly enabled: boolean;
  readonly events: RefObject<CardDragEvents>;
}): void => {
  useEffect(() => {
    const element = column.current;
    if (!enabled || element === null) return undefined;
    const from = (source: { data: Record<string | symbol, unknown> }): CardData | undefined =>
      isCardData(source.data) && source.data.kanbanId === kanbanId ? source.data : undefined;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => from(source) !== undefined,
      onDragEnter: ({ source }) => {
        const dragged = from(source);
        if (dragged !== undefined) events.current.over(dragged.cardId, columnId);
      },
      onDrag: ({ source }) => {
        const dragged = from(source);
        if (dragged !== undefined) events.current.over(dragged.cardId, columnId);
      },
      onDragLeave: () => events.current.leave(columnId),
      onDrop: ({ source }) => {
        const dragged = from(source);
        if (dragged !== undefined) events.current.drop(dragged.cardId, columnId);
      },
    });
  }, [column, kanbanId, columnId, enabled, events]);
};
