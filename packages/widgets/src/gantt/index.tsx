// The Gantt's chunk entry (design decisions 7, 9 and 11): registers the component `gantt` through
// the `CatalogRenderer` port. The component checks its props as the agent's, and a plan's link to
// its Tree against the board's items (`model/link.ts`), and throws on a problem, so that the error
// boundary fails the item (AD-10); shows the Gantt as it stands, its draft value or else the
// agent's, with every date and flag from the board's live graph, built through `compute` from the
// board's items with the draft record's values in place, so that a board it cannot schedule fails
// the item too; and reports ready once laid out (AD-9). A plan's tasks are its Tree's leaves as
// the Tree stands, the Tree's draft value included, and under each bar the agent's dates from the
// sent graph as its baseline; it zooms, where a standalone Gantt shows the week scale (proposal,
// open question 5). Each edit goes into the draft record alone (AD-9, AD-20): the same value
// changes nothing, and a value back to the agent's puts none, so that an edit undone by hand
// leaves the Gantt untouched. After each rebuild it reports its declared derived values, which
// "Answer" carries; while its question is answered, being sent or locked, it takes no edit.

import type { GanttItem, GanttProps } from "@askboard/contract";
import { type ItemProps, register, useReadyAfterLayout } from "@askboard/view/catalog";
import { useCallback, useEffect, useMemo } from "react";
import { liveGraph, sentGraph } from "../graph/index.ts";
import { GanttFrame } from "./frame.tsx";
import { sameGantt } from "./model/edits.ts";
import { ganttMarks, ganttRows } from "./model/kinds.ts";
import { linkedTree, treeNodesOf } from "./model/link.ts";
import { ganttPropsOf } from "./model/props.ts";
import { answerDerived, baselineOf, scheduleOf } from "./model/schedule.ts";
import { isOwnGantt } from "./model/tasks.ts";

/** A Gantt item as the board sent it: nothing reads its props before they are checked. */
type SentGantt = Omit<GanttItem, "props"> & { readonly props: unknown };

const GANTT: GanttItem["type"] = "gantt";

const Gantt = ({
  item,
  questionId,
  value,
  onValueChange,
  disabled,
  board,
  ready,
  onDerived,
}: ItemProps<SentGantt, GanttProps>) => {
  const sent = useMemo(() => ganttPropsOf(item), [item]);
  const tree = useMemo(
    () => (isOwnGantt(sent) ? undefined : linkedTree(item, board.items)),
    [item, sent, board.items],
  );
  const current = value ?? sent;
  // Memoized by the board's items and shown values (`board-graph.ts`): rebuilt only when an edit
  // changes what the board shows, and thrown from when the board cannot be scheduled.
  const graph = liveGraph(board);
  if (graph === undefined) throw new Error(`the board's graph holds no Gantt "${item.id}"`);
  // A plan's baselines read the board as sent, built once per board revision.
  const sentBoard = tree === undefined ? undefined : sentGraph(board);
  const nodes = tree === undefined ? undefined : treeNodesOf(tree, board);
  const rows = useMemo(
    () =>
      ganttRows(
        current,
        tree === undefined || nodes === undefined
          ? undefined
          : { nodes, sentNodes: tree.props.nodes },
      ),
    [current, tree, nodes],
  );
  const schedules = useMemo(() => scheduleOf(graph, item.id, rows), [graph, item.id, rows]);
  const baselines = useMemo(
    () => (sentBoard === undefined ? undefined : baselineOf(sentBoard, item.id, rows)),
    [sentBoard, item.id, rows],
  );
  const { marks, count } = useMemo(
    () => ganttMarks(current, sent, rows, schedules, baselines),
    [current, sent, rows, schedules, baselines],
  );
  const commit = useCallback(
    (next: GanttProps) => {
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
      baselines={baselines}
      marks={marks}
      count={count}
      current={current}
      sent={sent}
      onCommit={commit}
      zoomable={tree !== undefined}
      editable={!disabled}
    />
  );
};

register(GANTT, Gantt);
