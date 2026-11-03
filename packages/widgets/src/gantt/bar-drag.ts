// The pointer edits of the chart's bars (design decision 9; EXPERIENCE Interaction Primitives,
// Drag): a primary press on a bar, or on its end's handle, captures the pointer, with no drag
// library, and follows its horizontal travel until the pointer comes up, which drops it; Escape
// during the drag, a cancelled pointer, a lost capture or the bars turning read-only (a lock, an
// answer) cancels it. The press is held in a ref, so that the handlers stay the same functions and
// only the dragged bar and its guide draw again as it moves, the chart keeping the other bars, the
// arrows and the axis; what the drop does is the chart's (`drag.ts`). Nothing reaches the draft
// before the drop.

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";

export type DragKind = "move" | "resize";

/** A bar being dragged: its task, what the drag does, and the pointer's travel so far. */
export type BarDrag = { readonly taskId: string; readonly kind: DragKind; readonly dx: number };

type Press = {
  readonly taskId: string;
  readonly kind: DragKind;
  readonly pointerId: number;
  readonly from: number;
  readonly element: Element;
};

export type BarDragState = {
  readonly drag: BarDrag | undefined;
  readonly press: (taskId: string, kind: DragKind, event: PointerEvent<SVGElement>) => void;
  readonly move: (event: PointerEvent<SVGElement>) => void;
  readonly release: (event: PointerEvent<SVGElement>) => void;
  readonly cancel: () => void;
};

/** The drags of a chart's bars, dropped through `onDrop`, while `enabled`: its bars take them. */
export const useBarDrag = (onDrop: (drop: BarDrag) => void, enabled: boolean): BarDragState => {
  const [drag, setDrag] = useState<BarDrag | undefined>(undefined);
  const pressed = useRef<Press | undefined>(undefined);
  const dropTo = useRef(onDrop);
  dropTo.current = onDrop;
  const press = useCallback((taskId: string, kind: DragKind, event: PointerEvent<SVGElement>) => {
    if (event.button !== 0 || pressed.current !== undefined) return;
    // No text selection: the press is the drag's alone. The chart's region takes the focus a
    // press would give it, so that Escape reaches the view even when it had no focus before.
    event.preventDefault();
    const element = event.currentTarget;
    element.closest<HTMLElement>("[tabindex]")?.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    pressed.current = { taskId, kind, pointerId: event.pointerId, from: event.clientX, element };
    setDrag({ taskId, kind, dx: 0 });
  }, []);
  const move = useCallback((event: PointerEvent<SVGElement>) => {
    const held = pressed.current;
    if (held === undefined || event.pointerId !== held.pointerId) return;
    setDrag({ taskId: held.taskId, kind: held.kind, dx: event.clientX - held.from });
  }, []);
  const release = useCallback((event: PointerEvent<SVGElement>) => {
    const held = pressed.current;
    if (held === undefined || event.pointerId !== held.pointerId) return;
    pressed.current = undefined;
    setDrag(undefined);
    dropTo.current({ taskId: held.taskId, kind: held.kind, dx: event.clientX - held.from });
  }, []);
  const cancel = useCallback(() => {
    const held = pressed.current;
    if (held === undefined) return;
    pressed.current = undefined;
    setDrag(undefined);
    if (held.element.hasPointerCapture(held.pointerId)) {
      held.element.releasePointerCapture(held.pointerId);
    }
  }, []);
  // Read-only bars drop their handlers, so no pointer up would end a drag they held.
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);
  const dragging = drag !== undefined;
  useEffect(() => {
    const document = pressed.current?.element.ownerDocument;
    if (!dragging || document === undefined) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The drag's alone: an editor or a panel open beside it keeps its state.
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [dragging, cancel]);
  return { drag, press, move, release, cancel };
};
