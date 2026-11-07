// The Kanban's frame (view-and-widgets spec: Kanban columns and cards, Kanban moves by drag, Kanban
// at the keyboard, LaTeX, Kanban and Timeline read-only; design decision 9): a toolbar row and the
// columns side by side. The props shown are the draft's, else the agent's. The cards are one Tab
// stop whose arrow keys move the current card; the toolbar, "Move to…" and the counter, is another.
// A move by the menu or a drop reports the whole edited props and keeps the moved card current;
// the drag, the current card and the drop indicator are the component's own state and never go in
// the draft. Nothing here holds the props: it reads them and reports the next (AD-9).

import type { KanbanProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { useMemo, useRef, useState } from "react";
import { FRAME } from "../shared/move-classes.ts";
import { MoveToolbar } from "../shared/move-toolbar.tsx";
import { KanbanCard } from "./card.tsx";
import { COLUMNS } from "./classes.ts";
import { Column } from "./column.tsx";
import type { CardDragEvents } from "./drag.ts";
import { afterDrop, type DragState, indicatorOf } from "./drop.ts";
import { kanbanKeyOf, kanbanTools, otherColumns } from "./keys.ts";
import { columnsOf, firstCard, movedOf, neighbour } from "./model.ts";
import { counterText } from "./text.ts";

export const KanbanWidget = ({
  kanbanId,
  sent,
  shown,
  labelledBy,
  disabled,
  onChange,
}: {
  readonly kanbanId: string;
  /** The agent's props, checked. */
  readonly sent: KanbanProps;
  /** The props to show: the draft's, else the agent's. */
  readonly shown: KanbanProps;
  /** The ID of the question's text, which names the board. */
  readonly labelledBy: string;
  /** The question is answered, being sent or locked: the Kanban changes nothing. */
  readonly disabled: boolean;
  /** The user's next props. */
  readonly onChange: (next: KanbanProps) => void;
}) => {
  const text = useStrings();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [drag, setDrag] = useState<DragState | undefined>(undefined);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const events = useRef<CardDragEvents>({
    start() {},
    over() {},
    leave() {},
    drop() {},
    end() {},
  });
  const columns = useMemo(() => columnsOf(shown), [shown]);
  const held = columns.some((column) => column.cards.some(({ id }) => id === chosen));
  const current = held ? chosen : undefined;
  const stop = current ?? firstCard(columns);
  const moved = new Set(movedOf(sent, shown));
  const tools = kanbanTools(current, disabled, columns);
  const draggedColumn = shown.cards.find(({ id }) => id === drag?.dragging)?.column;

  // The drag reports through a ref the cards' and columns' effects hold, so that they never
  // re-register for a new closure; it is set on every render, with the props of this one.
  events.current = {
    start: (id) => setDrag({ dragging: id }),
    over: (id, columnId) =>
      setDrag((state) =>
        state?.over === columnId && state.dragging === id
          ? state
          : { dragging: id, over: columnId },
      ),
    leave: (columnId) =>
      setDrag((state) => (state?.over === columnId ? { dragging: state.dragging } : state)),
    drop: (id, columnId) => {
      const next = afterDrop(shown, id, columnId);
      if (next !== undefined) onChange(next);
      setChosen(id);
      setDrag(undefined);
    },
    end: () => setDrag(undefined),
  };

  const onMoveTo = (columnId: string): void => {
    if (current === undefined) return;
    const next = afterDrop(shown, current, columnId);
    if (next !== undefined) onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const key = kanbanKeyOf(event.key);
    const from = current ?? stop;
    if (key === undefined || from === undefined) return;
    const next = neighbour(columns, from, key);
    if (next === undefined) return;
    event.preventDefault();
    setChosen(next);
    cards.current.get(next)?.focus();
  };

  return (
    <div className={FRAME} data-kanban="">
      <MoveToolbar
        widget="kanban"
        name={text("kanban.tools")}
        tools={[
          {
            key: "moveTo",
            label: text("kanban.moveTo"),
            enabled: tools.moveTo,
            menu: { options: otherColumns(columns, current), onChoose: onMoveTo },
          },
        ]}
        counter={counterText(moved.size, text)}
        changed={moved.size > 0}
      />
      <div
        role="listbox"
        aria-labelledby={labelledBy}
        aria-orientation="horizontal"
        className={COLUMNS}
        onKeyDown={onKeyDown}
      >
        {columns.map((column) => (
          <Column
            key={column.id}
            kanbanId={kanbanId}
            column={column}
            indicator={indicatorOf(drag, column.id, draggedColumn)}
            editable={!disabled}
            events={events}
          >
            {column.cards.map((card) => (
              <KanbanCard
                key={card.id}
                kanbanId={kanbanId}
                card={card}
                columnLabel={column.label}
                current={card.id === current}
                stop={card.id === stop}
                moved={moved.has(card.id)}
                dragged={drag?.dragging === card.id}
                editable={!disabled}
                events={events}
                cardRef={(node) => {
                  if (node === null) cards.current.delete(card.id);
                  else cards.current.set(card.id, node);
                }}
                onFocus={() => setChosen(card.id)}
              />
            ))}
          </Column>
        ))}
      </div>
    </div>
  );
};
