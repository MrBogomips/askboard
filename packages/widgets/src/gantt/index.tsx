// The Gantt's chunk entry (design decisions 7, 9 and 11): registers the component `gantt` through
// the `CatalogRenderer` port. The component checks its props as the agent's and throws on a
// problem, so that the error boundary fails the item (AD-10); shows the Gantt as it stands, its
// draft value or else the agent's, with every date and flag from the board's live graph, built
// through `compute` from the board's items with the draft record's values in place, so that a
// board it cannot schedule fails the item too; and reports ready once laid out (AD-9). A
// standalone Gantt shows the week scale (proposal, open question 5). Each edit goes into the
// draft record alone (AD-9, AD-20): the same value changes nothing, and a value back to the
// agent's puts none, so that an edit undone by hand leaves the Gantt untouched. After each
// rebuild it reports its declared derived values, which "Answer" carries; while its question is
// answered, being sent or locked, it takes no edit.

import type { GanttItem } from "@askboard/contract";
import { type ItemProps, register, useReadyAfterLayout } from "@askboard/view/catalog";
import { useCallback, useEffect, useMemo } from "react";
import { liveGraph } from "../graph/board-graph.ts";
import { GanttFrame } from "./frame.tsx";
import { sameGantt } from "./model/edits.ts";
import { ownGanttOf } from "./model/props.ts";
import type { Zoom } from "./model/scale.ts";
import { answerDerived, scheduleOf } from "./model/schedule.ts";
import { type GanttOwnProps, ownTaskRows } from "./model/tasks.ts";

/** A Gantt item as the board sent it: nothing reads its props before they are checked. */
type SentGantt = Omit<GanttItem, "props"> & { readonly props: unknown };

const GANTT: GanttItem["type"] = "gantt";

const ZOOM: Zoom = "week";

const Gantt = ({
  item,
  questionId,
  value,
  onValueChange,
  disabled,
  board,
  ready,
  onDerived,
}: ItemProps<SentGantt, GanttOwnProps>) => {
  const sent = useMemo(() => ownGanttOf(item), [item]);
  const current = value ?? sent;
  // Memoized by the board's items and draft record (`board-graph.ts`): rebuilt only when an edit
  // changes the draft, and thrown from when the board cannot be scheduled.
  const graph = liveGraph(board);
  if (graph === undefined) throw new Error(`the board's graph holds no Gantt "${item.id}"`);
  const rows = useMemo(() => ownTaskRows(current), [current]);
  const schedules = useMemo(() => scheduleOf(graph, item.id, rows), [graph, item.id, rows]);
  const commit = useCallback(
    (next: GanttOwnProps) => {
      if (next !== current) onValueChange(sameGantt(next, sent) ? undefined : next);
    },
    [current, sent, onValueChange],
  );
  // The answer's derived values as they stand, reported after each rebuild (AD-20, FR-12).
  const derived = useMemo(() => answerDerived(graph, item.id, rows), [graph, item.id, rows]);
  useEffect(() => onDerived(derived), [derived, onDerived]);
  useReadyAfterLayout(ready);
  return (
    <GanttFrame
      itemId={item.id}
      questionId={questionId}
      rows={rows}
      schedules={schedules}
      current={current}
      sent={sent}
      onCommit={commit}
      zoom={ZOOM}
      editable={!disabled}
    />
  );
};

register(GANTT, Gantt);
