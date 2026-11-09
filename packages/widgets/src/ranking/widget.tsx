// The Ranking's frame (view-and-widgets spec: Ranking reorder, Ranking at the keyboard, Ranking row
// selection, Result widgets read-only; design decision 8): a toolbar row and the list of rows. The
// order is the held result's, else the agent's. The list is one Tab stop whose keys go through the
// key table in effect (`list-keys.ts`, `useKeyTable`): they move the current row, select rows, move
// the selected rows (else the current one) and keep the order; the toolbar is another stop. A move
// by the tools, the keys or a drop puts the whole order and keeps the current row current; the
// drag (which moves the dragged row alone), the selection, the current row and the drop indicator
// are the component's own state and never go in the draft (AD-9, AD-10). Nothing here holds the
// order: it reads it from the result and reports the next one.

import { RANKING_KEYS, type RankingProps } from "@askboard/contract";
import { keyPressOf, useKeyTable, useStrings } from "@askboard/view/catalog";
import { useLayoutEffect, useRef, useState } from "react";
import { FRAME, LIST } from "./classes.ts";
import type { RowDragEvents } from "./drag.ts";
import { afterDrop, type DragState, indicatorOf } from "./drop.ts";
import { rankingTools } from "./keys.ts";
import { type ListChange, type ListContext, listKeyChange, moveOrder } from "./list-keys.ts";
import { movedOf } from "./model.ts";
import { actingRows } from "./moves.ts";
import { RankingRow } from "./row.tsx";
import { clear, extend, NO_SELECTION, pruned, type RowSelection, toggle } from "./selection.ts";
import { RankingToolbar, type ToolKey } from "./toolbar.tsx";

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
  const text = useStrings();
  const table = useKeyTable(RANKING_KEYS);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<RowSelection>(NO_SELECTION);
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
  // A read-only Ranking selects nothing; rows an agent's revision took away leave the selection.
  if (disabled && picked.ids.size > 0) setPicked(NO_SELECTION);
  const selection = disabled ? NO_SELECTION : pruned(picked, order);
  const context: ListContext = { order, current, selection, disabled };
  const acting = actingRows(order, selection.ids, current);
  const tools = rankingTools(order, acting, selection.ids.size > 0, disabled);
  // A move by the keys can move the focused row's element in the DOM, which drops the focus in
  // some engines: the list gives it back to the current row once the new order is drawn.
  const refocus = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `order` is the trigger: the new order has been drawn.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    rows.current.get(current)?.focus();
  }, [current, order]);

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

  const focusRow = (id: string): void => {
    setChosen(id);
    rows.current.get(id)?.focus();
  };

  const apply = (change: ListChange): void => {
    if (change.selection !== undefined) setPicked(change.selection);
    if (change.current !== undefined) focusRow(change.current);
    if (change.order !== undefined) {
      refocus.current = change.order !== order;
      onOrder(change.order);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const change = listKeyChange(table, keyPressOf(event), context);
    if (change === undefined) return;
    if (change.taken) event.preventDefault();
    apply(change);
  };

  const onTool = (tool: ToolKey): void => {
    const kinds = { moveUp: "up", moveDown: "down", toTop: "top", toBottom: "bottom" } as const;
    if (tool === "keep") onOrder(order);
    else if (tool === "selectNone") setPicked(clear());
    else {
      const next = moveOrder(context, kinds[tool]);
      if (next !== undefined) onOrder(next);
    }
  };

  // A click on a row's check box: toggles it, or with Shift extends from the last row clicked.
  const onPick = (id: string, range: boolean): void => {
    setPicked(range ? extend(selection, order, id) : toggle(selection, order, id));
    focusRow(id);
  };

  return (
    <div className={FRAME} data-ranking="">
      <RankingToolbar
        tools={tools}
        table={table}
        held={held}
        moved={moved.size}
        selected={selection.ids.size}
        onTool={onTool}
      />
      <div
        role="listbox"
        aria-labelledby={labelledBy}
        aria-orientation="vertical"
        aria-multiselectable={disabled ? undefined : true}
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
              selected={selection.ids.has(id)}
              selectLabel={text("ranking.select", { name: element.label })}
              onPick={(range) => onPick(id, range)}
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
