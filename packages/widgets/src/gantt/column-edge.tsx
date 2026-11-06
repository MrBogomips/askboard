// The TASK column's edge (design decision 7; view spec, "Gantt task column resize"): a vertical
// separator on the right of the column's header, which the pointer drags with pointer capture, as
// the bars are, and the keyboard steps: the arrows by 16 px, with Shift by 64, Home and End to the
// narrowest and the widest, Enter or a double click to fit the longest visible name. It is one
// extra Tab stop in the grid's header, outside the cell grid, and works while the Gantt is
// read-only: the width is view state and reaches no draft (`model/column-width.ts`).

import { useStrings } from "@askboard/view/catalog";
import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { COLUMN_MIN, clampWidth, keyWidth, maxWidth } from "./model/column-width.ts";

export type ColumnEdgeProps = {
  /** The column's width and the widget's, in px. */
  readonly width: number;
  readonly widget: number;
  readonly onWidth: (width: number) => void;
  /** Fits the longest visible name. */
  readonly onFit: () => void;
};

type Press = { readonly pointerId: number; readonly from: number; readonly width: number };

export const ColumnEdge = ({ width, widget, onWidth, onFit }: ColumnEdgeProps) => {
  const text = useStrings();
  const press = useRef<Press | undefined>(undefined);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { pointerId: event.pointerId, from: event.clientX, width };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    if (held === undefined || held.pointerId !== event.pointerId) return;
    onWidth(clampWidth(held.width + event.clientX - held.from, widget));
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (press.current?.pointerId === event.pointerId) press.current = undefined;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onFit();
      return;
    }
    const next = keyWidth(width, event.key, event.shiftKey, widget);
    if (next === undefined) return;
    event.preventDefault();
    onWidth(next);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the WAI-ARIA window splitter; `<hr>` takes no focus or value.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={text("gantt.column.resize")}
      aria-valuenow={width}
      aria-valuemin={COLUMN_MIN}
      aria-valuemax={maxWidth(widget)}
      tabIndex={0}
      data-resize="column"
      data-gantt-column-edge=""
      className="absolute inset-y-0 -right-[3px] z-10 w-[7px] touch-none focus-visible:outline-2 focus-visible:outline-ring"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      onDoubleClick={onFit}
    />
  );
};
