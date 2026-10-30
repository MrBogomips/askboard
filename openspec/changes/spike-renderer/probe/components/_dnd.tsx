// Shared by the drag-and-drop chunks (Ranking, Kanban): one element that is both draggable and
// a drop target, on Pragmatic drag and drop (native HTML5 drag) from the `lib-dnd` chunk.

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { type ReactNode, useEffect, useRef, useState } from "react";

export const useDragAndDrop = (data: Record<string, string>, canDrag = true) => {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const key = JSON.stringify(data);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const parsed = JSON.parse(key) as Record<string, string>;
    const parts = [
      dropTargetForElements({
        element,
        getData: () => parsed,
        onDragEnter: () => setOver(true),
        onDragLeave: () => setOver(false),
        onDrop: () => setOver(false),
      }),
    ];
    if (canDrag) parts.push(draggable({ element, getInitialData: () => parsed }));
    return combine(...parts);
  }, [key, canDrag]);
  return { ref, over };
};

export const DragCard = ({ data, children }: { data: Record<string, string>; children: ReactNode }) => {
  const { ref, over } = useDragAndDrop(data);
  return (
    <div
      ref={ref}
      data-drag-id={data.id}
      className={`cursor-grab rounded-md border bg-card px-2 py-1 text-body ${over ? "border-primary" : "border-border"}`}
    >
      {children}
    </div>
  );
};
