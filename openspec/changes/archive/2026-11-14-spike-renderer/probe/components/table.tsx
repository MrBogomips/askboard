import {
  createExpandedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { inputClass, text } from "./_field.tsx";

// Table, Tree and Spreadsheet on TanStack Table (EXPERIENCE.md, Components), from the
// `lib-table` library chunk. TanStack holds the row models; the sort, the expanded rows and the
// cell values are view state or values in the draft record (AD-9), passed in as controlled state.

type Row = Record<string, unknown> & { children?: Row[] };
type Column = { key: string; label: string };
type Updater<T> = T | ((old: T) => T);

const columnsOf = (value: unknown): Column[] =>
  Array.isArray(value)
    ? value.filter((c): c is Column => typeof c?.key === "string" && typeof c?.label === "string")
    : [];
const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const apply = <T,>(updater: Updater<T>, old: T): T =>
  typeof updater === "function" ? (updater as (o: T) => T)(old) : updater;

const sortFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const treeFeatures = tableFeatures({ rowExpandingFeature, expandedRowModel: createExpandedRowModel() });
const plainFeatures = tableFeatures({});

const cellClass = "border-b border-border px-2 py-1 text-left text-body";

const Table = ({ item, ui, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const sorting = Array.isArray(ui) ? (ui as { id: string; desc: boolean }[]) : [];
  const table = useTable({
    features: sortFeatures,
    columns: columnsOf(item.props?.columns).map((c) => ({ accessorKey: c.key, header: c.label, sortFn: "alphanumeric" })),
    data: rowsOf(item.props?.rows),
    state: { sorting },
    onSortingChange: (updater: Updater<typeof sorting>) =>
      emit({ type: "ui.set", id: item.id, value: apply(updater, sorting) }),
  } as never) as any;
  return (
    <table className="border-collapse">
      <thead>
        {table.getHeaderGroups().map((group: any) => (
          <tr key={group.id}>
            {group.headers.map((header: any) => (
              <th key={header.id} className={`${cellClass} text-label uppercase text-muted-foreground`}>
                <button type="button" onClick={header.column.getToggleSortingHandler()} data-sort={header.column.getIsSorted() || "none"}>
                  <table.FlexRender header={header} />
                </button>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row: any) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell: any) => (
              <td key={cell.id} className={cellClass}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Tree = ({ item, ui, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const expanded = ui && typeof ui === "object" ? (ui as Record<string, boolean>) : {};
  const table = useTable({
    features: treeFeatures,
    columns: columnsOf(item.props?.columns).map((c) => ({ accessorKey: c.key, header: c.label })),
    data: rowsOf(item.props?.rows),
    getSubRows: (row: Row) => row.children,
    getRowId: (row: Row) => String(row.id),
    state: { expanded },
    onExpandedChange: (updater: Updater<typeof expanded>) =>
      emit({ type: "ui.set", id: item.id, value: apply(updater, expanded) }),
  } as never) as any;
  return (
    <table className="border-collapse" role="treegrid">
      <tbody>
        {table.getRowModel().rows.map((row: any) => (
          <tr key={row.id} data-row-id={row.id} aria-level={row.depth + 1}>
            {row.getAllCells().map((cell: any, index: number) => (
              <td key={cell.id} className={cellClass}>
                {index === 0 ? (
                  <span className={["pl-0", "pl-4", "pl-8", "pl-12"][Math.min(row.depth, 3)]}>
                    {row.getCanExpand() ? (
                      <button type="button" onClick={row.getToggleExpandedHandler()} aria-expanded={row.getIsExpanded()}>
                        {row.getIsExpanded() ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="inline-block w-3" />
                    )}{" "}
                    <table.FlexRender cell={cell} />
                  </span>
                ) : (
                  <table.FlexRender cell={cell} />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// A1 references: columns A, B, C…, rows from 1. The cell values are the item's value in the
// draft record, a record keyed by reference.
const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

const Spreadsheet = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const width = Number(item.props?.columns ?? 4);
  const height = Number(item.props?.rows ?? 5);
  const values = draft && typeof draft === "object" ? (draft as Record<string, string>) : {};
  const columns = letters(width);
  const table = useTable({
    features: plainFeatures,
    columns: columns.map((letter) => ({ id: letter, header: letter, accessorFn: (row: { n: number }) => `${letter}${row.n}` })),
    data: Array.from({ length: height }, (_, i) => ({ n: i + 1 })),
  } as never) as any;
  return (
    <table className="border-collapse">
      <thead>
        <tr>
          <th className={cellClass} />
          {columns.map((letter) => (
            <th key={letter} className={`${cellClass} text-label text-muted-foreground`}>
              {letter}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row: any) => (
          <tr key={row.id}>
            <th className={`${cellClass} text-label text-muted-foreground`}>{row.original.n}</th>
            {row.getAllCells().map((cell: any) => {
              const ref = String(cell.getValue());
              return (
                <td key={cell.id} className="border border-border p-0">
                  <input
                    aria-label={ref}
                    data-ref={ref}
                    className={`${inputClass} w-24 rounded-none border-0`}
                    value={values[ref] ?? ""}
                    onChange={(e) => emit({ type: "draft.set", id: item.id, value: { ...values, [ref]: e.target.value } })}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

register("Table", Table);
register("Tree", Tree);
register("Spreadsheet", Spreadsheet);
