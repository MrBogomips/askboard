// The widgets' pointer drag (gantt-widget design decision 9, moved here by latex-kanban-timeline
// design decision 10 for the Timeline's entries; EXPERIENCE Interaction Primitives, Drag): a
// primary press on an element, or on its end's handle, captures the pointer, with no drag library,
// and follows its travel, horizontal (`dx`) and vertical (`dy`), until the pointer comes up, which
// drops it; Escape during the drag, a cancelled pointer, a lost capture or the elements turning
// read-only (a lock, an answer) cancels it. The press is held in a ref, so that the handlers stay
// the same functions and only the dragged element and its guide draw again as it moves, the widget
// keeping the rest; what the drop does is the widget's. Nothing reaches the draft before the drop.

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { dragOf, type Held, type PointerDrag } from "./pointer-travel.ts";

type Press<Kind extends string> = Held<Kind> & { readonly element: Element };

const at = (event: PointerEvent<Element>) => ({ x: event.clientX, y: event.clientY });

export type PointerDragState<Kind extends string> = {
  readonly drag: PointerDrag<Kind> | undefined;
  readonly press: (id: string, kind: Kind, event: PointerEvent<Element>) => void;
  readonly move: (event: PointerEvent<Element>) => void;
  readonly release: (event: PointerEvent<Element>) => void;
  readonly cancel: () => void;
};

/** The drags of a widget's elements, dropped through `onDrop`, while `enabled`: they take them. */
export const usePointerDrag = <Kind extends string>(
  onDrop: (drop: PointerDrag<Kind>) => void,
  enabled: boolean,
): PointerDragState<Kind> => {
  const [drag, setDrag] = useState<PointerDrag<Kind> | undefined>(undefined);
  const pressed = useRef<Press<Kind> | undefined>(undefined);
  const dropTo = useRef(onDrop);
  dropTo.current = onDrop;
  const press = useCallback((id: string, kind: Kind, event: PointerEvent<Element>) => {
    if (event.button !== 0 || pressed.current !== undefined) return;
    // No text selection: the press is the drag's alone. The widget's region takes the focus a
    // press would give it, so that Escape reaches the view even when it had no focus before.
    event.preventDefault();
    const element = event.currentTarget;
    element.closest<HTMLElement>("[tabindex]")?.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    pressed.current = { id, kind, pointerId: event.pointerId, from: at(event), element };
    setDrag({ id, kind, dx: 0, dy: 0 });
  }, []);
  const move = useCallback((event: PointerEvent<Element>) => {
    const held = pressed.current;
    if (held === undefined || event.pointerId !== held.pointerId) return;
    setDrag(dragOf(held, at(event)));
  }, []);
  const release = useCallback((event: PointerEvent<Element>) => {
    const held = pressed.current;
    if (held === undefined || event.pointerId !== held.pointerId) return;
    pressed.current = undefined;
    setDrag(undefined);
    dropTo.current(dragOf(held, at(event)));
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
  // Read-only elements drop their handlers, so no pointer up would end a drag they held.
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
