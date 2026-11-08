// The Table's chunk (design decisions 9 and 14): it registers `table` through the `CatalogRenderer`
// port, the one part of `view` a widget imports (AD-1, AD-9). The view hands a widget item's props
// over as data, unchecked, so the Table checks them as an agent's with the contract's plain check
// and throws on a problem: the item's error boundary then fails it, and its question never counts as
// visible (AD-10). It shows its value, the draft or the sent answer, while it fits the props, else
// the agent's props untouched (`shownTable`), so an answer sends what the Table shows. It reads
// the board's live graph and the graph as sent through the `board-graph` chunk for its computed
// cells and totals, reports the derived values its answer carries on every change of the graph
// (`TABLE_ANSWER_DERIVED`), and reports ready once laid out. A Table gives no result.

import {
  TABLE_SHAPE,
  type TableItem,
  type TableProps,
  tablePropsProblems,
} from "@askboard/contract";
import {
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useEffect, useMemo } from "react";
import { liveGraph, sentGraph } from "../board-graph/index.ts";
import { answerDerived } from "./model/derived.ts";
import { shownTable, tableValueFits } from "./model/fits.ts";
import { TableWidget } from "./widget.tsx";

/** The catalog name, which is the Table item's type. */
const TABLE: TableItem["type"] = "table";

/** A Table item as the view hands it over, its props not checked yet. */
type UncheckedTableItem = Omit<TableItem, "props"> & { readonly props: unknown };

type TableComponentProps = ItemProps<UncheckedTableItem, TableProps>;

/** The props as an agent's Table, or an error naming each problem. */
const checkedProps = (itemId: string, props: unknown): TableProps => {
  const problems = tablePropsProblems(props as TableProps, "agent");
  if (problems.length === 0) return props as TableProps;
  const listed = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
  throw new Error(`the Table "${itemId}" refuses its props: ${listed}`);
};

const Table = ({
  item,
  questionId,
  value,
  onValueChange,
  disabled,
  ready,
  board,
  onDerived,
  cellEntries,
  onCellEntriesChange,
}: TableComponentProps) => {
  // The checks throw before the item can report ready: its props, its board's graph. A held value
  // that does not fit shows the agent's props, never a failure.
  const sent = useMemo(() => checkedProps(item.id, item.props), [item.id, item.props]);
  const shown = shownTable(sent, value);
  const live = liveGraph(board);
  const sentBoard = sentGraph(board);
  const computes = sent.columns.some(
    (column) => column.formula !== undefined || column.total !== undefined,
  );
  if (computes && live === undefined) {
    throw new Error(`the board's graph holds no Table "${item.id}"`);
  }
  // Reported on first layout and after each rebuild or recalculation of the graph, which each
  // committed edit of the board makes (AD-20, FR-12).
  const derived = useMemo(
    () => answerDerived({ itemId: item.id, props: shown, sentProps: sent, live, sent: sentBoard }),
    [item.id, shown, sent, live, sentBoard],
  );
  useEffect(() => onDerived(derived), [derived, onDerived]);
  useReadyAfterLayout(ready);
  return (
    <TableWidget
      itemId={item.id}
      labelledBy={questionTextId(questionId)}
      sent={sent}
      value={shown}
      disabled={disabled}
      graph={live}
      sentGraph={sentBoard}
      cellEntries={cellEntries}
      onValueChange={onValueChange}
      onCellEntriesChange={onCellEntriesChange}
    />
  );
};

// The facts the shell needs of the Table (widget-registry, design decision 8; table-widget, design
// decision 9): the shape of its elements for the agent's change, its name in the notice, and
// whether a held value fits the revision shown, so a draft survives an agent's change only while it
// does.
register(TABLE, Table, {
  shape: () => TABLE_SHAPE,
  name: "change.widgetTable",
  valueFits: tableValueFits,
});
