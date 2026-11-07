// The Group (FR-13, layouts): a titled group of items. Its schema is standalone: it belongs to no
// schema set until the entry is registered (layouts, design decision 8), and nothing compiles it
// when this module loads.

export {
  GROUP_DESCRIPTION_MAX_CHARS,
  GROUP_MIN_ITEMS,
  GROUP_SCHEMA_IDS,
  GROUP_TITLE_MAX_CHARS,
  type GroupItem,
  type GroupProps,
} from "./constants.ts";
export { GROUP_WIDGET } from "./widget.ts";
