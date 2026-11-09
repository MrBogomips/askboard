// One card of the Kanban (view-and-widgets spec: Kanban columns and cards; DESIGN.md: Kanban): its
// label and its description. The card is draggable while the Kanban can change, and is one option
// of the board, the current one (or the first, while none is) holding the board's Tab stop, giving
// its place in its column and the column's size (kanban-order). A moved card takes the change
// highlight. The label and description are the agent's content, shown as
// text (AD-8).

import type { KanbanCard as Card } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { type RefObject, useId, useRef } from "react";
import {
  CARD,
  CARD_DESCRIPTION,
  CARD_DRAGGED,
  CARD_GRAB,
  CARD_LABEL,
  CARD_MOVED,
} from "./classes.ts";
import { type CardDragEvents, useCardDrag } from "./drag.ts";
import { cardName } from "./text.ts";

export const KanbanCard = ({
  kanbanId,
  card,
  columnLabel,
  position,
  size,
  current,
  stop,
  moved,
  dragged,
  editable,
  events,
  cardRef,
  onFocus,
}: {
  readonly kanbanId: string;
  readonly card: Card;
  /** The label of the column the card is in, for its name. */
  readonly columnLabel: string;
  /** Its place in its column, from 1, and the column's number of cards, for assistive technology. */
  readonly position: number;
  readonly size: number;
  /** The user made it the current card. */
  readonly current: boolean;
  /** It holds the board's Tab stop. */
  readonly stop: boolean;
  /** Not in the column the agent put it in. */
  readonly moved: boolean;
  /** Being dragged. */
  readonly dragged: boolean;
  /** The Kanban can change: the card drags. */
  readonly editable: boolean;
  readonly events: RefObject<CardDragEvents>;
  /** Hands the card's element to the board, for its focus. */
  readonly cardRef: (node: HTMLDivElement | null) => void;
  /** The card took the focus or a press: it is the current one. */
  readonly onFocus: () => void;
}) => {
  const text = useStrings();
  const element = useRef<HTMLDivElement | null>(null);
  const description = useId();
  useCardDrag({ card: element, kanbanId, cardId: card.id, enabled: editable, events });
  const classes = [
    CARD,
    editable ? CARD_GRAB : "",
    moved ? CARD_MOVED : "",
    dragged ? CARD_DRAGGED : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      ref={(node) => {
        element.current = node;
        cardRef(node);
      }}
      role="option"
      aria-label={cardName(card.label, columnLabel, text)}
      aria-posinset={position}
      aria-setsize={size}
      aria-describedby={card.description === undefined ? undefined : description}
      aria-selected={current}
      aria-current={current ? "true" : undefined}
      tabIndex={stop ? 0 : -1}
      data-kanban-card={card.id}
      data-change={moved ? "moved" : undefined}
      data-dragging={dragged ? "" : undefined}
      className={classes}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <span className={CARD_LABEL}>{card.label}</span>
      {card.description === undefined ? null : (
        <span id={description} className={CARD_DESCRIPTION}>
          {card.description}
        </span>
      )}
    </div>
  );
};
