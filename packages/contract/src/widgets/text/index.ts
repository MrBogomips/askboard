// The Text (FR-13, atoms): plain text or Markdown the user reads, which gives no answer. Its
// schema is standalone: it belongs to no schema set until the entry is registered (design decision
// 10), and nothing compiles it when this module loads.

export { textPropsProblems } from "./checks.ts";
export {
  TEXT_FORMATS,
  TEXT_MAX_CHARS,
  TEXT_SCHEMA_IDS,
  type TextItem,
  type TextProps,
} from "./constants.ts";
export { TEXT_WIDGET } from "./widget.ts";
