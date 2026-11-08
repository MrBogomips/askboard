// The Row (FR-13, layouts): 2 to 4 items side by side, with relative widths. Its schema is
// standalone: it belongs to no schema set until the entry is registered (layouts, design decision
// 8), and nothing compiles it when this module loads.

export { rowPropsProblems } from "./checks.ts";
export {
  ROW_MAX_ITEMS,
  ROW_MAX_WEIGHT,
  ROW_MIN_ITEMS,
  ROW_MIN_WEIGHT,
  ROW_SCHEMA_IDS,
  type RowItem,
  type RowProps,
} from "./constants.ts";
export { ROW_WIDGET } from "./widget.ts";
