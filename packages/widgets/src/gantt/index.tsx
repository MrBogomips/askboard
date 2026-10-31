// The Gantt's chunk entry (design decisions 7, 9 and 11): registers the component `gantt` through
// the `CatalogRenderer` port. The component checks its props as the agent's and throws on a
// problem, so that the error boundary fails the item (AD-10); builds the board's live graph
// through `compute`, so that a board it cannot schedule fails the item too; shows each task's name
// as text, never as markup (AD-8); and reports ready once laid out (AD-9). Group 6 grows it into
// the grid beside the chart.

import type { GanttItem } from "@askboard/contract";
import { type ItemProps, register, useReadyAfterLayout } from "@askboard/view/catalog";
import { useMemo } from "react";
import { liveGraph } from "../graph/board-graph.ts";
import { ownGanttOf } from "./model/props.ts";
import { ownTaskRows } from "./model/tasks.ts";

/** A Gantt item as the board sent it: nothing reads its props before they are checked. */
type SentGantt = Omit<GanttItem, "props"> & { readonly props: unknown };

const GANTT: GanttItem["type"] = "gantt";

const Gantt = ({ item, board, ready }: ItemProps<SentGantt>) => {
  const sent = useMemo(() => ownGanttOf(item), [item]);
  const rows = useMemo(() => ownTaskRows(sent), [sent]);
  // Memoized by the board's items and draft record (`board-graph.ts`), and thrown from when the
  // board cannot be scheduled. Group 6 draws the dates, the bars and the critical path from it.
  liveGraph(board);
  useReadyAfterLayout(ready);
  return (
    <ul className="flex flex-col gap-1 text-body text-foreground">
      {rows.map((row) => (
        <li key={row.id}>{row.label}</li>
      ))}
    </ul>
  );
};

register(GANTT, Gantt);
