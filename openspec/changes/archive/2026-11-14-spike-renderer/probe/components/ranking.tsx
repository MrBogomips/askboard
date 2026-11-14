import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { useEffect } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";
import { DragCard } from "./_dnd.tsx";

type Entry = { id: string; label: string };

const entriesOf = (value: unknown): Entry[] =>
  Array.isArray(value)
    ? value.filter((e): e is Entry => typeof e?.id === "string" && typeof e?.label === "string")
    : [];

// Ranking (EXPERIENCE.md, Components): the order is the item's value in the draft record, a list
// of entry IDs; dropping an entry on another moves it to that place.
const Ranking = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const entries = entriesOf(item.props?.entries);
  const order = Array.isArray(draft) ? (draft as string[]) : entries.map((e) => e.id);
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => source.data.list === item.id,
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0]?.data;
          if (!target || target.list !== item.id) return;
          const from = order.indexOf(String(source.data.id));
          const to = order.indexOf(String(target.id));
          if (from < 0 || to < 0 || from === to) return;
          emit({ type: "draft.set", id: item.id, value: reorder({ list: order, startIndex: from, finishIndex: to }) });
        },
      }),
    [emit, item.id, order],
  );
  const labels = new Map(entries.map((e) => [e.id, e.label]));
  return (
    <div className="flex w-72 flex-col gap-1" aria-label={text(item.props?.label)}>
      {order.map((id, index) => (
        <DragCard key={id} data={{ list: item.id, id }}>
          <span className="text-muted-foreground">{index + 1}.</span> {labels.get(id) ?? id}
        </DragCard>
      ))}
    </div>
  );
};

register("Ranking", Ranking);
