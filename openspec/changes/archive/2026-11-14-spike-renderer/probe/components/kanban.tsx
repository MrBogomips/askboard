import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useEffect } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";
import { DragCard, useDragAndDrop } from "./_dnd.tsx";

type Lane = { id: string; label: string; cards: { id: string; label: string }[] };
type Board = Record<string, string[]>;

const lanesOf = (value: unknown): Lane[] =>
  Array.isArray(value) ? value.filter((l): l is Lane => typeof l?.id === "string" && Array.isArray(l?.cards)) : [];

const LaneView = ({ board, lane, ids, labels }: { board: string; lane: Lane; ids: string[]; labels: Map<string, string> }) => {
  const { ref, over } = useDragAndDrop({ board, lane: lane.id }, false);
  return (
    <div
      ref={ref}
      data-lane-id={lane.id}
      className={`flex min-h-32 w-48 flex-col gap-1 rounded-md border p-2 ${over ? "border-primary" : "border-border"} bg-muted`}
    >
      <div className="text-label uppercase text-muted-foreground">{lane.label}</div>
      {ids.map((id) => (
        <DragCard key={id} data={{ board, lane: lane.id, id }}>
          {labels.get(id) ?? id}
        </DragCard>
      ))}
    </div>
  );
};

// Kanban (EXPERIENCE.md, Components): the lanes' contents are the item's value in the draft
// record. A card dropped on a lane goes to its end; dropped on a card, before that card.
const Kanban = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const lanes = lanesOf(item.props?.lanes);
  const board: Board =
    draft && typeof draft === "object"
      ? (draft as Board)
      : Object.fromEntries(lanes.map((l) => [l.id, l.cards.map((c) => c.id)]));
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => source.data.board === item.id,
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0]?.data;
          if (!target || target.board !== item.id) return;
          const card = String(source.data.id);
          const lane = String(target.lane);
          const without = Object.fromEntries(Object.entries(board).map(([k, ids]) => [k, ids.filter((id) => id !== card)]));
          const ids = without[lane] ?? [];
          const at = target.id ? ids.indexOf(String(target.id)) : -1;
          const next = { ...without, [lane]: at < 0 ? [...ids, card] : [...ids.slice(0, at), card, ...ids.slice(at)] };
          emit({ type: "draft.set", id: item.id, value: next });
        },
      }),
    [emit, item.id, board],
  );
  const labels = new Map(lanes.flatMap((l) => l.cards.map((c) => [c.id, c.label] as const)));
  return (
    <div className="flex gap-2" aria-label={text(item.props?.label)}>
      {lanes.map((lane) => (
        <LaneView key={lane.id} board={item.id} lane={lane} ids={board[lane.id] ?? []} labels={labels} />
      ))}
    </div>
  );
};

register("Kanban", Kanban);
