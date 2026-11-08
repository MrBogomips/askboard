// The Table (FR-11, table-widget): a grid of typed columns the user edits, with totals and columns
// declared as formulas. Its schemas are standalone: they belong to no schema set until the entry is
// registered (design decision 14), and nothing compiles them when this module loads.

export { tableCellProblems, tableRowsProblems } from "./cells.ts";
export { tableColumnsProblems, tablePropsProblems } from "./checks.ts";
export {
  TABLE_COLUMN_TYPES,
  TABLE_FIELD_PATTERN,
  TABLE_FORMULA_MAX_CHARS,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_MIN_COLUMNS,
  TABLE_SCHEMA_IDS,
  TABLE_TEXT_MAX_CHARS,
  type TableCellValue,
  type TableColumn,
  type TableColumnType,
  type TableItem,
  type TableOrigin,
  type TableProps,
  type TableRow,
} from "./constants.ts";
export { TABLE_WIDGET } from "./widget.ts";
