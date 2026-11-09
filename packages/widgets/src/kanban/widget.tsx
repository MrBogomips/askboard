// The Kanban's frame (view-and-widgets spec: Kanban columns and cards, Kanban moves by drag, Kanban
// at the keyboard, LaTeX, Kanban and Timeline read-only; design decision 9): a toolbar row and the
// columns side by side. The props shown are the draft's, else the agent's. The cards are one Tab
// stop whose arrow keys make a card current and whose Alt+Shift and Ctrl or Cmd with Shift keys
// move it within its column; the toolbar, "Move up", "Move down", "To top", "To bottom", "Move
// to…" and the counter, is another. A move by a tool, a key, the menu or a drop reports the whole
// edited props and keeps the moved card current; the drag, the current card and the drop
// indicator are the component's own state and never go in the draft. Nothing here holds the
// props: it reads them and reports the next (AD-9, kanban-order design decisions 5 and 7).

import type { KanbanProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { useEffect, useMemo, useRef, useState } from "react";
import { FRAME } from "../shared/move-classes.ts";
import { MoveToolbar } from "../shared/move-toolbar.tsx";
import { KanbanCard } from "./card.tsx";
import { COLUMNS } from "./classes.ts";
import { Column } from "./column.tsx";
import type { CardDragEvents } from "./drag.ts";
import { afterDrop, type DragState, indicatorOf, lineOf } from "./drop.ts";
import { kanbanPressOf, kanbanTools, otherColumns } from "./keys.ts";
import {
  columnsOf,
  firstCard,
  type KanbanMove,
  movedOf,
  moveTo,
  moveWithin,
  neighbour,
} from "./model.ts";
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
  const moved = useMemo(() => new Set(movedOf(sent, shown)), [sent, shown]);
  const tools = kanbanTools(current, disabled, columns);
  const draggedColumn = shown.cards.find(({ id }) => id === drag?.dragging)?.column;

  // The drag reports through a ref the cards' and columns' effects hold, so that they never
  // re-register for a new closure; it is set on every render, with the props of this one.
  events.current = {
    start: (id) => setDrag({ dragging: id }),
    over: (id, columnId, slot) =>
      setDrag((state) =>
        state?.dragging === id && state.over?.column === columnId && state.over.slot === slot
          ? state
          : { dragging: id, over: { column: columnId, slot } },
      ),
    leave: (columnId) =>
      setDrag((state) => (state?.over?.column === columnId ? { dragging: state.dragging } : state)),
    drop: (id, columnId, slot) => {
      const next = afterDrop(shown, id, columnId, slot);
      if (next !== undefined) onChange(next);
      setChosen(id);
      setDrag(undefined);
    },
    end: () => setDrag(undefined),
  };

  const onMoveTo = (columnId: string): void => {
    if (current === undefined) return;
    const next = moveTo(shown, current, columnId);
    if (next !== shown) onChange(next);
  };

  // A card moved within its column can lose the focus when the browser moves its element: it takes
  // it back once the next props are drawn.
  const refocus = useRef<string | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the shown props change
  useEffect(() => {
    const id = refocus.current;
    refocus.current = undefined;
    if (id !== undefined && cards.current.get(id) !== document.activeElement) {
      cards.current.get(id)?.focus();
    }
  }, [shown]);

  const move = (id: string, how: KanbanMove, keepFocus: boolean): void => {
    const next = moveWithin(shown, id, how);
    if (next === shown) return;
    if (keepFocus) refocus.current = id;
    onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const press = kanbanPressOf({
      key: event.key,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      composing: event.nativeEvent.isComposing,
    });
    const from = current ?? stop;
    if (press === undefined || from === undefined) return;
    if (press.kind === "move") {
      // A bound press keeps the page from scrolling or navigating, where it cannot act too.
      event.preventDefault();
      if (!disabled) move(from, press.move, true);
      return;
    }
    const next = neighbour(columns, from, press.key);
    if (next === undefined) return;
    event.preventDefault();
    setChosen(next);
    cards.current.get(next)?.focus();
  };

  const tool = (key: keyof typeof tools, label: Parameters<typeof text>[0], how: KanbanMove) => ({
    key,
    label: text(label),
    enabled: tools[key],
    run: () => {
      if (current !== undefined) move(current, how, false);
    },
  });

  return (
    <div className={FRAME} data-kanban="">
      <MoveToolbar
        widget="kanban"
        name={text("kanban.tools")}
        tools={[
          tool("up", "kanban.moveUp", "up"),
          tool("down", "kanban.moveDown", "down"),
          tool("top", "kanban.toTop", "top"),
          tool("bottom", "kanban.toBottom", "bottom"),
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
        {columns.map((column) => {
          const line = lineOf(
            drag,
            column.id,
            column.cards.map(({ id }) => id),
          );
          return (
            <Column
              key={column.id}
              kanbanId={kanbanId}
              column={column}
              indicator={indicatorOf(drag, column.id, draggedColumn)}
              topLine={line !== undefined && "top" in line}
              editable={!disabled}
              events={events}
            >
              {column.cards.map((card, at) => (
                <KanbanCard
                  key={card.id}
                  kanbanId={kanbanId}
                  card={card}
                  columnLabel={column.label}
                  position={at + 1}
                  size={column.cards.length}
                  current={card.id === current}
                  stop={card.id === stop}
                  moved={moved.has(card.id)}
                  dragged={drag?.dragging === card.id}
                  line={
                    line !== undefined && "card" in line && line.card === card.id
                      ? line.side
                      : undefined
                  }
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
          );
        })}
      </div>
    </div>
  );
};
