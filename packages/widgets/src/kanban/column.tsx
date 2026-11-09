// One column of the Kanban (view-and-widgets spec: Kanban columns and cards, Kanban moves by drag;
// DESIGN.md: Kanban): its label and count of cards, and its cards. The column is a drop target for
// its own Kanban's cards while the Kanban can change, and shows the drop indicator while a card of
// another column is over it. Its label is the agent's content, shown as text (AD-8).

import { useStrings } from "@askboard/view/catalog";
import type { ReactNode } from "react";
import { type RefObject, useRef } from "react";
import {
  COLUMN,
  COLUMN_COUNT,
  COLUMN_HEAD,
  COLUMN_INTO,
  COLUMN_NAME,
  COLUMN_TOP_LINE,
} from "./classes.ts";
import type { CardDragEvents } from "./drag.ts";
import { useColumnDrop } from "./drag.ts";
import type { KanbanColumnView } from "./model.ts";
import { columnName } from "./text.ts";

export const Column = ({
  kanbanId,
  column,
  indicator,
  topLine,
  editable,
  events,
  children,
}: {
  readonly kanbanId: string;
  readonly column: KanbanColumnView;
  /** The drop indicator, while a card of another column is over it. */
  readonly indicator: "into" | undefined;
  /** The drop line at the top of the column, while it holds no other card and a card is over it. */
  readonly topLine: boolean;
  readonly editable: boolean;
  readonly events: RefObject<CardDragEvents>;
  readonly children: ReactNode;
}) => {
  const text = useStrings();
  const element = useRef<HTMLFieldSetElement | null>(null);
  useColumnDrop({ column: element, kanbanId, columnId: column.id, enabled: editable, events });
  return (
    <fieldset
      ref={element}
      aria-label={columnName(column.label, column.cards.length, text)}
      data-kanban-column={column.id}
      data-drop={indicator}
      className={indicator === undefined ? COLUMN : `${COLUMN} ${COLUMN_INTO}`}
    >
      <div aria-hidden="true" className={COLUMN_HEAD}>
        <span className={COLUMN_NAME}>{column.label}</span>
        <span data-kanban-count="" className={COLUMN_COUNT}>
          {column.cards.length}
        </span>
      </div>
      {topLine ? <div aria-hidden="true" data-drop-line="top" className={COLUMN_TOP_LINE} /> : null}
      {children}
    </fieldset>
  );
};
