// The Tabs layout (FR-13, layouts): 2 to 8 titled tabs, each holding items. Its schema is
// standalone: it belongs to no schema set until the entry is registered (layouts, design decision
// 8), and nothing compiles it when this module loads.

export { tabsPropsProblems } from "./checks.ts";
export {
  TABS_MAX_TABS,
  TABS_MIN_TABS,
  TABS_SCHEMA_IDS,
  TABS_TITLE_MAX_CHARS,
  type Tab,
  type TabsItem,
  type TabsProps,
} from "./constants.ts";
export { TABS_WIDGET } from "./widget.ts";
