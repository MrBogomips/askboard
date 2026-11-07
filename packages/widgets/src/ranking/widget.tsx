// The Ranking's frame (view-and-widgets spec: Ranking reorder, Ranking at the keyboard, Result
// widgets read-only; design decision 8): a toolbar row and the list of rows. The order is the held
// result's, else the agent's. The list is one Tab stop whose arrow keys move the current row; the
// toolbar, "Move up", "Move down" and "Keep this order", is another. A move by the tools or a drop
// puts the whole order and keeps the moved row current; the drag, the current row and the drop
// indicator are the component's own state and never go in the draft. Nothing here holds the order:
// it reads it from the result and reports the next one (AD-9).

import type { RankingProps } from "@askboard/contract";
import { useRef, useState } from "react";
import { FRAME, LIST } from "./classes.ts";
import type { RowDragEvents } from "./drag.ts";
import { afterDrop, type DragState, indicatorOf } from "./drop.ts";
import { currentAfterKey, rankingTools } from "./keys.ts";
import { moveBy, movedOf } from "./model.ts";
import { RankingRow } from "./row.tsx";
import { RankingToolbar } from "./toolbar.tsx";

export const RankingWidget = ({
  rankingId,
  props,
  order,
  held,
  labelledBy,
  disabled,
  onOrder,
}: {
  readonly rankingId: string;
  /** The agent's props, checked. */
  readonly props: RankingProps;
  /** The order to show. */
  readonly order: readonly string[];
  /** The Ranking holds an order: the user gave one, for the counter. */
  readonly held: boolean;
  /** The ID of the question's text, which names the list. */
  readonly labelledBy: string;
  /** The question is answered, being sent or locked: the Ranking changes nothing. */
  readonly disabled: boolean;
  /** The user's next order. */
  readonly onOrder: (order: readonly string[]) => void;
}) => {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [drag, setDrag] = useState<DragState | undefined>(undefined);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const events = useRef<RowDragEvents>({
    start() {},
    over() {},
    leave() {},
    drop() {},
    end() {},
  });
  const current = chosen !== undefined && order.includes(chosen) ? chosen : (order[0] ?? "");
  const moved = new Set(movedOf(order, props));
  const byId = new Map(props.items.map((element) => [element.id, element]));
  const tools = rankingTools(order, current, disabled);

  // The drag reports through a ref the rows' effects hold, so that they never re-register for a
  // new closure; it is set on every render, with the order of this one.
  events.current = {
    start: (id) => setDrag({ dragging: id }),
    over: (id, targetId, fraction) =>
      setDrag((state) =>
        state?.over?.targetId === targetId && state.over.fraction === fraction
          ? state
          : { dragging: id, over: { targetId, fraction } },
      ),
    leave: (targetId) =>
      setDrag((state) =>
        state?.over?.targetId === targetId ? { dragging: state.dragging } : state,
      ),
    drop: (id, targetId, fraction) => {
      const next = afterDrop(order, id, targetId, fraction);
      if (next !== undefined) onOrder(next);
      setChosen(id);
      setDrag(undefined);
    },
    end: () => setDrag(undefined),
  };

  const onMove = (delta: -1 | 1): void => {
    const next = moveBy(order, current, delta);
    if (next !== order) onOrder(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const next = currentAfterKey(order, current, event.key);
    if (next === undefined) return;
    event.preventDefault();
    setChosen(next);
    rows.current.get(next)?.focus();
  };

  return (
    <div className={FRAME} data-ranking="">
      <RankingToolbar
        tools={tools}
        held={held}
        moved={moved.size}
        onMove={onMove}
        onKeep={() => onOrder(order)}
      />
      <div
        role="listbox"
        aria-labelledby={labelledBy}
        aria-orientation="vertical"
        className={LIST}
        onKeyDown={onKeyDown}
      >
        {order.map((id, at) => {
          const element = byId.get(id);
          return element === undefined ? null : (
            <RankingRow
              key={id}
              rankingId={rankingId}
              element={element}
              position={at + 1}
              current={id === current}
              moved={moved.has(id)}
              dragged={drag?.dragging === id}
              indicator={indicatorOf(drag, id)}
              editable={!disabled}
              events={events}
              rowRef={(node) => {
                if (node === null) rows.current.delete(id);
                else rows.current.set(id, node);
              }}
              onFocus={() => setChosen(id)}
            />
          );
        })}
      </div>
    </div>
  );
};
